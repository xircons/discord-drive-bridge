import crypto from 'crypto';
import { Logger } from '../utils/logger';
import { CacheService } from './cacheService';

export interface SecurityConfig {
  csrfTokenExpiry: number; // in seconds
  maxLoginAttempts: number;
  lockoutDuration: number; // in seconds
  sessionTimeout: number; // in seconds
  maxFileSize: number; // in bytes
  allowedFileTypes: string[];
  blockedFileTypes: string[];
  maxFileNameLength: number;
  maxFolderNameLength: number;
  maxSearchQueryLength: number;
}

export interface CSRFToken {
  token: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface SecurityEvent {
  type: 'login_attempt' | 'csrf_violation' | 'suspicious_activity' | 'rate_limit_exceeded' | 'file_upload_blocked';
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  details: Record<string, any>;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class SecurityService {
  private static instance: SecurityService;
  private cacheService: CacheService;
  private config: SecurityConfig;
  private securityEvents: SecurityEvent[] = [];
  private loginAttempts: Map<string, { count: number; lastAttempt: Date; lockedUntil?: Date }> = new Map();

  private constructor() {
    this.cacheService = CacheService.getInstance();
    this.config = {
      csrfTokenExpiry: 3600, // 1 hour
      maxLoginAttempts: 5,
      lockoutDuration: 900, // 15 minutes
      sessionTimeout: 7200, // 2 hours
      maxFileSize: 100 * 1024 * 1024, // 100MB
      allowedFileTypes: [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'text/plain', 'text/csv',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
        'audio/mpeg', 'audio/wav', 'audio/ogg',
        'video/mp4', 'video/avi', 'video/mov', 'video/wmv'
      ],
      blockedFileTypes: [
        'application/x-executable', 'application/x-msdownload',
        'application/x-msdos-program', 'application/x-msdos-windows',
        'application/x-winexe', 'application/x-msi',
        'application/x-ms-shortcut', 'application/x-ms-shortcut'
      ],
      maxFileNameLength: 255,
      maxFolderNameLength: 100,
      maxSearchQueryLength: 500
    };
  }

  public static getInstance(): SecurityService {
    if (!SecurityService.instance) {
      SecurityService.instance = new SecurityService();
    }
    return SecurityService.instance;
  }

  // CSRF Protection
  public generateCSRFToken(userId: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.config.csrfTokenExpiry * 1000);
    
    const csrfToken: CSRFToken = {
      token,
      userId,
      expiresAt,
      createdAt: new Date()
    };

    // Store token in cache
    this.cacheService.set(
      `csrf_token:${token}`,
      JSON.stringify(csrfToken),
      this.config.csrfTokenExpiry
    );

    Logger.debug('CSRF token generated', { userId, token: token.substring(0, 8) + '...' });
    return token;
  }

  public async validateCSRFToken(token: string, userId: string): Promise<boolean> {
    try {
      const tokenData = await this.cacheService.get(`csrf_token:${token}`);
      if (!tokenData) {
        this.recordSecurityEvent('csrf_violation', userId, {
          reason: 'Token not found',
          token: token.substring(0, 8) + '...'
        });
        return false;
      }

      const csrfToken: CSRFToken = JSON.parse(tokenData);
      
      if (csrfToken.userId !== userId) {
        this.recordSecurityEvent('csrf_violation', userId, {
          reason: 'User ID mismatch',
          expectedUserId: userId,
          tokenUserId: csrfToken.userId
        });
        return false;
      }

      if (csrfToken.expiresAt < new Date()) {
        this.recordSecurityEvent('csrf_violation', userId, {
          reason: 'Token expired',
          expiresAt: csrfToken.expiresAt
        });
        return false;
      }

      // Token is valid, remove it to prevent reuse
      await this.cacheService.del(`csrf_token:${token}`);
      return true;
    } catch (error) {
      Logger.error('CSRF token validation failed', error as Error, { userId, token: token.substring(0, 8) + '...' });
      return false;
    }
  }

  // Login Attempt Tracking
  public async checkLoginAttempts(userId: string, ipAddress?: string): Promise<{ allowed: boolean; remainingAttempts: number; lockedUntil?: Date }> {
    // const key = `login_attempts:${userId}`;
    const attempts = this.loginAttempts.get(userId);

    if (!attempts) {
      this.loginAttempts.set(userId, { count: 0, lastAttempt: new Date() });
      return { allowed: true, remainingAttempts: this.config.maxLoginAttempts };
    }

    // Check if user is locked out
    if (attempts.lockedUntil && attempts.lockedUntil > new Date()) {
      this.recordSecurityEvent('rate_limit_exceeded', userId, {
        reason: 'Account locked due to too many failed attempts',
        lockedUntil: attempts.lockedUntil,
        ipAddress
      });
      return { 
        allowed: false, 
        remainingAttempts: 0, 
        lockedUntil: attempts.lockedUntil 
      };
    }

    // Reset attempts if lockout period has passed
    if (attempts.lockedUntil && attempts.lockedUntil <= new Date()) {
      this.loginAttempts.set(userId, { count: 0, lastAttempt: new Date() });
      return { allowed: true, remainingAttempts: this.config.maxLoginAttempts };
    }

    const remainingAttempts = this.config.maxLoginAttempts - attempts.count;
    return { 
      allowed: attempts.count < this.config.maxLoginAttempts, 
      remainingAttempts: Math.max(0, remainingAttempts)
    };
  }

  public recordFailedLogin(userId: string, ipAddress?: string): void {
    const attempts = this.loginAttempts.get(userId) || { count: 0, lastAttempt: new Date() };
    attempts.count++;
    attempts.lastAttempt = new Date();

    if (attempts.count >= this.config.maxLoginAttempts) {
      attempts.lockedUntil = new Date(Date.now() + this.config.lockoutDuration * 1000);
      this.recordSecurityEvent('rate_limit_exceeded', userId, {
        reason: 'Maximum login attempts exceeded',
        attempts: attempts.count,
        lockedUntil: attempts.lockedUntil,
        ipAddress
      });
    }

    this.loginAttempts.set(userId, attempts);
  }

  public recordSuccessfulLogin(userId: string): void {
    this.loginAttempts.delete(userId);
  }

  // Input Sanitization
  public sanitizeInput(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }

    // Remove null bytes and control characters
    let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '');
    
    // Remove potential SQL injection patterns
    sanitized = sanitized.replace(/['";\\]/g, '');
    
    // Remove potential XSS patterns
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/on\w+\s*=/gi, '');
    
    // Trim whitespace
    sanitized = sanitized.trim();
    
    return sanitized;
  }

  public validateFileName(fileName: string): { valid: boolean; error?: string; sanitized?: string } {
    if (!fileName || typeof fileName !== 'string') {
      return { valid: false, error: 'File name is required' };
    }

    const sanitized = this.sanitizeInput(fileName);
    
    if (sanitized.length === 0) {
      return { valid: false, error: 'File name cannot be empty after sanitization' };
    }

    if (sanitized.length > this.config.maxFileNameLength) {
      return { valid: false, error: `File name too long (max ${this.config.maxFileNameLength} characters)` };
    }

    // Check for dangerous file extensions
    const extension = sanitized.split('.').pop()?.toLowerCase();
    const dangerousExtensions = ['exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar', 'sh'];
    
    if (extension && dangerousExtensions.includes(extension)) {
      return { valid: false, error: 'File type not allowed for security reasons' };
    }

    // Check for path traversal attempts
    if (sanitized.includes('..') || sanitized.includes('/') || sanitized.includes('\\')) {
      return { valid: false, error: 'File name contains invalid characters' };
    }

    return { valid: true, sanitized };
  }

  public validateFileType(mimeType: string): { valid: boolean; error?: string } {
    if (!mimeType || typeof mimeType !== 'string') {
      return { valid: false, error: 'MIME type is required' };
    }

    if (this.config.blockedFileTypes.includes(mimeType)) {
      return { valid: false, error: 'File type is blocked for security reasons' };
    }

    if (this.config.allowedFileTypes.length > 0 && !this.config.allowedFileTypes.includes(mimeType)) {
      return { valid: false, error: 'File type not allowed' };
    }

    return { valid: true };
  }

  public validateFileSize(size: number): { valid: boolean; error?: string } {
    if (typeof size !== 'number' || size < 0) {
      return { valid: false, error: 'Invalid file size' };
    }

    if (size > this.config.maxFileSize) {
      const maxSizeMB = Math.round(this.config.maxFileSize / 1024 / 1024);
      return { valid: false, error: `File too large (max ${maxSizeMB}MB)` };
    }

    return { valid: true };
  }

  public validateSearchQuery(query: string): { valid: boolean; error?: string; sanitized?: string } {
    if (!query || typeof query !== 'string') {
      return { valid: false, error: 'Search query is required' };
    }

    const sanitized = this.sanitizeInput(query);
    
    if (sanitized.length === 0) {
      return { valid: false, error: 'Search query cannot be empty after sanitization' };
    }

    if (sanitized.length > this.config.maxSearchQueryLength) {
      return { valid: false, error: `Search query too long (max ${this.config.maxSearchQueryLength} characters)` };
    }

    return { valid: true, sanitized };
  }

  // Security Event Recording
  public recordSecurityEvent(
    type: SecurityEvent['type'],
    userId: string,
    details: Record<string, any>,
    severity: SecurityEvent['severity'] = 'medium',
    ipAddress?: string,
    userAgent?: string
  ): void {
    const event: SecurityEvent = {
      type,
      userId,
      ipAddress,
      userAgent,
      details,
      timestamp: new Date(),
      severity
    };

    this.securityEvents.push(event);

    // Keep only last 1000 events in memory
    if (this.securityEvents.length > 1000) {
      this.securityEvents = this.securityEvents.slice(-1000);
    }

    // Log security event
    const logLevel = severity === 'critical' ? 'error' : 
                    severity === 'high' ? 'warn' : 'info';
    
    Logger[logLevel]('Security event recorded', new Error('Security event'), {
      eventType: type,
      userId,
      severity,
      details,
      ipAddress,
      userAgent
    });

    // For critical events, consider additional actions
    if (severity === 'critical') {
      this.handleCriticalSecurityEvent(event);
    }
  }

  private handleCriticalSecurityEvent(event: SecurityEvent): void {
    // In a production environment, you might want to:
    // - Send alerts to administrators
    // - Temporarily block the user
    // - Increase monitoring
    // - Log to external security systems
    
    Logger.error('Critical security event detected', new Error('Critical security event'), {
      eventType: event.type,
      userId: event.userId,
      severity: event.severity,
      details: event.details,
      action: 'Consider manual review'
    });
  }

  // Security Analytics
  public getSecurityStats(): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    recentEvents: SecurityEvent[];
    lockedAccounts: number;
  } {
    const eventsByType = this.securityEvents.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const eventsBySeverity = this.securityEvents.reduce((acc, event) => {
      acc[event.severity] = (acc[event.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const lockedAccounts = Array.from(this.loginAttempts.values())
      .filter(attempt => attempt.lockedUntil && attempt.lockedUntil > new Date()).length;

    return {
      totalEvents: this.securityEvents.length,
      eventsByType,
      eventsBySeverity,
      recentEvents: this.securityEvents.slice(-10),
      lockedAccounts
    };
  }

  // Cleanup expired data
  public cleanup(): void {
    const now = new Date();
    
    // Clean up expired login attempts
    for (const [userId, attempts] of this.loginAttempts.entries()) {
      if (attempts.lockedUntil && attempts.lockedUntil <= now) {
        this.loginAttempts.delete(userId);
      }
    }

    // Clean up old security events (keep last 24 hours)
    const cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    this.securityEvents = this.securityEvents.filter(event => event.timestamp > cutoffTime);
  }

  // Configuration management
  public updateConfig(updates: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...updates };
    Logger.info('Security configuration updated', { updates });
  }

  public getConfig(): SecurityConfig {
    return { ...this.config };
  }
}
