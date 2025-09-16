// Mock environment variables for tests to prevent interference with main app
process.env.NODE_ENV = 'test';
process.env.PORT = '3001'; // Use different port for tests
process.env.DISCORD_TOKEN = 'test_discord_token';
process.env.DISCORD_CLIENT_ID = 'test_discord_client_id';
process.env.DISCORD_GUILD_ID = '123456789012345678';
process.env.GOOGLE_CLIENT_ID = 'test_google_client_id';
process.env.GOOGLE_CLIENT_SECRET = 'test_google_client_secret';
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3001/auth/callback';
process.env.JWT_SECRET = 'test_jwt_secret_32_characters_long';
process.env.DATABASE_ENCRYPTION_KEY = 'test_database_encryption_key_32_chars';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '3306';
process.env.DB_NAME = 'discord_drive_test';
process.env.DB_USER = 'test_user';
process.env.DB_PASSWORD = 'test_password';
process.env.REDIS_URL = 'redis://localhost:6379/1'; // Use different Redis DB
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
