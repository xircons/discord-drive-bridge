import dotenv from 'dotenv';
import { AppConfig, SecurityConfig, DatabaseConfig, DiscordConfig, GoogleConfig } from '../types';
import { validateEnvironment } from './envValidation';

dotenv.config();

// Validate environment variables with zod
const env = validateEnvironment();

const securityConfig: SecurityConfig = {
  jwtSecret: env.JWT_SECRET,
  encryptionKey: env.DATABASE_ENCRYPTION_KEY,
  rateLimit: {
    windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS),
    max: parseInt(env.RATE_LIMIT_MAX_REQUESTS),
    message: 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
  },
  maxFileSize: parseInt(env.MAX_FILE_SIZE_MB) * 1024 * 1024, // Convert MB to bytes
  allowedFileTypes: [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'text/plain', 'text/csv', 'application/json',
    'application/pdf', 'application/zip', 'application/x-zip-compressed',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ],
  blockedFileTypes: [
    'application/x-executable', 'application/x-msdownload',
    'application/x-msdos-program', 'application/x-winexe',
    'application/x-msi', 'application/x-ms-shortcut'
  ]
};

const databaseConfig: DatabaseConfig = {
  url: env.DATABASE_URL,
  encryptionKey: env.DATABASE_ENCRYPTION_KEY,
  ssl: env.NODE_ENV === 'production',
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
};

const discordConfig: DiscordConfig = {
  token: env.DISCORD_TOKEN,
  clientId: env.DISCORD_CLIENT_ID,
  guildId: env.DISCORD_GUILD_ID
};

const googleConfig: GoogleConfig = {
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  redirectUri: env.GOOGLE_REDIRECT_URI,
  scopes: env.GOOGLE_DRIVE_SCOPES.split(',')
};

export const config: AppConfig = {
  port: parseInt(env.PORT),
  nodeEnv: env.NODE_ENV,
  baseUrl: env.BASE_URL,
  logLevel: env.LOG_LEVEL,
  logFile: env.LOG_FILE,
  discord: discordConfig,
  google: googleConfig,
  database: databaseConfig,
  security: securityConfig
};

export default config;
