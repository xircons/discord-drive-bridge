import Joi from 'joi';
import { config } from '../config';

export class ValidationService {
  // File name validation
  static validateFileName(fileName: string): { valid: boolean; error?: string } {
    if (!fileName || fileName.trim().length === 0) {
      return { valid: false, error: 'File name cannot be empty' };
    }

    if (fileName.length > 255) {
      return { valid: false, error: 'File name too long (max 255 characters)' };
    }

    // Check for dangerous characters
    const dangerousChars = /[<>:"/\\|?*]/;
    const hasControlChars = fileName.split('').some(char => {
      const code = char.charCodeAt(0);
      return code >= 0 && code <= 31;
    });
    if (dangerousChars.test(fileName) || hasControlChars) {
      return { valid: false, error: 'File name contains invalid characters' };
    }

    // Check for reserved names (Windows)
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    const nameParts = fileName.split('.');
    if (nameParts.length > 0) {
      const nameWithoutExt = nameParts[0].toUpperCase();
      if (reservedNames.includes(nameWithoutExt)) {
        return { valid: false, error: 'File name is reserved' };
      }
    }

    return { valid: true };
  }

  // Folder name validation
  static validateFolderName(folderName: string): { valid: boolean; error?: string } {
    if (!folderName || folderName.trim().length === 0) {
      return { valid: false, error: 'Folder name cannot be empty' };
    }

    if (folderName.length > 100) {
      return { valid: false, error: 'Folder name too long (max 100 characters)' };
    }

    // Check for dangerous characters
    const dangerousChars = /[<>:"/\\|?*]/;
    const hasControlChars = folderName.split('').some(char => {
      const code = char.charCodeAt(0);
      return code >= 0 && code <= 31;
    });
    if (dangerousChars.test(folderName) || hasControlChars) {
      return { valid: false, error: 'Folder name contains invalid characters' };
    }

    return { valid: true };
  }

  // File type validation
  static validateFileType(mimeType: string): { valid: boolean; error?: string } {
    if (config.security.blockedFileTypes.includes(mimeType)) {
      return { valid: false, error: 'File type is not allowed' };
    }

    if (config.security.allowedFileTypes.length > 0 && !config.security.allowedFileTypes.includes(mimeType)) {
      return { valid: false, error: 'File type is not in the allowed list' };
    }

    return { valid: true };
  }

  // File size validation
  static validateFileSize(size: number): { valid: boolean; error?: string } {
    if (size > config.security.maxFileSize) {
      return { 
        valid: false, 
        error: `File too large (max ${Math.round(config.security.maxFileSize / 1024 / 1024)}MB)` 
      };
    }

    if (size <= 0) {
      return { valid: false, error: 'File size must be greater than 0' };
    }

    return { valid: true };
  }

  // Search query validation
  static validateSearchQuery(query: string): { valid: boolean; error?: string } {
    if (!query || query.trim().length === 0) {
      return { valid: false, error: 'Search query cannot be empty' };
    }

    if (query.length > 100) {
      return { valid: false, error: 'Search query too long (max 100 characters)' };
    }

    // Check for potentially dangerous patterns
    const dangerousPatterns = [
      /\.\./,  // Directory traversal
      /[<>]/,  // HTML injection
      /['"]/,  // SQL injection
      /[;|&$`]/,  // Command injection
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(query)) {
        return { valid: false, error: 'Search query contains potentially dangerous characters' };
      }
    }

    return { valid: true };
  }

  // Discord user ID validation
  static validateDiscordId(id: string): { valid: boolean; error?: string } {
    const discordIdRegex = /^\d{17,19}$/;
    if (!discordIdRegex.test(id)) {
      return { valid: false, error: 'Invalid Discord user ID format' };
    }
    return { valid: true };
  }

  // Google Drive file ID validation
  static validateGoogleDriveId(id: string): { valid: boolean; error?: string } {
    if (!id || id.length < 10 || id.length > 100) {
      return { valid: false, error: 'Invalid Google Drive file ID format' };
    }

    // Google Drive IDs are alphanumeric with some special characters
    const googleDriveIdRegex = /^[a-zA-Z0-9_-]+$/;
    if (!googleDriveIdRegex.test(id)) {
      return { valid: false, error: 'Invalid Google Drive file ID format' };
    }

    return { valid: true };
  }

  // Command parameter validation schemas
  static readonly commandSchemas = {
    upload: Joi.object({
      folder: Joi.string().optional(),
      description: Joi.string().max(1000).optional()
    }),

    download: Joi.object({
      folder: Joi.string().required(),
      filename: Joi.string().required()
    }),

    delete: Joi.object({
      folder: Joi.string().required(),
      filename: Joi.string().required()
    }),

    list: Joi.object({
      folder: Joi.string().optional(),
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().integer().min(1).max(100).optional()
    }),

    createFolder: Joi.object({
      name: Joi.string().min(1).max(100).required(),
      parent: Joi.string().optional()
    }),

    rename: Joi.object({
      type: Joi.string().valid('file', 'folder').required(),
      oldName: Joi.string().required(),
      newName: Joi.string().required(),
      folder: Joi.string().optional()
    }),

    move: Joi.object({
      filename: Joi.string().required(),
      fromFolder: Joi.string().required(),
      toFolder: Joi.string().required()
    }),

    copy: Joi.object({
      filename: Joi.string().required(),
      fromFolder: Joi.string().required(),
      toFolder: Joi.string().required()
    }),

    share: Joi.object({
      folder: Joi.string().required(),
      filename: Joi.string().required(),
      permission: Joi.string().valid('reader', 'writer', 'commenter').optional()
    }),

    search: Joi.object({
      query: Joi.string().min(1).max(100).required(),
      folder: Joi.string().optional(),
      mimeType: Joi.string().optional(),
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().integer().min(1).max(100).optional()
    }),

    recent: Joi.object({
      limit: Joi.number().integer().min(1).max(50).optional()
    }),

    storage: Joi.object({})
  };

  // Validate command parameters
  static validateCommandParameters(command: string, parameters: any): { valid: boolean; error?: string; data?: any } {
    const schema = this.commandSchemas[command as keyof typeof this.commandSchemas];
    if (!schema) {
      return { valid: false, error: 'Unknown command' };
    }

    const { error, value } = schema.validate(parameters, { abortEarly: false });
    if (error) {
      return { 
        valid: false, 
        error: error.details.map(d => d.message).join(', ') 
      };
    }

    return { valid: true, data: value };
  }
}
