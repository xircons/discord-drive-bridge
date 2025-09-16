import { EnhancedValidationService } from '../../src/utils/enhancedValidation';
import { SecurityService } from '../../src/services/securityService';
import { Logger } from '../../src/utils/logger';

// Mock dependencies
jest.mock('../../src/services/securityService');
jest.mock('../../src/utils/logger');

const mockSecurityService = SecurityService as jest.Mocked<typeof SecurityService>;
// const mockLogger = Logger as jest.Mocked<typeof Logger>;

describe('EnhancedValidationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock implementations
    mockSecurityService.getInstance.mockReturnValue({
      validateFileName: jest.fn().mockReturnValue({ valid: true, sanitized: 'test.txt' }),
      sanitizeInput: jest.fn().mockImplementation((input: string) => input.trim()),
      validateFileType: jest.fn().mockReturnValue({ valid: true }),
      validateFileSize: jest.fn().mockReturnValue({ valid: true })
    } as any);
  });

  describe('validateFileName', () => {
    it('should validate valid filename', () => {
      const result = EnhancedValidationService.validateFileName('test.txt');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('test.txt');
    });

    it('should reject filename with invalid characters', () => {
      const result = EnhancedValidationService.validateFileName('test<>file.txt');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject empty filename', () => {
      const result = EnhancedValidationService.validateFileName('');
      expect(result.valid).toBe(false);
    });

    it('should reject filename that is too long', () => {
      const longName = 'a'.repeat(256);
      const result = EnhancedValidationService.validateFileName(longName);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateFolderName', () => {
    it('should validate valid folder name', () => {
      const result = EnhancedValidationService.validateFolderName('My Folder');
      expect(result.valid).toBe(true);
    });

    it('should reject empty folder name', () => {
      const result = EnhancedValidationService.validateFolderName('');
      expect(result.valid).toBe(false);
    });

    it('should reject folder name with invalid characters', () => {
      const result = EnhancedValidationService.validateFolderName('Folder<>Name');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateFileType', () => {
    it('should validate allowed MIME types', () => {
      const result = EnhancedValidationService.validateFileType('image/jpeg');
      expect(result.valid).toBe(true);
    });

    it('should reject disallowed MIME types', () => {
      const result = EnhancedValidationService.validateFileType('application/x-executable');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateFileSize', () => {
    it('should validate file size within limits', () => {
      const result = EnhancedValidationService.validateFileSize(1024 * 1024); // 1MB
      expect(result.valid).toBe(true);
    });

    it('should reject file size exceeding limits', () => {
      const result = EnhancedValidationService.validateFileSize(100 * 1024 * 1024 * 1024); // 100GB
      expect(result.valid).toBe(false);
    });
  });

  describe('validateSearchQuery', () => {
    it('should validate search query', () => {
      const result = EnhancedValidationService.validateSearchQuery('test search');
      expect(result.valid).toBe(true);
    });

    it('should reject empty search query', () => {
      const result = EnhancedValidationService.validateSearchQuery('');
      expect(result.valid).toBe(false);
    });

    it('should reject search query that is too long', () => {
      const longQuery = 'a'.repeat(1001);
      const result = EnhancedValidationService.validateSearchQuery(longQuery);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateDiscordId', () => {
    it('should validate valid Discord ID', () => {
      const result = EnhancedValidationService.validateDiscordId('123456789012345678');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid Discord ID format', () => {
      const result = EnhancedValidationService.validateDiscordId('123');
      expect(result.valid).toBe(false);
    });

    it('should reject non-numeric Discord ID', () => {
      const result = EnhancedValidationService.validateDiscordId('abc123');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateGoogleDriveId', () => {
    it('should validate valid Google Drive ID', () => {
      const result = EnhancedValidationService.validateGoogleDriveId('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid Google Drive ID format', () => {
      const result = EnhancedValidationService.validateGoogleDriveId('invalid-id');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateCommandParameters', () => {
    it('should validate command parameters', () => {
      const parameters = { name: 'test', value: 123 };
      const result = EnhancedValidationService.validateCommandParameters('test', parameters);
      expect(result.valid).toBe(true);
    });

    it('should sanitize command parameters', () => {
      const parameters = { name: '  test  ', value: 123 };
      const result = EnhancedValidationService.validateCommandParameters('test', parameters);
      expect(result.valid).toBe(true);
      expect(result.sanitized?.name).toBe('test');
    });
  });

  describe('validateEmail', () => {
    it('should validate valid email', () => {
      const result = EnhancedValidationService.validateEmail('test@example.com');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid email format', () => {
      const result = EnhancedValidationService.validateEmail('invalid-email');
      expect(result.valid).toBe(false);
    });

    it('should sanitize email', () => {
      const result = EnhancedValidationService.validateEmail('  test@example.com  ');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('test@example.com');
    });
  });

  describe('validateUrl', () => {
    it('should validate valid URL', () => {
      const result = EnhancedValidationService.validateUrl('https://example.com');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid URL', () => {
      const result = EnhancedValidationService.validateUrl('not-a-url');
      expect(result.valid).toBe(false);
    });

    it('should sanitize URL', () => {
      const result = EnhancedValidationService.validateUrl('  https://example.com  ');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('https://example.com');
    });
  });

  describe('validateCronExpression', () => {
    it('should validate valid cron expression', () => {
      const result = EnhancedValidationService.validateCronExpression('0 0 * * *');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid cron expression', () => {
      const result = EnhancedValidationService.validateCronExpression('invalid-cron');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateAndSanitize', () => {
    it('should validate and sanitize data with Joi schema', () => {
      const Joi = require('joi');
      const schema = Joi.object({
        name: Joi.string().required(),
        age: Joi.number().min(0).max(120)
      });
      
      const data = { name: '  John  ', age: 25 };
      const result = EnhancedValidationService.validateAndSanitize(data, schema);
      
      expect(result.valid).toBe(true);
      expect(result.sanitized?.name).toBe('John');
    });

    it('should reject invalid data', () => {
      const Joi = require('joi');
      const schema = Joi.object({
        name: Joi.string().required(),
        age: Joi.number().min(0).max(120)
      });
      
      const data = { name: '', age: 150 };
      const result = EnhancedValidationService.validateAndSanitize(data, schema);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
