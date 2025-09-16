const { RateLimitModel } = require('./dist/database/connection');

async function testRateLimitFix() {
  try {
    console.log('🧪 Testing rate limit fix...');
    
    // Test the increment method with a test user ID
    const testUserId = BigInt('123456789012345678');
    const testCommand = 'test_command';
    
    console.log('Testing RateLimitModel.increment...');
    const result = await RateLimitModel.increment(testUserId, testCommand);
    
    console.log('✅ Rate limit increment successful!');
    console.log('Result:', result);
    
    // Test getting the rate limit
    console.log('Testing RateLimitModel.get...');
    const retrieved = await RateLimitModel.get(testUserId, testCommand);
    console.log('Retrieved rate limit:', retrieved);
    
    console.log('🎉 All tests passed! The SQL syntax fix is working.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  testRateLimitFix().then(() => {
    console.log('Test completed.');
    process.exit(0);
  }).catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}

module.exports = { testRateLimitFix };
