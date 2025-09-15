import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config';
import { Logger } from '../utils/logger';
import { EncryptionService } from '../utils/encryption';
import { UserModel } from '../database/connection';
import { OAuthTokens, User } from '../types';

export class OAuthService {
  private oauth2Client: OAuth2Client;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );
  }

  // Generate OAuth URL with PKCE
  generateAuthUrl(userId: bigint): { url: string; codeVerifier: string; state: string } {
    const codeVerifier = EncryptionService.generateCodeVerifier();
    const codeChallenge = EncryptionService.generateCodeChallenge(codeVerifier);
    const state = EncryptionService.generateRandomString(32);

    console.log("[OAuth] Generating auth URL for user:", userId.toString());
    console.log("[OAuth] Redirect URI:", config.google.redirectUri);
    console.log("[OAuth] Client ID:", config.google.clientId);
    console.log("[OAuth] Scopes:", config.google.scopes);

    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: config.google.scopes,
      state: `${userId}:${state}`,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256' as any,
      prompt: 'consent'
    });

    console.log("[OAuth] Generated auth URL:", authUrl);
    console.log("[OAuth] Code verifier length:", codeVerifier.length);
    console.log("[OAuth] State:", `${userId}:${state}`);

    Logger.info('OAuth URL generated', { userId: userId.toString() });

    return {
      url: authUrl,
      codeVerifier,
      state
    };
  }

  // Exchange authorization code for tokens
  async exchangeCodeForTokens(
    code: string, 
    codeVerifier: string, 
    state: string
  ): Promise<{ user: User; tokens: OAuthTokens }> {
    try {
      Logger.info('Starting OAuth token exchange', { 
        codeLength: code.length,
        hasCodeVerifier: !!codeVerifier,
        stateLength: state.length
      });

      // Verify state parameter
      const [userIdStr, stateToken] = state.split(':');
      if (!userIdStr || !stateToken) {
        Logger.error('Invalid state parameter in OAuth exchange', new Error('Invalid state parameter'), { state });
        throw new Error('Invalid state parameter');
      }

      const userId = BigInt(userIdStr);

      // Create a fresh OAuth2Client for this exchange
      const exchangeClient = new google.auth.OAuth2(
        config.google.clientId,
        config.google.clientSecret,
        config.google.redirectUri
      );

      console.log("[OAuth] Exchanging code with redirect_uri:", config.google.redirectUri);
      console.log("[OAuth] Client ID:", config.google.clientId);
      console.log("[OAuth] Code length:", code.length);
      console.log("[OAuth] Code verifier present:", !!codeVerifier);
      console.log("[OAuth] State:", state);

      Logger.info('Created OAuth2Client for token exchange', {
        clientId: config.google.clientId,
        redirectUri: config.google.redirectUri
      });

      // Exchange code for tokens
      const { tokens } = await exchangeClient.getToken({
        code,
        codeVerifier: codeVerifier,
        redirect_uri: config.google.redirectUri
      });

      Logger.info('Received tokens from Google', {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        tokenType: tokens.token_type,
        expiresIn: tokens.expiry_date
      });

      if (!tokens.access_token || !tokens.refresh_token) {
        Logger.error('Invalid token response from Google', new Error('Invalid token response from Google'), {
          hasAccessToken: !!tokens.access_token,
          hasRefreshToken: !!tokens.refresh_token,
          tokenKeys: Object.keys(tokens)
        });
        throw new Error('Invalid token response from Google');
      }

      // Set credentials on the exchange client and ensure they're applied
      exchangeClient.setCredentials(tokens);
      
      // Add a small delay to ensure credentials are properly set
      await new Promise(resolve => setTimeout(resolve, 100));

      Logger.info('Set credentials on OAuth2Client, fetching user info');

      // Get user info from Google using the exchange client
      const oauth2 = google.oauth2({ version: 'v2', auth: exchangeClient });
      const userInfo = await oauth2.userinfo.get();

      if (!userInfo.data.email) {
        throw new Error('Could not retrieve user email from Google');
      }

      // Encrypt tokens
      const encryptedAccessToken = EncryptionService.encrypt(tokens.access_token);
      const encryptedRefreshToken = EncryptionService.encrypt(tokens.refresh_token);

      // Calculate token expiration
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + (tokens.expiry_date ? 
        Math.floor((tokens.expiry_date - Date.now()) / 1000) : 3600));

      // Create or update user
      let user = await UserModel.findByGoogleEmail(userInfo.data.email);
      
      if (user) {
        // Update existing user
        user = await UserModel.update(userId, {
          google_email: userInfo.data.email,
          encrypted_refresh_token: encryptedRefreshToken,
          encrypted_access_token: encryptedAccessToken,
          token_expires_at: expiresAt,
          is_active: true
        });
      } else {
        // Create new user
        user = await UserModel.create({
          id: userId,
          google_email: userInfo.data.email,
          encrypted_refresh_token: encryptedRefreshToken,
          encrypted_access_token: encryptedAccessToken,
          token_expires_at: expiresAt,
          is_active: true
        });
      }

      if (!user) {
        throw new Error('Failed to create or update user');
      }

      Logger.audit(userId, 'oauth_login', {
        email: userInfo.data.email,
        success: true
      });

      return {
        user,
        tokens: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_in: tokens.expiry_date ? Math.floor((tokens.expiry_date - Date.now()) / 1000) : 3600,
          token_type: tokens.token_type || 'Bearer',
          scope: tokens.scope || config.google.scopes.join(' ')
        }
      };
    } catch (error: any) {
      console.error("[OAuth] Token exchange failed:", {
        message: error.message,
        stack: error.stack,
        response: error.response?.data,
        code: error.code,
        status: error.status,
        config: {
          clientId: config.google.clientId,
          redirectUri: config.google.redirectUri,
          hasCodeVerifier: !!codeVerifier,
          stateLength: state.length
        }
      });

      // Log detailed error information for debugging
      Logger.error('OAuth token exchange failed', error as Error, {
        message: error.message,
        stack: error.stack,
        response: error.response?.data,
        code: error.code,
        status: error.status,
        config: {
          clientId: config.google.clientId,
          redirectUri: config.google.redirectUri,
          hasCodeVerifier: !!codeVerifier,
          stateLength: state.length
        }
      });

      // Provide more specific error messages based on error type
      if (error.message?.includes('invalid_grant')) {
        throw new Error('OAuth Error: Invalid authorization code. Please try logging in again.');
      } else if (error.message?.includes('redirect_uri_mismatch')) {
        throw new Error('OAuth Error: Redirect URI mismatch. Please contact support.');
      } else if (error.message?.includes('invalid_client')) {
        throw new Error('OAuth Error: Invalid client configuration. Please contact support.');
      } else if (error.message?.includes('access_denied')) {
        throw new Error('OAuth Error: Access denied. Please grant the required permissions.');
      } else {
        throw new Error(`OAuth Token Exchange Error: ${error.message || 'Unknown error occurred during authentication'}`);
      }
    }
  }

  // Refresh access token
  async refreshAccessToken(user: User): Promise<{ accessToken: string; expiresAt: Date }> {
    try {
      Logger.info('Starting access token refresh', { userId: user.id.toString() });

      // Decrypt refresh token
      const refreshToken = EncryptionService.decrypt(user.encrypted_refresh_token);

      // Create a fresh OAuth2Client for refresh
      const refreshClient = new google.auth.OAuth2(
        config.google.clientId,
        config.google.clientSecret,
        config.google.redirectUri
      );

      // Set credentials with refresh token
      refreshClient.setCredentials({
        refresh_token: refreshToken
      });

      Logger.info('Set refresh token credentials, refreshing access token');

      // Refresh the access token
      const { credentials } = await refreshClient.refreshAccessToken();

      Logger.info('Received refreshed credentials', {
        hasAccessToken: !!credentials.access_token,
        hasRefreshToken: !!credentials.refresh_token,
        expiresIn: credentials.expiry_date
      });

      if (!credentials.access_token) {
        Logger.error('No access token in refresh response', new Error('Failed to refresh access token'), {
          hasRefreshToken: !!credentials.refresh_token,
          tokenKeys: Object.keys(credentials)
        });
        throw new Error('Failed to refresh access token');
      }

      // Encrypt new access token
      const encryptedAccessToken = EncryptionService.encrypt(credentials.access_token);

      // Calculate new expiration
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + (credentials.expiry_date ? 
        Math.floor((credentials.expiry_date - Date.now()) / 1000) : 3600));

      // Update user with new token
      await UserModel.update(user.id, {
        encrypted_access_token: encryptedAccessToken,
        token_expires_at: expiresAt
      });

      Logger.info('Access token refreshed successfully', { 
        userId: user.id.toString(),
        expiresAt: expiresAt.toISOString()
      });

      return {
        accessToken: credentials.access_token,
        expiresAt
      };
    } catch (error: any) {
      Logger.error('Failed to refresh access token', error as Error, {
        message: error.message,
        stack: error.stack,
        response: error.response?.data,
        code: error.code,
        userId: user.id.toString()
      });

      // Provide specific error messages for refresh failures
      if (error.message?.includes('invalid_grant')) {
        throw new Error('Refresh Error: Invalid refresh token. Please log in again.');
      } else if (error.message?.includes('invalid_client')) {
        throw new Error('Refresh Error: Invalid client configuration. Please contact support.');
      } else {
        throw new Error(`Refresh Error: ${error.message || 'Failed to refresh access token'}`);
      }
    }
  }

  // Get OAuth2Client with user's credentials
  async getOAuth2Client(user: User): Promise<OAuth2Client> {
    try {
      // Create a fresh OAuth2Client instance for each request
      const oauth2Client = new google.auth.OAuth2(
        config.google.clientId,
        config.google.clientSecret,
        config.google.redirectUri
      );

      // Check if token is expired
      const now = new Date();
      if (user.token_expires_at <= now) {
        // Token is expired, refresh it
        const { accessToken } = await this.refreshAccessToken(user);
        oauth2Client.setCredentials({
          access_token: accessToken
        });
      } else {
        // Token is still valid, decrypt and use it
        const accessToken = EncryptionService.decrypt(user.encrypted_access_token);
        const refreshToken = EncryptionService.decrypt(user.encrypted_refresh_token);
        oauth2Client.setCredentials({
          access_token: accessToken,
          refresh_token: refreshToken
        });
      }

      // Ensure credentials are properly set
      await new Promise(resolve => setTimeout(resolve, 50));

      return oauth2Client;
    } catch (error) {
      Logger.error('Failed to get OAuth2Client', error as Error, { userId: user.id.toString() });
      throw error;
    }
  }

  // Revoke user tokens
  async revokeTokens(user: User): Promise<void> {
    try {
      // Decrypt tokens
      const accessToken = EncryptionService.decrypt(user.encrypted_access_token);
      const refreshToken = EncryptionService.decrypt(user.encrypted_refresh_token);

      // Revoke tokens with Google
      try {
        await this.oauth2Client.revokeToken(accessToken);
      } catch (error) {
        Logger.warn('Failed to revoke access token', { userId: user.id.toString(), error });
      }

      try {
        await this.oauth2Client.revokeToken(refreshToken);
      } catch (error) {
        Logger.warn('Failed to revoke refresh token', { userId: user.id.toString(), error });
      }

      // Deactivate user in database
      await UserModel.deactivate(user.id);

      Logger.audit(user.id, 'oauth_logout', {
        email: user.google_email,
        success: true
      });
    } catch (error) {
      Logger.error('Failed to revoke tokens', error as Error, { userId: user.id.toString() });
      throw error;
    }
  }

  // Verify token validity
  async verifyToken(user: User): Promise<boolean> {
    try {
      const oauth2Client = await this.getOAuth2Client(user);
      
      // Try to make a simple API call to verify the token
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      await oauth2.userinfo.get();
      
      return true;
    } catch (error) {
      Logger.warn('Token verification failed', { userId: user.id.toString(), error });
      return false;
    }
  }

  // Get user info from Google
  async getUserInfo(user: User): Promise<{
    id: string;
    email: string;
    name: string;
    picture?: string;
  }> {
    try {
      const oauth2Client = await this.getOAuth2Client(user);
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();

      return {
        id: userInfo.data.id || '',
        email: userInfo.data.email || '',
        name: userInfo.data.name || '',
        picture: userInfo.data.picture || undefined
      };
    } catch (error) {
      Logger.error('Failed to get user info', error as Error, { userId: user.id.toString() });
      throw error;
    }
  }
}
