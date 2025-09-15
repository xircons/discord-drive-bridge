import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Mock the config module to avoid environment variable requirements
jest.mock('../src/config', () => ({
  config: {
    port: 3000,
    nodeEnv: 'test',
    baseUrl: 'http://localhost:3000',
    logLevel: 'error',
    logFile: 'logs/test.log',
    discord: {
      token: 'test_bot_token',
      clientId: '123456789012345678',
      guildId: '123456789012345678'
    },
    google: {
      clientId: 'test_google_client_id',
      clientSecret: 'test_google_client_secret',
      redirectUri: 'http://localhost:3000/auth/callback',
      scopes: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive.metadata.readonly']
    },
    database: {
      url: 'postgresql://test:test@localhost:5432/drivebot_test',
      encryptionKey: 'test_32_byte_hex_encryption_key_here_12345678901234567890123456789012',
      ssl: false,
      pool: {
        min: 2,
        max: 10,
        acquireTimeoutMillis: 30000,
        createTimeoutMillis: 30000,
        destroyTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 100
      }
    },
    security: {
      jwtSecret: 'test_jwt_secret_here',
      encryptionKey: 'test_32_byte_hex_encryption_key_here_12345678901234567890123456789012',
      rateLimit: {
        windowMs: 900000,
        max: 100,
        message: 'Rate limit exceeded',
        standardHeaders: true,
        legacyHeaders: false
      },
      maxFileSize: 104857600,
      allowedFileTypes: ['image/jpeg', 'image/png', 'text/plain', 'application/pdf'],
      blockedFileTypes: ['application/x-executable']
    }
  }
}));

// Mock console methods in tests to reduce noise
const originalConsole = { ...console };

beforeAll(() => {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
  console.info = jest.fn();
});

afterAll(() => {
  Object.assign(console, originalConsole);
});

// Global test timeout
jest.setTimeout(10000);
