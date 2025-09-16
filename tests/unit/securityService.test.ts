import { SecurityService } from '../../src/services/securityService';
// import { Logger } from '../../src/utils/logger';

// Mock dependencies
jest.mock('../../src/utils/logger');
jest.mock('../../src/services/cacheService', () => ({
  CacheService: {
    getInstance: jest.fn().mockReturnValue({
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      setJson: jest.fn(),
      getJson: jest.fn()
    })
  }
}));

// const mockLogger = Logger as jest.Mocked<typeof Logger>;

describe('SecurityService', () => {
  let securityService: SecurityService;

  beforeEach(() => {
    jest.clearAllMocks();
    securityService = SecurityService.getInstance();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = SecurityService.getInstance();
      const instance2 = SecurityService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('generateCSRFToken', () => {
    it('should generate a valid CSRF token', () => {
      const userId = '123456789012345678';
      
      const token = securityService.generateCSRFToken(userId);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should generate different tokens for different users', () => {
      const token1 = securityService.generateCSRFToken('123456789012345678');
      const token2 = securityService.generateCSRFToken('987654321098765432');
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('validateCSRFToken', () => {
    it('should validate CSRF token', async () => {
      const userId = '123456789012345678';
      const token = securityService.generateCSRFToken(userId);
      
      const result = await securityService.validateCSRFToken(token, userId);
      expect(result).toBe(true);
    });

    it('should reject invalid CSRF token', async () => {
      const userId = '123456789012345678';
      
      const result = await securityService.validateCSRFToken('invalid-token', userId);
      expect(result).toBe(false);
    });
  });

  describe('checkLoginAttempts', () => {
    it('should allow login for new user', async () => {
      const userId = '123456789012345678';
      
      const result = await securityService.checkLoginAttempts(userId);
      
      expect(result.allowed).toBe(true);
      expect(result.remainingAttempts).toBeGreaterThan(0);
    });

    it('should track login attempts', async () => {
      const userId = '123456789012345678';
      
      // Record some failed attempts
      securityService.recordFailedLogin(userId);
      securityService.recordFailedLogin(userId);
      
      const result = await securityService.checkLoginAttempts(userId);
      expect(result.remainingAttempts).toBeLessThan(5);
    });
  });

  describe('recordFailedLogin', () => {
    it('should record failed login attempt', () => {
      const userId = '123456789012345678';
      
      expect(() => {
        securityService.recordFailedLogin(userId);
      }).not.toThrow();
    });

    it('should record failed login with IP address', () => {
      const userId = '123456789012345678';
      const ipAddress = '192.168.1.1';
      
      expect(() => {
        securityService.recordFailedLogin(userId, ipAddress);
      }).not.toThrow();
    });
  });

  describe('recordSuccessfulLogin', () => {
    it('should record successful login', () => {
      const userId = '123456789012345678';
      
      expect(() => {
        securityService.recordSuccessfulLogin(userId);
      }).not.toThrow();
    });
  });

  describe('sanitizeInput', () => {
    it('should sanitize input string', () => {
      const input = '  <script>alert("xss")</script>  ';
      const result = securityService.sanitizeInput(input);
      
      expect(result).not.toContain('<script>');
      expect(result.trim().length).toBeGreaterThan(0);
    });

    it('should handle empty input', () => {
      const result = securityService.sanitizeInput('');
      expect(result).toBe('');
    });

    it('should trim whitespace', () => {
      const result = securityService.sanitizeInput('  test  ');
      expect(result).toBe('test');
    });
  });

  describe('validateFileName', () => {
    it('should validate valid filename', () => {
      const result = securityService.validateFileName('test.txt');
      expect(result.valid).toBe(true);
    });

    it('should reject filename with dangerous extensions', () => {
      const result = securityService.validateFileName('malware.exe');
      expect(result.valid).toBe(false);
    });

    it('should reject filename that is too long', () => {
      const longName = 'a'.repeat(300);
      const result = securityService.validateFileName(longName);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateFileType', () => {
    it('should validate allowed file type', () => {
      const result = securityService.validateFileType('image/jpeg');
      expect(result.valid).toBe(true);
    });

    it('should reject blocked file type', () => {
      const result = securityService.validateFileType('application/x-executable');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateFileSize', () => {
    it('should validate file size within limits', () => {
      const result = securityService.validateFileSize(1024 * 1024); // 1MB
      expect(result.valid).toBe(true);
    });

    it('should reject file size exceeding limits', () => {
      const result = securityService.validateFileSize(200 * 1024 * 1024); // 200MB
      expect(result.valid).toBe(false);
    });
  });

  describe('validateSearchQuery', () => {
    it('should validate search query', () => {
      const result = securityService.validateSearchQuery('test search');
      expect(result.valid).toBe(true);
    });

    it('should reject search query that is too long', () => {
      const longQuery = 'a'.repeat(1001);
      const result = securityService.validateSearchQuery(longQuery);
      expect(result.valid).toBe(false);
    });
  });

  describe('recordSecurityEvent', () => {
    it('should record security event', () => {
      const eventType = 'login_attempt';
      const userId = '123456789012345678';
      const details = { success: false };
      
      expect(() => {
        securityService.recordSecurityEvent(eventType, userId, details);
      }).not.toThrow();
    });
  });

  describe('getSecurityStats', () => {
    it('should return security statistics', () => {
      const stats = securityService.getSecurityStats();
      
      expect(stats).toBeDefined();
      expect(stats.totalEvents).toBeDefined();
      expect(stats.eventsByType).toBeDefined();
      expect(stats.recentEvents).toBeDefined();
    });
  });

  describe('cleanup', () => {
    it('should cleanup old data', () => {
      expect(() => {
        securityService.cleanup();
      }).not.toThrow();
    });
  });

  describe('getConfig', () => {
    it('should return security configuration', () => {
      const config = securityService.getConfig();
      
      expect(config).toBeDefined();
      expect(config.maxFileSize).toBeDefined();
      expect(config.allowedFileTypes).toBeDefined();
      expect(config.maxLoginAttempts).toBeDefined();
    });
  });
});