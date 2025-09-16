// Global teardown for tests - runs once after all tests
export default async function globalTeardown() {
  console.log('🧹 Cleaning up test environment...');
  
  // Clean up any test-specific resources
  // (Redis connections, test databases, etc.)
  
  console.log('✅ Test environment cleanup complete');
}
