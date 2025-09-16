import { OAuthService } from '../../src/services/oauthService';
import { UserModel } from '../../src/database/connection';
// import { CacheService } from '../../src/services/cacheService';
import { EncryptionService } from '../../src/utils/encryption';
import { Logger } from '../../src/utils/logger';

// Mock dependencies
jest.mock('../../src/database/connection');
jest.mock('../../src/services/cacheService');
jest.mock('../../src/utils/encryption');
jest.mock('../../src/utils/logger');
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    generateAuthUrl: jest.fn(),
    getToken: jest.fn(),
    setCredentials: jest.fn(),
    revokeToken: jest.fn(),
    getAccessToken: jest.fn(),
    on: jest.fn()
  }))
}));

const mockUserModel = UserModel as jest.Mocked<typeof UserModel>;
// Mock CacheService properly
jest.mock('../../src/services/cacheService', () => ({
  CacheService: {
    getInstance: jest.fn().mockReturnValue({
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      setJson: jest.fn(),
      getJson: jest.fn()
    })
  }
}));
const mockEncryptionService = EncryptionService as jest.Mocked<typeof EncryptionService>;
// const mockLogger = Logger as jest.Mocked<typeof Logger>;

describe('OAuthService', () => {
  let oauthService: OAuthService;
  let mockOAuth2Client: any;
  // let mockCache: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock OAuth2Client
    mockOAuth2Client = {
      generateAuthUrl: jest.fn(),
      getToken: jest.fn(),
      setCredentials: jest.fn(),
      revokeToken: jest.fn(),
      getAccessToken: jest.fn(),
      on: jest.fn()
    };
    
    const { OAuth2Client } = require('google-auth-library');
    OAuth2Client.mockImplementation(() => mockOAuth2Client);
    
    // Mock Cache Service
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn()
    };
    // Cache service is already mocked above
    
    oauthService = new OAuthService();
  });

  describe('generateAuthUrl', () => {
    it('should generate OAuth URL with PKCE', () => {
      const userId = BigInt('123456789012345678');
      const mockUrl = 'https://accounts.google.com/oauth/authorize?client_id=test&code_challenge=test';
      
      mockOAuth2Client.generateAuthUrl.mockReturnValue(mockUrl);
      
      const result = oauthService.generateAuthUrl(userId);
      
      expect(result.url).toBe(mockUrl);
      expect(result.codeVerifier).toBeDefined();
      expect(result.state).toBeDefined();
      expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalledWith({
        access_type: 'offline',
        scope: expect.any(Array),
        state: expect.any(String),
        code_challenge: expect.any(String),
        code_challenge_method: 'S256',
        prompt: 'consent'
      });
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('should exchange code for tokens successfully', async () => {
      const code = 'test-code';
      const codeVerifier = 'code-verifier';
      const state = '123456789012345678:state-token';
      
      const mockTokens = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expiry_date: Date.now() + 3600000,
        token_type: 'Bearer'
      };
      
      const mockUserInfo = {
        data: {
          id: 'google-user-id',
          email: 'test@example.com',
          name: 'Test User'
        }
      };
      
      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens });
      mockOAuth2Client.setCredentials.mockImplementation(() => {
        mockOAuth2Client.request = jest.fn().mockResolvedValue(mockUserInfo);
      });
      mockEncryptionService.encrypt.mockReturnValue('encrypted-token');
      mockUserModel.create.mockResolvedValue({
        id: BigInt('123456789012345678'),
        google_email: 'test@example.com',
        encrypted_refresh_token: 'encrypted-refresh',
        encrypted_access_token: 'encrypted-access',
        token_expires_at: new Date(mockTokens.expiry_date),
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true
      });
      
      const result = await oauthService.exchangeCodeForTokens(code, codeVerifier, state);
      
      expect(result).toMatchObject({
        user: expect.objectContaining({
          google_email: 'test@example.com'
        }),
        tokens: expect.any(Object)
      });
      
      expect(mockOAuth2Client.getToken).toHaveBeenCalledWith({
        code,
        code_verifier: codeVerifier
      });
    });

    it('should handle invalid state', async () => {
      const code = 'test-code';
      const codeVerifier = 'code-verifier';
      const state = 'invalid-state';
      
      await expect(oauthService.exchangeCodeForTokens(code, codeVerifier, state))
        .rejects.toThrow('Invalid state parameter');
    });
  });

  describe('verifyToken', () => {
    it('should return true for valid token', async () => {
      const mockUser = {
        id: BigInt('123456789012345678'),
        google_email: 'test@example.com',
        encrypted_refresh_token: 'encrypted-refresh',
        encrypted_access_token: 'encrypted-access',
        token_expires_at: new Date(Date.now() + 3600000),
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true
      };
      
      const result = await oauthService.verifyToken(mockUser);
      
      expect(result).toBe(true);
    });

    it('should return false for expired token', async () => {
      const mockUser = {
        id: BigInt('123456789012345678'),
        google_email: 'test@example.com',
        encrypted_refresh_token: 'encrypted-refresh',
        encrypted_access_token: 'encrypted-access',
        token_expires_at: new Date(Date.now() - 3600000), // Expired
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true
      };
      
      const result = await oauthService.verifyToken(mockUser);
      
      expect(result).toBe(false);
    });
  });

  describe('getOAuth2Client', () => {
    it('should return OAuth2Client for authenticated user', async () => {
      const mockUser = {
        id: BigInt('123456789012345678'),
        google_email: 'test@example.com',
        encrypted_refresh_token: 'encrypted-refresh',
        encrypted_access_token: 'encrypted-access',
        token_expires_at: new Date(Date.now() + 3600000),
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true
      };
      
      mockEncryptionService.decrypt.mockReturnValue('decrypted-token');
      
      const result = await oauthService.getOAuth2Client(mockUser);
      
      expect(result).toBeDefined();
      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({
        access_token: 'decrypted-token',
        refresh_token: 'decrypted-token'
      });
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh access token successfully', async () => {
      const mockUser = {
        id: BigInt('123456789012345678'),
        google_email: 'test@example.com',
        encrypted_refresh_token: 'encrypted-refresh',
        encrypted_access_token: 'encrypted-access',
        token_expires_at: new Date(Date.now() + 3600000),
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true
      };
      
      const newTokens = {
        access_token: 'new-access-token',
        expiry_date: Date.now() + 3600000,
        token_type: 'Bearer'
      };
      
      mockEncryptionService.decrypt.mockReturnValue('decrypted-refresh-token');
      mockOAuth2Client.setCredentials.mockImplementation(() => {
        mockOAuth2Client.refreshAccessToken = jest.fn().mockResolvedValue({
          credentials: newTokens
        });
      });
      mockEncryptionService.encrypt.mockReturnValue('encrypted-new-token');
      mockUserModel.findByPk.mockResolvedValue(mockUser);
      
      const result = await oauthService.refreshAccessToken(mockUser);
      
      expect(result).toMatchObject({
        accessToken: 'new-access-token',
        expiresAt: expect.any(Date)
      });
      expect(mockUserModel.update).toHaveBeenCalledWith(
        mockUser.id,
        'encrypted-new-token',
        expect.any(Date)
      );
    });
  });

  describe('revokeTokens', () => {
    it('should revoke user tokens successfully', async () => {
      const mockUser = {
        id: BigInt('123456789012345678'),
        google_email: 'test@example.com',
        encrypted_refresh_token: 'encrypted-refresh',
        encrypted_access_token: 'encrypted-access',
        token_expires_at: new Date(Date.now() + 3600000),
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true
      };
      
      mockEncryptionService.decrypt.mockReturnValue('decrypted-token');
      mockOAuth2Client.setCredentials.mockImplementation(() => {
        mockOAuth2Client.revokeToken = jest.fn().mockResolvedValue({});
      });
      mockUserModel.delete.mockResolvedValue(true);
      
      await oauthService.revokeTokens(mockUser);
      
      expect(mockUserModel.delete).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('getUserInfo', () => {
    it('should return user info for authenticated user', async () => {
      const mockUser = {
        id: BigInt('123456789012345678'),
        google_email: 'test@example.com',
        encrypted_refresh_token: 'encrypted-refresh',
        encrypted_access_token: 'encrypted-access',
        token_expires_at: new Date(Date.now() + 3600000),
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true
      };
      
      const result = await oauthService.getUserInfo(mockUser);
      
      expect(result).toMatchObject({
        id: mockUser.id.toString(),
        email: 'test@example.com',
        isAuthenticated: true
      });
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully', async () => {
      const mockUser = {
        id: BigInt('123456789012345678'),
        google_email: 'test@example.com',
        encrypted_refresh_token: 'encrypted-refresh',
        encrypted_access_token: 'encrypted-access',
        token_expires_at: new Date(Date.now() + 3600000),
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true
      };
      
      const error = new Error('Database error');
      mockEncryptionService.decrypt.mockImplementation(() => { throw error; });
      
      await expect(oauthService.getOAuth2Client(mockUser))
        .rejects.toThrow('Database error');
    });
  });
});
