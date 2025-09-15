import { OAuthService } from '../../src/services/oauthService';
import { google } from 'googleapis';
import { config } from '../../src/config';

// Mock Google APIs
const mockOAuth2Client = {
  generateAuthUrl: jest.fn(),
  getToken: jest.fn(),
  setCredentials: jest.fn(),
  refreshAccessToken: jest.fn(),
  revokeToken: jest.fn()
};

jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn(() => mockOAuth2Client)
    },
    oauth2: jest.fn()
  }
}));

// Mock the database and encryption
jest.mock('../../src/database/connection', () => ({
  UserModel: {
    findByGoogleEmail: jest.fn(),
    update: jest.fn(),
    create: jest.fn()
  }
}));

jest.mock('../../src/utils/encryption', () => ({
  EncryptionService: {
    encrypt: jest.fn((text: string) => `encrypted_${text}`),
    decrypt: jest.fn((text: string) => text.replace('encrypted_', '')),
    generateCodeVerifier: jest.fn(() => 'test_code_verifier'),
    generateCodeChallenge: jest.fn(() => 'test_code_challenge'),
    generateRandomString: jest.fn(() => 'test_random_string')
  }
}));

const mockGoogle = google as jest.Mocked<typeof google>;

describe('OAuthService Integration', () => {
  let oauthService: OAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    oauthService = new OAuthService();
  });

  describe('generateAuthUrl', () => {
    it('should generate OAuth URL with PKCE parameters', () => {
      const userId = BigInt('123456789012345678');
      const mockUrl = 'https://accounts.google.com/oauth/authorize?client_id=test&redirect_uri=test&response_type=code&scope=test&state=123456789012345678:test_random_string&code_challenge=test_code_challenge&code_challenge_method=S256&access_type=offline&prompt=consent';
      
      mockOAuth2Client.generateAuthUrl.mockReturnValue(mockUrl);

      const result = oauthService.generateAuthUrl(userId);

      expect(result.url).toBe(mockUrl);
      expect(result.codeVerifier).toBe('test_code_verifier');
      expect(result.state).toBe('test_random_string');
      expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalledWith({
        access_type: 'offline',
        scope: config.google.scopes,
        state: `${userId}:test_random_string`,
        code_challenge: 'test_code_challenge',
        code_challenge_method: 'S256',
        prompt: 'consent'
      });
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('should exchange code for tokens and create user with proper credentials', async () => {
      const code = 'test_auth_code';
      const codeVerifier = 'test_code_verifier';
      const state = '123456789012345678:test_state';
      
      const mockTokens = {
        access_token: 'test_access_token',
        refresh_token: 'test_refresh_token',
        expiry_date: Date.now() + 3600000,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/drive.file'
      };

      const mockUserInfo = {
        data: {
          email: 'test@example.com',
          id: 'google_user_id',
          name: 'Test User'
        }
      };

      const mockUser = {
        id: BigInt('123456789012345678'),
        google_email: 'test@example.com',
        encrypted_refresh_token: 'encrypted_test_refresh_token',
        encrypted_access_token: 'encrypted_test_access_token',
        token_expires_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true
      };

      // Mock the OAuth2Client methods
      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens });
      
      // Mock the oauth2 service
      const mockOAuth2 = {
        userinfo: {
          get: jest.fn().mockResolvedValue(mockUserInfo)
        }
      };
      mockGoogle.oauth2.mockReturnValue(mockOAuth2 as any);

      // Mock database operations
      const { UserModel } = require('../../src/database/connection');
      UserModel.findByGoogleEmail.mockResolvedValue(null);
      UserModel.create.mockResolvedValue(mockUser);

      const result = await oauthService.exchangeCodeForTokens(code, codeVerifier, state);

      expect(result.user).toEqual(mockUser);
      expect(result.tokens).toEqual({
        access_token: mockTokens.access_token,
        refresh_token: mockTokens.refresh_token,
        expires_in: expect.any(Number),
        token_type: mockTokens.token_type,
        scope: mockTokens.scope
      });

      // Verify that credentials were set on the OAuth2Client
      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith(mockTokens);
      
      // Verify that a new OAuth2Client was created for the exchange
      expect(mockGoogle.auth.OAuth2).toHaveBeenCalledWith(
        config.google.clientId,
        config.google.clientSecret,
        config.google.redirectUri
      );

      // Verify user creation
      expect(UserModel.create).toHaveBeenCalledWith({
        id: BigInt('123456789012345678'),
        google_email: 'test@example.com',
        encrypted_refresh_token: 'encrypted_test_refresh_token',
        encrypted_access_token: 'encrypted_test_access_token',
        token_expires_at: expect.any(Date),
        is_active: true
      });
    });

    it('should handle invalid state parameter', async () => {
      const code = 'test_auth_code';
      const codeVerifier = 'test_code_verifier';
      const state = 'invalid_state';

      await expect(oauthService.exchangeCodeForTokens(code, codeVerifier, state))
        .rejects.toThrow('Invalid state parameter');
    });

    it('should handle missing tokens in response', async () => {
      const code = 'test_auth_code';
      const codeVerifier = 'test_code_verifier';
      const state = '123456789012345678:test_state';
      
      const mockTokens = {
        access_token: 'test_access_token',
        // Missing refresh_token
        expiry_date: Date.now() + 3600000,
        token_type: 'Bearer'
      };

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens });

      await expect(oauthService.exchangeCodeForTokens(code, codeVerifier, state))
        .rejects.toThrow('Invalid token response from Google');
    });
  });

  describe('getOAuth2Client', () => {
    it('should create fresh OAuth2Client with user credentials', async () => {
      const mockUser = {
        id: BigInt('123456789012345678'),
        google_email: 'test@example.com',
        encrypted_refresh_token: 'encrypted_test_refresh_token',
        encrypted_access_token: 'encrypted_test_access_token',
        token_expires_at: new Date(Date.now() + 3600000), // Future date
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true
      };

      const result = await oauthService.getOAuth2Client(mockUser);

      expect(result).toBe(mockOAuth2Client);
      expect(mockGoogle.auth.OAuth2).toHaveBeenCalledWith(
        config.google.clientId,
        config.google.clientSecret,
        config.google.redirectUri
      );
      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({
        access_token: 'test_access_token', // Decrypted
        refresh_token: 'test_refresh_token'  // Decrypted
      });
    });

    it('should refresh token if expired', async () => {
      const mockUser = {
        id: BigInt('123456789012345678'),
        google_email: 'test@example.com',
        encrypted_refresh_token: 'encrypted_test_refresh_token',
        encrypted_access_token: 'encrypted_test_access_token',
        token_expires_at: new Date(Date.now() - 3600000), // Past date
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true
      };

      const mockRefreshedTokens = {
        access_token: 'new_access_token',
        expiry_date: Date.now() + 3600000
      };

      mockOAuth2Client.refreshAccessToken.mockResolvedValue({
        credentials: mockRefreshedTokens
      });

      // Mock the refreshAccessToken method
      jest.spyOn(oauthService, 'refreshAccessToken').mockResolvedValue({
        accessToken: 'new_access_token',
        expiresAt: new Date()
      });

      const result = await oauthService.getOAuth2Client(mockUser);

      expect(result).toBe(mockOAuth2Client);
      expect(oauthService.refreshAccessToken).toHaveBeenCalledWith(mockUser);
      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({
        access_token: 'new_access_token'
      });
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh access token using refresh token', async () => {
      const mockUser = {
        id: BigInt('123456789012345678'),
        google_email: 'test@example.com',
        encrypted_refresh_token: 'encrypted_test_refresh_token',
        encrypted_access_token: 'encrypted_test_access_token',
        token_expires_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true
      };

      const mockRefreshedTokens = {
        access_token: 'new_access_token',
        expiry_date: Date.now() + 3600000
      };

      mockOAuth2Client.refreshAccessToken.mockResolvedValue({
        credentials: mockRefreshedTokens
      });

      // Mock database update
      const { UserModel } = require('../../src/database/connection');
      UserModel.update.mockResolvedValue(mockUser);

      const result = await oauthService.refreshAccessToken(mockUser);

      expect(result.accessToken).toBe('new_access_token');
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({
        refresh_token: 'test_refresh_token' // Decrypted
      });
      expect(UserModel.update).toHaveBeenCalledWith(mockUser.id, {
        encrypted_access_token: 'encrypted_new_access_token',
        token_expires_at: expect.any(Date)
      });
    });
  });
});
