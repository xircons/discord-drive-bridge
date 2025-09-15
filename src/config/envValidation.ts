import { z } from 'zod';

// Environment validation schema
const envSchema = z.object({
  // Discord Configuration
  DISCORD_TOKEN: z.string().min(1, 'Discord bot token is required'),
  DISCORD_CLIENT_ID: z.string().min(1, 'Discord client ID is required'),
  DISCORD_GUILD_ID: z.string().regex(/^\d{17,19}$/, 'Invalid Discord guild ID format'),
  
  // Google OAuth Configuration
  GOOGLE_CLIENT_ID: z.string().min(1, 'Google client ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'Google client secret is required'),
  GOOGLE_REDIRECT_URI: z.string().url('Invalid Google redirect URI format'),
  
  // Database Configuration
  DATABASE_URL: z.string().min(1, 'Database URL is required'),
  DATABASE_ENCRYPTION_KEY: z.string().min(32, 'Database encryption key must be at least 32 characters'),
  
  // Redis Configuration
  REDIS_URL: z.string().url('Invalid Redis URL format').optional().default('redis://localhost:6379'),
  
  // Security Configuration
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  RATE_LIMIT_WINDOW_MS: z.string().regex(/^\d+$/, 'Rate limit window must be a number').optional().default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().regex(/^\d+$/, 'Rate limit max must be a number').optional().default('100'),
  MAX_FILE_SIZE_MB: z.string().regex(/^\d+$/, 'Max file size must be a number').optional().default('100'),
  
  // Server Configuration
  PORT: z.string().regex(/^\d+$/, 'Port must be a number').optional().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).optional().default('development'),
  BASE_URL: z.string().url('Invalid base URL format').optional().default('http://localhost:3000'),
  
  // Logging Configuration
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).optional().default('info'),
  LOG_FILE: z.string().optional().default('logs/app.log'),
  
  // Google Drive Scopes
  GOOGLE_DRIVE_SCOPES: z.string().optional().default('https://www.googleapis.com/auth/drive,https://www.googleapis.com/auth/userinfo.email,https://www.googleapis.com/auth/userinfo.profile')
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnvironment(): EnvConfig {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join('\n');
      
      // Use process.stderr for error output instead of console
      process.stderr.write('❌ Environment validation failed:\n');
      process.stderr.write(errorMessages + '\n');
      process.stderr.write('\nPlease check your .env file and ensure all required variables are set correctly.\n');
      
      process.exit(1);
    }
    throw error;
  }
}

export default envSchema;
