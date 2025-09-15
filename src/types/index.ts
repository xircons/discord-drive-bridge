export interface User {
  id: bigint;
  google_email: string;
  encrypted_refresh_token: string;
  encrypted_access_token: string;
  token_expires_at: Date;
  created_at: Date;
  updated_at: Date;
  is_active: boolean;
}

export interface AuditLog {
  id: number;
  user_id: bigint;
  action: string;
  resource_type: string;
  resource_name: string;
  success: boolean;
  error_message?: string;
  ip_address?: string;
  created_at: Date;
}

export interface RateLimit {
  user_id: bigint;
  command: string;
  count: number;
  window_start: Date;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime: string;
  parents?: string[];
  webViewLink?: string;
  webContentLink?: string;
}

export interface GoogleDriveFolder {
  id: string;
  name: string;
  mimeType: 'application/vnd.google-apps.folder';
  modifiedTime: string;
  parents?: string[];
  webViewLink?: string;
}

export interface CommandContext {
  user: User;
  interaction: any; // Discord.js Interaction
  command: string;
  parameters: Record<string, any>;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  timestamp: string;
}

export interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface FileUploadOptions {
  folderId?: string;
  fileName: string;
  mimeType: string;
  fileData: Buffer;
  description?: string;
}

export interface FileDownloadOptions {
  fileId: string;
  fileName: string;
  mimeType: string;
}

export interface SearchOptions {
  query: string;
  folderId?: string;
  mimeType?: string;
  pageSize?: number;
  pageToken?: string;
  maxResults?: number;
}

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
  standardHeaders: boolean;
  legacyHeaders: boolean;
}

export interface SecurityConfig {
  jwtSecret: string;
  encryptionKey: string;
  rateLimit: RateLimitConfig;
  maxFileSize: number;
  allowedFileTypes: string[];
  blockedFileTypes: string[];
}

export interface DatabaseConfig {
  url: string;
  encryptionKey: string;
  ssl: boolean;
  pool: {
    min: number;
    max: number;
    acquireTimeoutMillis: number;
    createTimeoutMillis: number;
    destroyTimeoutMillis: number;
    idleTimeoutMillis: number;
    reapIntervalMillis: number;
    createRetryIntervalMillis: number;
  };
}

export interface DiscordConfig {
  token: string;
  clientId: string;
  guildId: string;
}

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  baseUrl: string;
  logLevel: string;
  logFile: string;
  discord: DiscordConfig;
  google: GoogleConfig;
  database: DatabaseConfig;
  security: SecurityConfig;
}
