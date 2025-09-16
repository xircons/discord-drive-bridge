// Test configuration to prevent interference with main application
export const testConfig = {
  NODE_ENV: 'test',
  PORT: 3001,
  LOG_LEVEL: 'error',
  
  // Discord Test Configuration
  DISCORD_TOKEN: 'test_discord_token',
  DISCORD_CLIENT_ID: 'test_discord_client_id',
  DISCORD_GUILD_ID: '123456789012345678',
  
  // Google Drive Test Configuration
  GOOGLE_CLIENT_ID: 'test_google_client_id',
  GOOGLE_CLIENT_SECRET: 'test_google_client_secret',
  GOOGLE_REDIRECT_URI: 'http://localhost:3001/auth/callback',
  
  // Security Test Configuration
  JWT_SECRET: 'test_jwt_secret_32_characters_long',
  DATABASE_ENCRYPTION_KEY: 'test_database_encryption_key_32_chars',
  
  // Database Test Configuration
  DB_HOST: 'localhost',
  DB_PORT: '3306',
  DB_NAME: 'discord_drive_test',
  DB_USER: 'test_user',
  DB_PASSWORD: 'test_password',
  
  // Redis Test Configuration
  REDIS_URL: 'redis://localhost:6379/1',
  
  // Disable external services for tests
  DISABLE_DISCORD_BOT: true,
  DISABLE_GOOGLE_DRIVE: true,
  DISABLE_REDIS: true,
  DISABLE_DATABASE: true
};

// Apply test configuration to process.env
Object.assign(process.env, testConfig);
