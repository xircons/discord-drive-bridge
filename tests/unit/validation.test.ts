import { ValidationService } from '../../src/utils/validation';

describe('ValidationService', () => {
  describe('validateFileName', () => {
    it('should accept valid file names', () => {
      const validNames = [
        'document.pdf',
        'image.jpg',
        'file with spaces.txt',
        'file-with-dashes.doc',
        'file_with_underscores.xlsx',
        'file123.txt',
        'a'.repeat(255) // Max length
      ];

      validNames.forEach(name => {
        const result = ValidationService.validateFileName(name);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    it('should reject invalid file names', () => {
      const invalidNames = [
        '', // Empty
        '   ', // Whitespace only
        'file<name.txt', // Contains <
        'file>name.txt', // Contains >
        'file:name.txt', // Contains :
        'file"name.txt', // Contains "
        'file/name.txt', // Contains /
        'file\\name.txt', // Contains \
        'file|name.txt', // Contains |
        'file?name.txt', // Contains ?
        'file*name.txt', // Contains *
        'CON.txt', // Reserved name
        'PRN.txt', // Reserved name
        'a'.repeat(256) // Too long
      ];

      invalidNames.forEach(name => {
        const result = ValidationService.validateFileName(name);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
  });

  describe('validateFolderName', () => {
    it('should accept valid folder names', () => {
      const validNames = [
        'My Folder',
        'folder-with-dashes',
        'folder_with_underscores',
        'folder123',
        'a'.repeat(100) // Max length
      ];

      validNames.forEach(name => {
        const result = ValidationService.validateFolderName(name);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    it('should reject invalid folder names', () => {
      const invalidNames = [
        '', // Empty
        '   ', // Whitespace only
        'folder<name', // Contains <
        'folder>name', // Contains >
        'folder:name', // Contains :
        'folder"name', // Contains "
        'folder/name', // Contains /
        'folder\\name', // Contains \
        'folder|name', // Contains |
        'folder?name', // Contains ?
        'folder*name', // Contains *
        'a'.repeat(101) // Too long
      ];

      invalidNames.forEach(name => {
        const result = ValidationService.validateFolderName(name);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
  });

  describe('validateFileType', () => {
    it('should accept allowed file types', () => {
      const allowedTypes = [
        'image/jpeg',
        'image/png',
        'text/plain',
        'application/pdf'
      ];

      allowedTypes.forEach(type => {
        const result = ValidationService.validateFileType(type);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    it('should reject blocked file types', () => {
      const blockedTypes = [
        'application/x-executable',
        'application/x-msdownload',
        'application/x-msi'
      ];

      blockedTypes.forEach(type => {
        const result = ValidationService.validateFileType(type);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
  });

  describe('validateFileSize', () => {
    it('should accept valid file sizes', () => {
      const validSizes = [
        1, // 1 byte
        1024, // 1KB
        1024 * 1024, // 1MB
        100 * 1024 * 1024 // 100MB (max)
      ];

      validSizes.forEach(size => {
        const result = ValidationService.validateFileSize(size);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    it('should reject invalid file sizes', () => {
      const invalidSizes = [
        0, // Zero size
        -1, // Negative size
        101 * 1024 * 1024 // Over 100MB
      ];

      invalidSizes.forEach(size => {
        const result = ValidationService.validateFileSize(size);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
  });

  describe('validateSearchQuery', () => {
    it('should accept valid search queries', () => {
      const validQueries = [
        'document',
        'my file',
        'report 2023',
        'a'.repeat(100) // Max length
      ];

      validQueries.forEach(query => {
        const result = ValidationService.validateSearchQuery(query);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    it('should reject invalid search queries', () => {
      const invalidQueries = [
        '', // Empty
        '   ', // Whitespace only
        '../etc/passwd', // Directory traversal
        '<script>alert("xss")</script>', // HTML injection
        "'; DROP TABLE users; --", // SQL injection
        'file | rm -rf /', // Command injection
        'a'.repeat(101) // Too long
      ];

      invalidQueries.forEach(query => {
        const result = ValidationService.validateSearchQuery(query);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
  });

  describe('validateDiscordId', () => {
    it('should accept valid Discord IDs', () => {
      const validIds = [
        '123456789012345678', // 18 digits
        '1234567890123456789', // 19 digits
        '12345678901234567' // 17 digits
      ];

      validIds.forEach(id => {
        const result = ValidationService.validateDiscordId(id);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    it('should reject invalid Discord IDs', () => {
      const invalidIds = [
        '', // Empty
        '1234567890123456', // Too short (16 digits)
        '12345678901234567890', // Too long (20 digits)
        '12345678901234567a', // Contains letter
        '12345678901234567-', // Contains dash
        '12345678901234567.', // Contains dot
      ];

      invalidIds.forEach(id => {
        const result = ValidationService.validateDiscordId(id);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
  });

  describe('validateGoogleDriveId', () => {
    it('should accept valid Google Drive IDs', () => {
      const validIds = [
        '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
        '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms123',
        'abc123def456',
        'a'.repeat(50)
      ];

      validIds.forEach(id => {
        const result = ValidationService.validateGoogleDriveId(id);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    it('should reject invalid Google Drive IDs', () => {
      const invalidIds = [
        '', // Empty
        'abc', // Too short
        'a'.repeat(101), // Too long
        'abc@def', // Contains @
        'abc def', // Contains space
        'abc.def', // Contains dot
        'abc/def', // Contains slash
      ];

      invalidIds.forEach(id => {
        const result = ValidationService.validateGoogleDriveId(id);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
  });

  describe('validateCommandParameters', () => {
    it('should validate upload command parameters', () => {
      const validParams = {
        folder: 'My Folder',
        description: 'Test file'
      };

      const result = ValidationService.validateCommandParameters('upload', validParams);
      expect(result.valid).toBe(true);
      expect(result.data).toEqual(validParams);
    });

    it('should validate download command parameters', () => {
      const validParams = {
        folder: 'My Folder',
        filename: 'document.pdf'
      };

      const result = ValidationService.validateCommandParameters('download', validParams);
      expect(result.valid).toBe(true);
      expect(result.data).toEqual(validParams);
    });

    it('should reject invalid command parameters', () => {
      const invalidParams = {
        folder: '', // Empty folder name
        filename: 'file<name.pdf' // Invalid filename
      };

      const result = ValidationService.validateCommandParameters('download', invalidParams);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject unknown commands', () => {
      const result = ValidationService.validateCommandParameters('unknown', {});
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Unknown command');
    });
  });
});
