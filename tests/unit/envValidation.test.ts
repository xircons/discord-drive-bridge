import { validateEnvironment } from '../../src/config/envValidation';
import envSchema from '../../src/config/envValidation';

describe('Environment Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('validateEnvironment', () => {
    it('should validate correct environment variables', () => {
      process.env = {
        DISCORD_TOKEN: 'test_discord_token',
        DISCORD_CLIENT_ID: 'test_client_id',
        DISCORD_GUILD_ID: '123456789012345678',
        GOOGLE_CLIENT_ID: 'test_google_client_id',
        GOOGLE_CLIENT_SECRET: 'test_google_client_secret',
        GOOGLE_REDIRECT_URI: 'https://example.com/auth/callback',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        DATABASE_ENCRYPTION_KEY: 'a'.repeat(32),
        JWT_SECRET: 'a'.repeat(32)
      };

      const result = validateEnvironment();

      expect(result.DISCORD_TOKEN).toBe('test_discord_token');
      expect(result.DISCORD_CLIENT_ID).toBe('test_client_id');
      expect(result.DISCORD_GUILD_ID).toBe('123456789012345678');
      expect(result.GOOGLE_CLIENT_ID).toBe('test_google_client_id');
      expect(result.GOOGLE_CLIENT_SECRET).toBe('test_google_client_secret');
      expect(result.GOOGLE_REDIRECT_URI).toBe('https://example.com/auth/callback');
      expect(result.DATABASE_URL).toBe('postgresql://user:pass@localhost:5432/db');
      expect(result.DATABASE_ENCRYPTION_KEY).toBe('a'.repeat(32));
      expect(result.JWT_SECRET).toBe('a'.repeat(32));
    });

    it('should use default values for optional variables', () => {
      process.env = {
        DISCORD_TOKEN: 'test_discord_token',
        DISCORD_CLIENT_ID: 'test_client_id',
        DISCORD_GUILD_ID: '123456789012345678',
        GOOGLE_CLIENT_ID: 'test_google_client_id',
        GOOGLE_CLIENT_SECRET: 'test_google_client_secret',
        GOOGLE_REDIRECT_URI: 'https://example.com/auth/callback',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        DATABASE_ENCRYPTION_KEY: 'a'.repeat(32),
        JWT_SECRET: 'a'.repeat(32)
      };

      const result = validateEnvironment();

      expect(result.REDIS_URL).toBe('redis://localhost:6379');
      expect(result.PORT).toBe('3000');
      expect(result.NODE_ENV).toBe('development');
      expect(result.BASE_URL).toBe('http://localhost:3000');
      expect(result.LOG_LEVEL).toBe('info');
      expect(result.LOG_FILE).toBe('logs/app.log');
    });

    it('should throw error for missing required variables', () => {
      process.env = {
        // Missing DISCORD_TOKEN
        DISCORD_CLIENT_ID: 'test_client_id',
        DISCORD_GUILD_ID: '123456789012345678',
        GOOGLE_CLIENT_ID: 'test_google_client_id',
        GOOGLE_CLIENT_SECRET: 'test_google_client_secret',
        GOOGLE_REDIRECT_URI: 'https://example.com/auth/callback',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        DATABASE_ENCRYPTION_KEY: 'a'.repeat(32),
        JWT_SECRET: 'a'.repeat(32)
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const processSpy = jest.spyOn(process, 'exit').mockImplementation();

      expect(() => validateEnvironment()).toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('❌ Environment validation failed:');
      expect(processSpy).toHaveBeenCalledWith(1);

      consoleSpy.mockRestore();
      processSpy.mockRestore();
    });

    it('should throw error for invalid Discord guild ID format', () => {
      process.env = {
        DISCORD_TOKEN: 'test_discord_token',
        DISCORD_CLIENT_ID: 'test_client_id',
        DISCORD_GUILD_ID: 'invalid_guild_id', // Invalid format
        GOOGLE_CLIENT_ID: 'test_google_client_id',
        GOOGLE_CLIENT_SECRET: 'test_google_client_secret',
        GOOGLE_REDIRECT_URI: 'https://example.com/auth/callback',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        DATABASE_ENCRYPTION_KEY: 'a'.repeat(32),
        JWT_SECRET: 'a'.repeat(32)
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const processSpy = jest.spyOn(process, 'exit').mockImplementation();

      expect(() => validateEnvironment()).toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('❌ Environment validation failed:');
      expect(processSpy).toHaveBeenCalledWith(1);

      consoleSpy.mockRestore();
      processSpy.mockRestore();
    });

    it('should throw error for invalid URL format', () => {
      process.env = {
        DISCORD_TOKEN: 'test_discord_token',
        DISCORD_CLIENT_ID: 'test_client_id',
        DISCORD_GUILD_ID: '123456789012345678',
        GOOGLE_CLIENT_ID: 'test_google_client_id',
        GOOGLE_CLIENT_SECRET: 'test_google_client_secret',
        GOOGLE_REDIRECT_URI: 'invalid_url', // Invalid URL
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        DATABASE_ENCRYPTION_KEY: 'a'.repeat(32),
        JWT_SECRET: 'a'.repeat(32)
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const processSpy = jest.spyOn(process, 'exit').mockImplementation();

      expect(() => validateEnvironment()).toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('❌ Environment validation failed:');
      expect(processSpy).toHaveBeenCalledWith(1);

      consoleSpy.mockRestore();
      processSpy.mockRestore();
    });

    it('should throw error for insufficient encryption key length', () => {
      process.env = {
        DISCORD_TOKEN: 'test_discord_token',
        DISCORD_CLIENT_ID: 'test_client_id',
        DISCORD_GUILD_ID: '123456789012345678',
        GOOGLE_CLIENT_ID: 'test_google_client_id',
        GOOGLE_CLIENT_SECRET: 'test_google_client_secret',
        GOOGLE_REDIRECT_URI: 'https://example.com/auth/callback',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        DATABASE_ENCRYPTION_KEY: 'short', // Too short
        JWT_SECRET: 'a'.repeat(32)
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const processSpy = jest.spyOn(process, 'exit').mockImplementation();

      expect(() => validateEnvironment()).toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('❌ Environment validation failed:');
      expect(processSpy).toHaveBeenCalledWith(1);

      consoleSpy.mockRestore();
      processSpy.mockRestore();
    });

    it('should validate NODE_ENV enum values', () => {
      const validEnvs = ['development', 'production', 'test'];
      
      validEnvs.forEach(env => {
        process.env = {
          DISCORD_TOKEN: 'test_discord_token',
          DISCORD_CLIENT_ID: 'test_client_id',
          DISCORD_GUILD_ID: '123456789012345678',
          GOOGLE_CLIENT_ID: 'test_google_client_id',
          GOOGLE_CLIENT_SECRET: 'test_google_client_secret',
          GOOGLE_REDIRECT_URI: 'https://example.com/auth/callback',
          DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
          DATABASE_ENCRYPTION_KEY: 'a'.repeat(32),
          JWT_SECRET: 'a'.repeat(32),
          NODE_ENV: env
        };

        expect(() => validateEnvironment()).not.toThrow();
      });
    });

    it('should throw error for invalid NODE_ENV value', () => {
      process.env = {
        DISCORD_TOKEN: 'test_discord_token',
        DISCORD_CLIENT_ID: 'test_client_id',
        DISCORD_GUILD_ID: '123456789012345678',
        GOOGLE_CLIENT_ID: 'test_google_client_id',
        GOOGLE_CLIENT_SECRET: 'test_google_client_secret',
        GOOGLE_REDIRECT_URI: 'https://example.com/auth/callback',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        DATABASE_ENCRYPTION_KEY: 'a'.repeat(32),
        JWT_SECRET: 'a'.repeat(32),
        NODE_ENV: 'invalid_env' // Invalid value
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const processSpy = jest.spyOn(process, 'exit').mockImplementation();

      expect(() => validateEnvironment()).toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('❌ Environment validation failed:');
      expect(processSpy).toHaveBeenCalledWith(1);

      consoleSpy.mockRestore();
      processSpy.mockRestore();
    });
  });

  describe('envSchema', () => {
    it('should parse valid environment data', () => {
      const validEnv = {
        DISCORD_TOKEN: 'test_discord_token',
        DISCORD_CLIENT_ID: 'test_client_id',
        DISCORD_GUILD_ID: '123456789012345678',
        GOOGLE_CLIENT_ID: 'test_google_client_id',
        GOOGLE_CLIENT_SECRET: 'test_google_client_secret',
        GOOGLE_REDIRECT_URI: 'https://example.com/auth/callback',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        DATABASE_ENCRYPTION_KEY: 'a'.repeat(32),
        JWT_SECRET: 'a'.repeat(32)
      };

      const result = envSchema.parse(validEnv);
      expect(result).toEqual(expect.objectContaining(validEnv));
    });

    it('should reject invalid data', () => {
      const invalidEnv = {
        DISCORD_TOKEN: '', // Empty string
        DISCORD_CLIENT_ID: 'test_client_id',
        DISCORD_GUILD_ID: 'invalid_guild_id',
        GOOGLE_CLIENT_ID: 'test_google_client_id',
        GOOGLE_CLIENT_SECRET: 'test_google_client_secret',
        GOOGLE_REDIRECT_URI: 'invalid_url',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        DATABASE_ENCRYPTION_KEY: 'short',
        JWT_SECRET: 'a'.repeat(32)
      };

      expect(() => envSchema.parse(invalidEnv)).toThrow();
    });
  });
});
