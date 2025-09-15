import { Request, Response, NextFunction } from 'express';
import { SecurityService } from '../services/securityService';
import { Logger } from '../utils/logger';

export interface SecureRequest extends Request {
  securityContext?: {
    userId?: string;
    ipAddress: string;
    userAgent: string;
    isAuthenticated: boolean;
  };
}

export class SecurityMiddleware {
  private static securityService: SecurityService;

  static {
    this.securityService = SecurityService.getInstance();
  }

  // Request sanitization middleware
  static sanitizeRequest(req: SecureRequest, res: Response, next: NextFunction): void {
    try {
      // Sanitize query parameters
      if (req.query) {
        for (const [key, value] of Object.entries(req.query)) {
          if (typeof value === 'string') {
            req.query[key] = SecurityMiddleware.securityService.sanitizeInput(value);
          }
        }
      }

      // Sanitize body parameters
      if (req.body && typeof req.body === 'object') {
        SecurityMiddleware.sanitizeObject(req.body);
      }

      // Sanitize URL parameters
      if (req.params) {
        for (const [key, value] of Object.entries(req.params)) {
          if (typeof value === 'string') {
            req.params[key] = SecurityMiddleware.securityService.sanitizeInput(value);
          }
        }
      }

      next();
    } catch (error) {
      Logger.error('Request sanitization failed', error as Error);
      res.status(400).json({ error: 'Invalid request data' });
    }
  }

  // Security context middleware
  static addSecurityContext(req: SecureRequest, _res: Response, next: NextFunction): void {
    const ipAddress = SecurityMiddleware.getClientIP(req);
    const userAgent = req.get('User-Agent') || 'Unknown';
    const userId = SecurityMiddleware.extractUserId(req);

    req.securityContext = {
      userId,
      ipAddress,
      userAgent,
      isAuthenticated: !!userId
    };

    next();
  }

  // CSRF protection middleware
  static csrfProtection(req: SecureRequest, res: Response, next: NextFunction): void {
    // Skip CSRF for GET requests and health checks
    if (req.method === 'GET' || req.path === '/health' || req.path === '/metrics') {
      return next();
    }

    const userId = req.securityContext?.userId;
    if (!userId) {
      return next(); // Let authentication middleware handle this
    }

    const csrfToken = req.headers['x-csrf-token'] as string;
    if (!csrfToken) {
      SecurityMiddleware.securityService.recordSecurityEvent(
        'csrf_violation',
        userId,
        { reason: 'Missing CSRF token', path: req.path, method: req.method },
        'high',
        req.securityContext?.ipAddress,
        req.securityContext?.userAgent
      );
      res.status(403).json({ error: 'CSRF token required' });
      return;
    }

    SecurityMiddleware.securityService.validateCSRFToken(csrfToken, userId)
      .then(isValid => {
        if (!isValid) {
          SecurityMiddleware.securityService.recordSecurityEvent(
            'csrf_violation',
            userId,
            { reason: 'Invalid CSRF token', path: req.path, method: req.method },
            'high',
            req.securityContext?.ipAddress,
            req.securityContext?.userAgent
          );
          res.status(403).json({ error: 'Invalid CSRF token' });
          return;
        }
        next();
      })
      .catch(error => {
        Logger.error('CSRF validation error', error as Error);
        res.status(500).json({ error: 'Security validation failed' });
      });
  }

  // Rate limiting for authentication endpoints
  static authRateLimit(req: SecureRequest, res: Response, next: NextFunction): void {
    const userId = req.securityContext?.userId;
    if (!userId) {
      return next();
    }

    SecurityMiddleware.securityService.checkLoginAttempts(userId, req.securityContext?.ipAddress)
      .then(result => {
        if (!result.allowed) {
          SecurityMiddleware.securityService.recordSecurityEvent(
            'rate_limit_exceeded',
            userId,
            { 
              reason: 'Authentication rate limit exceeded',
              remainingAttempts: result.remainingAttempts,
              lockedUntil: result.lockedUntil
            },
            'high',
            req.securityContext?.ipAddress,
            req.securityContext?.userAgent
          );
          res.status(429).json({ 
            error: 'Too many authentication attempts',
            retryAfter: result.lockedUntil ? Math.ceil((result.lockedUntil.getTime() - Date.now()) / 1000) : 900
          });
          return;
        }
        next();
      })
      .catch(error => {
        Logger.error('Auth rate limit check failed', error as Error);
        next();
      });
  }

  // File upload security middleware
  static fileUploadSecurity(req: SecureRequest, res: Response, next: NextFunction): void {
    const userId = req.securityContext?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Check file size
    const contentLength = parseInt(req.get('Content-Length') || '0');
    const sizeValidation = SecurityMiddleware.securityService.validateFileSize(contentLength);
    if (!sizeValidation.valid) {
      SecurityMiddleware.securityService.recordSecurityEvent(
        'file_upload_blocked',
        userId,
        { reason: 'File too large', size: contentLength },
        'medium',
        req.securityContext?.ipAddress,
        req.securityContext?.userAgent
      );
      res.status(413).json({ error: sizeValidation.error });
      return;
    }

    next();
  }

  // Suspicious activity detection
  static detectSuspiciousActivity(req: SecureRequest, _res: Response, next: NextFunction): void {
    const userId = req.securityContext?.userId;
    const userAgent = req.securityContext?.userAgent || '';
    const ipAddress = req.securityContext?.ipAddress || '';

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /script/i,
      /javascript/i,
      /vbscript/i,
      /onload/i,
      /onerror/i,
      /eval\(/i,
      /expression\(/i,
      /url\(/i
    ];

    const requestData = JSON.stringify({
      query: req.query,
      body: req.body,
      params: req.params,
      headers: req.headers
    });

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(requestData)) {
        SecurityMiddleware.securityService.recordSecurityEvent(
          'suspicious_activity',
          userId || 'anonymous',
          { 
            reason: 'Suspicious pattern detected',
            pattern: pattern.toString(),
            path: req.path,
            method: req.method
          },
          'high',
          ipAddress,
          userAgent
        );
        break;
      }
    }

    next();
  }

  // Security headers middleware
  static securityHeaders(_req: Request, res: Response, next: NextFunction): void {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Strict Transport Security (HTTPS only)
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    
    // Content Security Policy
    res.setHeader('Content-Security-Policy', 
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "connect-src 'self'; " +
      "frame-ancestors 'none';"
    );
    
    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions Policy
    res.setHeader('Permissions-Policy', 
      'camera=(), microphone=(), geolocation=(), payment=()'
    );

    next();
  }

  // Private helper methods
  private static sanitizeObject(obj: any): void {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        obj[key] = SecurityMiddleware.securityService.sanitizeInput(value);
      } else if (typeof value === 'object' && value !== null) {
        SecurityMiddleware.sanitizeObject(value);
      }
    }
  }

  private static getClientIP(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      (req as any).connection?.remoteAddress ||
      (req as any).socket?.remoteAddress ||
      req.ip ||
      '127.0.0.1'
    );
  }

  private static extractUserId(req: Request): string | undefined {
    // Extract user ID from JWT token or session
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        // const token = authHeader.substring(7);
        // In a real implementation, you would verify the JWT token here
        // For now, we'll extract from a custom header
        return req.headers['x-user-id'] as string;
      } catch (error) {
        Logger.debug('Failed to extract user ID from token', { error });
      }
    }
    return undefined;
  }
}
