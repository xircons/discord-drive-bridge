import Joi from 'joi';
import { SecurityService } from '../services/securityService';
import { Logger } from './logger';

export class EnhancedValidationService {
  private static securityService: SecurityService;

  static {
    this.securityService = SecurityService.getInstance();
  }

  // Enhanced file name validation with security checks
  public static validateFileName(fileName: string): { valid: boolean; error?: string; sanitized?: string } {
    // First run security validation
    const securityResult = this.securityService.validateFileName(fileName);
    if (!securityResult.valid) {
      return securityResult;
    }

    // Then run Joi validation for additional checks
    const schema = Joi.string()
      .min(1)
      .max(255)
      .pattern(/^[^<>:"/\\|?*]+$/) // No invalid filename characters
      .required();

    const { error, value } = schema.validate(fileName);
    
    if (error) {
      return {
        valid: false,
        error: error.details[0].message
      };
    }

    return {
      valid: true,
      sanitized: securityResult.sanitized || value
    };
  }

  // Enhanced folder name validation
  public static validateFolderName(folderName: string): { valid: boolean; error?: string; sanitized?: string } {
    const sanitized = this.securityService.sanitizeInput(folderName);
    
    if (sanitized.length === 0) {
      return { valid: false, error: 'Folder name cannot be empty after sanitization' };
    }

    const schema = Joi.string()
      .min(1)
      .max(100)
      .pattern(/^[a-zA-Z0-9\s\-_]+$/) // Only alphanumeric, spaces, hyphens, underscores
      .required();

    const { error, value } = schema.validate(sanitized);
    
    if (error) {
      return {
        valid: false,
        error: error.details[0].message
      };
    }

    return {
      valid: true,
      sanitized: value
    };
  }

  // Enhanced file type validation
  public static validateFileType(mimeType: string): { valid: boolean; error?: string } {
    // First run security validation
    const securityResult = this.securityService.validateFileType(mimeType);
    if (!securityResult.valid) {
      return securityResult;
    }

    // Additional Joi validation
    const schema = Joi.string()
      .pattern(/^[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_]*$/)
      .required();

    const { error } = schema.validate(mimeType);
    
    if (error) {
      return {
        valid: false,
        error: 'Invalid MIME type format'
      };
    }

    return { valid: true };
  }

  // Enhanced file size validation
  public static validateFileSize(size: number): { valid: boolean; error?: string } {
    // First run security validation
    const securityResult = this.securityService.validateFileSize(size);
    if (!securityResult.valid) {
      return securityResult;
    }

    // Additional Joi validation
    const schema = Joi.number()
      .integer()
      .min(0)
      .max(100 * 1024 * 1024) // 100MB
      .required();

    const { error } = schema.validate(size);
    
    if (error) {
      return {
        valid: false,
        error: error.details[0].message
      };
    }

    return { valid: true };
  }

  // Enhanced search query validation
  public static validateSearchQuery(query: string): { valid: boolean; error?: string; sanitized?: string } {
    // First run security validation
    const securityResult = this.securityService.validateSearchQuery(query);
    if (!securityResult.valid) {
      return securityResult;
    }

    // Additional Joi validation
    const schema = Joi.string()
      .min(1)
      .max(500)
      .pattern(/^[^<>{}[\]\\|`~!@#$%^&*()+=\s]*$/) // No special characters that could be dangerous
      .required();

    const { error, value } = schema.validate(securityResult.sanitized);
    
    if (error) {
      return {
        valid: false,
        error: error.details[0].message
      };
    }

    return {
      valid: true,
      sanitized: value
    };
  }

  // Enhanced Discord ID validation
  public static validateDiscordId(id: string): { valid: boolean; error?: string } {
    const schema = Joi.string()
      .pattern(/^\d{17,19}$/) // Discord IDs are 17-19 digits
      .required();

    const { error } = schema.validate(id);
    
    if (error) {
      return {
        valid: false,
        error: 'Invalid Discord ID format'
      };
    }

    return { valid: true };
  }

  // Enhanced Google Drive ID validation
  public static validateGoogleDriveId(id: string): { valid: boolean; error?: string } {
    const schema = Joi.string()
      .pattern(/^[a-zA-Z0-9_-]{20,}$/) // Google Drive IDs are at least 20 characters
      .required();

    const { error } = schema.validate(id);
    
    if (error) {
      return {
        valid: false,
        error: 'Invalid Google Drive ID format'
      };
    }

    return { valid: true };
  }

  // Enhanced command parameter validation
  public static validateCommandParameters(command: string, parameters: Record<string, any>): { valid: boolean; error?: string; sanitized?: Record<string, any> } {
    const commandSchemas: Record<string, Joi.ObjectSchema> = {
      upload: Joi.object({
        fileName: Joi.string().required(),
        mimeType: Joi.string().required(),
        folderId: Joi.string().optional(),
        description: Joi.string().max(1000).optional()
      }),
      download: Joi.object({
        fileName: Joi.string().required(),
        folderName: Joi.string().optional()
      }),
      delete: Joi.object({
        fileName: Joi.string().required(),
        folderName: Joi.string().optional()
      }),
      list: Joi.object({
        folderName: Joi.string().optional(),
        page: Joi.number().integer().min(1).max(100).optional()
      }),
      search: Joi.object({
        query: Joi.string().required(),
        folderName: Joi.string().optional(),
        mimeType: Joi.string().optional(),
        limit: Joi.number().integer().min(1).max(25).optional()
      }),
      'create-folder': Joi.object({
        name: Joi.string().required(),
        parentId: Joi.string().optional()
      }),
      backup: Joi.object({
        folderName: Joi.string().required(),
        schedule: Joi.string().required(),
        scheduleId: Joi.string().optional()
      })
    };

    const schema = commandSchemas[command];
    if (!schema) {
      return {
        valid: false,
        error: 'Unknown command'
      };
    }

    // Sanitize parameters first
    const sanitizedParams: Record<string, any> = {};
    for (const [key, value] of Object.entries(parameters)) {
      if (typeof value === 'string') {
        sanitizedParams[key] = this.securityService.sanitizeInput(value);
      } else {
        sanitizedParams[key] = value;
      }
    }

    const { error, value } = schema.validate(sanitizedParams, { abortEarly: false });
    
    if (error) {
      const errorMessages = error.details.map(detail => detail.message).join(', ');
      return {
        valid: false,
        error: errorMessages
      };
    }

    return {
      valid: true,
      sanitized: value
    };
  }

  // Enhanced email validation
  public static validateEmail(email: string): { valid: boolean; error?: string; sanitized?: string } {
    const sanitized = this.securityService.sanitizeInput(email);
    
    const schema = Joi.string()
      .email({ tlds: { allow: false } }) // Allow any TLD
      .max(254) // RFC 5321 limit
      .required();

    const { error, value } = schema.validate(sanitized);
    
    if (error) {
      return {
        valid: false,
        error: 'Invalid email format'
      };
    }

    return {
      valid: true,
      sanitized: value
    };
  }

  // Enhanced URL validation
  public static validateUrl(url: string): { valid: boolean; error?: string; sanitized?: string } {
    const sanitized = this.securityService.sanitizeInput(url);
    
    const schema = Joi.string()
      .uri({ scheme: ['http', 'https'] }) // Only allow HTTP/HTTPS
      .max(2048) // Reasonable URL length limit
      .required();

    const { error, value } = schema.validate(sanitized);
    
    if (error) {
      return {
        valid: false,
        error: 'Invalid URL format'
      };
    }

    return {
      valid: true,
      sanitized: value
    };
  }

  // Enhanced cron expression validation
  public static validateCronExpression(expression: string): { valid: boolean; error?: string } {
    const schema = Joi.string()
      .pattern(/^(\*|([0-5]?\d)) (\*|([01]?\d|2[0-3])) (\*|([012]?\d|3[01])) (\*|([0]?\d|1[0-2])) (\*|([0-6]))$/)
      .required();

    const { error } = schema.validate(expression);
    
    if (error) {
      return {
        valid: false,
        error: 'Invalid cron expression format'
      };
    }

    return { valid: true };
  }

  // Validate and sanitize all input data
  public static validateAndSanitize(data: any, schema: Joi.ObjectSchema): { valid: boolean; error?: string; sanitized?: any } {
    try {
      // First sanitize all string values
      const sanitizedData = this.sanitizeObject(data);
      
      // Then validate with Joi
      const { error, value } = schema.validate(sanitizedData, { abortEarly: false });
      
      if (error) {
        const errorMessages = error.details.map(detail => detail.message).join(', ');
        return {
          valid: false,
          error: errorMessages
        };
      }

      return {
        valid: true,
        sanitized: value
      };
    } catch (error) {
      Logger.error('Validation and sanitization failed', error as Error);
      return {
        valid: false,
        error: 'Validation failed'
      };
    }
  }

  // Private helper to sanitize object recursively
  private static sanitizeObject(obj: any): any {
    if (typeof obj === 'string') {
      return this.securityService.sanitizeInput(obj);
    } else if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    } else if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeObject(value);
      }
      return sanitized;
    }
    return obj;
  }
}
