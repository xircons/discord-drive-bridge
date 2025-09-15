import { OAuthService } from '../../src/services/oauthService';
import { UserModel } from '../../src/database/connection';
import { EncryptionService } from '../../src/utils/encryption';

// Mock Google APIs
jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        generateAuthUrl: jest.fn(),
        getToken: jest.fn(),
        setCredentials: jest.fn(),
        revokeToken: jest.fn(),
        refreshAccessToken: jest.fn()
      }))
    },
    oauth2: jest.fn(() => ({
      userinfo: {
        get: jest.fn()
      }
    }))
  }
}));

// Mock database
jest.mock('../../src/database/connection', () => ({
  UserModel: {
    create: jest.fn(),
    findById: jest.fn(),
    findByGoogleEmail: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deactivate: jest.fn()
  }
}));

const mockUserModel = UserModel as jest.Mocked<typeof UserModel>;

describe('OAuthService Integration', () => {
  let oauthService: OAuthService;
  const userId = BigInt('123456789012345678');
  const testEmail = 'test@example.com';

  beforeEach(() => {
    oauthService = new OAuthService();
    jest.clearAllMocks();
  });

  describe('generateAuthUrl', () => {
    it('should generate valid OAuth URL with PKCE', () => {
      const result = oauthService.generateAuthUrl(userId);

      expect(result.url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(result.url).toContain('code_challenge=');
      expect(result.url).toContain('code_challenge_method=S256');
      expect(result.url).toContain('state=');
      expect(result.url).toContain('access_type=offline');
      expect(result.url).toContain('prompt=consent');
      expect(result.codeVerifier).toHaveLength(64);
      expect(result.state).toHaveLength(32);
    });

    it('should include user ID in state parameter', () => {
      const result = oauthService.generateAuthUrl(userId);
      const stateParts = result.state.split(':');
      
      expect(stateParts[0]).toBe(userId.toString());
      expect(stateParts[1]).toHaveLength(32);
    });
  });

  describe('exchangeCodeForTokens', () => {
    const mockTokens = {
      access_token: 'mock_access_token',
      refresh_token: 'mock_refresh_token',
      expiry_date: Date.now() + 3600000,
      token_type: 'Bearer',
      scope: 'https://www.googleapis.com/auth/drive.file'
    };

    const mockUserInfo = {
      data: {
        id: 'google_user_id',
        email: testEmail,
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg'
      }
    };

    beforeEach(() => {
      // Mock OAuth2Client methods
      const mockOAuth2Client = {
        getToken: jest.fn().mockResolvedValue({ tokens: mockTokens }),
        setCredentials: jest.fn()
      };

      // Mock google.oauth2
      const mockOAuth2 = {
        userinfo: {
          get: jest.fn().mockResolvedValue(mockUserInfo)
        }
      };

      jest.doMock('googleapis', () => ({
        google: {
          auth: {
            OAuth2: jest.fn().mockReturnValue(mockOAuth2Client)
          },
          oauth2: jest.fn().mockReturnValue(mockOAuth2)
        }
      }));
    });

    it('should exchange code for tokens and create user', async () => {
      const code = 'mock_auth_code';
      const codeVerifier = EncryptionService.generateCodeVerifier();
      const state = `${userId}:${EncryptionService.generateRandomString(32)}`;

      const mockUser = {
        id: userId,
        google_email: testEmail,
        encrypted_refresh_token: 'encrypted_refresh',
        encrypted_access_token: 'encrypted_access',
        token_expires_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true
      };

      mockUserModel.findByGoogleEmail.mockResolvedValue(null);
      mockUserModel.create.mockResolvedValue(mockUser);

      const result = await oauthService.exchangeCodeForTokens(code, codeVerifier, state);

      expect(result.user).toEqual(mockUser);
      expect(result.tokens.access_token).toBe(mockTokens.access_token);
      expect(result.tokens.refresh_token).toBe(mockTokens.refresh_token);
      expect(mockUserModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: userId,
          google_email: testEmail,
          is_active: true
        })
      );
    });

    it('should update existing user', async () => {
      const code = 'mock_auth_code';
      const codeVerifier = EncryptionService.generateCodeVerifier();
      const state = `${userId}:${EncryptionService.generateRandomString(32)}`;

      const existingUser = {
        id: userId,
        google_email: testEmail,
        encrypted_refresh_token: 'old_encrypted_refresh',
        encrypted_access_token: 'old_encrypted_access',
        token_expires_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true
      };

      const updatedUser = {
        ...existingUser,
        encrypted_refresh_token: 'new_encrypted_refresh',
        encrypted_access_token: 'new_encrypted_access'
      };

      mockUserModel.findByGoogleEmail.mockResolvedValue(existingUser);
      mockUserModel.update.mockResolvedValue(updatedUser);

      const result = await oauthService.exchangeCodeForTokens(code, codeVerifier, state);

      expect(result.user).toEqual(updatedUser);
      expect(mockUserModel.update).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          google_email: testEmail,
          is_active: true
        })
      );
    });

    it('should handle invalid state parameter', async () => {
      const code = 'mock_auth_code';
      const codeVerifier = EncryptionService.generateCodeVerifier();
      const invalidState = 'invalid_state';

      await expect(
        oauthService.exchangeCodeForTokens(code, codeVerifier, invalidState)
      ).rejects.toThrow('Invalid state parameter');
    });

    it('should handle missing tokens in response', async () => {
      const code = 'mock_auth_code';
      const codeVerifier = EncryptionService.generateCodeVerifier();
      const state = `${userId}:${EncryptionService.generateRandomString(32)}`;

      // Mock OAuth2Client with missing tokens
      const mockOAuth2Client = {
        getToken: jest.fn().mockResolvedValue({ tokens: {} }),
        setCredentials: jest.fn()
      };

      jest.doMock('googleapis', () => ({
        google: {
          auth: {
            OAuth2: jest.fn().mockReturnValue(mockOAuth2Client)
          }
        }
      }));

      await expect(
        oauthService.exchangeCodeForTokens(code, codeVerifier, state)
      ).rejects.toThrow('Invalid token response from Google');
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh access token for user', async () => {
      const user = {
        id: userId,
        google_email: testEmail,
        encrypted_refresh_token: EncryptionService.encrypt('mock_refresh_token'),
        encrypted_access_token: EncryptionService.encrypt('old_access_token'),
        token_expires_at: new Date(Date.now() - 1000), // Expired
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true
      };

      const newTokens = {
        access_token: 'new_access_token',
        expiry_date: Date.now() + 3600000
      };

      const updatedUser = {
        ...user,
        encrypted_access_token: EncryptionService.encrypt('new_access_token'),
        token_expires_at: new Date()
      };

      mockUserModel.update.mockResolvedValue(updatedUser);

      // Mock OAuth2Client refresh
      const mockOAuth2Client = {
        setCredentials: jest.fn(),
        refreshAccessToken: jest.fn().mockResolvedValue({ credentials: newTokens })
      };

      jest.doMock('googleapis', () => ({
        google: {
          auth: {
            OAuth2: jest.fn().mockReturnValue(mockOAuth2Client)
          }
        }
      }));

      const result = await oauthService.refreshAccessToken(user);

      expect(result.accessToken).toBe('new_access_token');
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(mockUserModel.update).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          encrypted_access_token: expect.any(String),
          token_expires_at: expect.any(Date)
        })
      );
    });

    it('should handle refresh failure', async () => {
      const user = {
        id: userId,
        google_email: testEmail,
        encrypted_refresh_token: EncryptionService.encrypt('mock_refresh_token'),
        encrypted_access_token: EncryptionService.encrypt('old_access_token'),
        token_expires_at: new Date(Date.now() - 1000),
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true
      };

      // Mock OAuth2Client refresh failure
      const mockOAuth2Client = {
        setCredentials: jest.fn(),
        refreshAccessToken: jest.fn().mockRejectedValue(new Error('Refresh failed'))
      };

      jest.doMock('googleapis', () => ({
        google: {
          auth: {
            OAuth2: jest.fn().mockReturnValue(mockOAuth2Client)
          }
        }
      }));

      await expect(oauthService.refreshAccessToken(user)).rejects.toThrow('Refresh failed');
    });
  });

  describe('revokeTokens', () => {
    it('should revoke tokens and deactivate user', async () => {
      const user = {
        id: userId,
        google_email: testEmail,
        encrypted_refresh_token: EncryptionService.encrypt('mock_refresh_token'),
        encrypted_access_token: EncryptionService.encrypt('mock_access_token'),
        token_expires_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true
      };

      mockUserModel.deactivate.mockResolvedValue(true);

      // Mock OAuth2Client revoke
      const mockOAuth2Client = {
        revokeToken: jest.fn().mockResolvedValue(undefined)
      };

      jest.doMock('googleapis', () => ({
        google: {
          auth: {
            OAuth2: jest.fn().mockReturnValue(mockOAuth2Client)
          }
        }
      }));

      await oauthService.revokeTokens(user);

      expect(mockUserModel.deactivate).toHaveBeenCalledWith(userId);
    });
  });
});
