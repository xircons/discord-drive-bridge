// Global setup for tests - runs once before all tests
export default async function globalSetup() {
  console.log('🧪 Setting up test environment...');
  
  // Ensure test environment variables are set
  process.env.NODE_ENV = 'test';
  process.env.PORT = '3001';
  
  // Mock external services to prevent interference
  process.env.REDIS_URL = 'redis://localhost:6379/1';
  process.env.DB_NAME = 'discord_drive_test';
  
  console.log('✅ Test environment setup complete');
}
