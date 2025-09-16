import { GoogleDriveService } from '../../src/services/googleDriveService';
import { ValidationService } from '../../src/utils/validation';
import { Logger } from '../../src/utils/logger';

// Mock dependencies
jest.mock('../../src/utils/validation');
jest.mock('../../src/utils/logger');
jest.mock('googleapis', () => ({
  google: {
    drive: jest.fn(() => ({
      files: {
        create: jest.fn(),
        get: jest.fn(),
        list: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
        copy: jest.fn(),
        generateIds: jest.fn(),
        getMetadata: jest.fn(),
        updateMetadata: jest.fn(),
        createPermission: jest.fn(),
        listPermissions: jest.fn(),
        deletePermission: jest.fn()
      }
    }))
  }
}));

const mockValidationService = ValidationService as jest.Mocked<typeof ValidationService>;
const mockLogger = Logger as jest.Mocked<typeof Logger>;

describe('GoogleDriveService', () => {
  let googleDriveService: GoogleDriveService;
  let mockOAuth2Client: any;
  let mockDrive: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock OAuth2Client
    mockOAuth2Client = {
      getAccessToken: jest.fn(),
      setCredentials: jest.fn()
    };
    
    // Mock Google Drive API
    mockDrive = {
      files: {
        create: jest.fn(),
        get: jest.fn(),
        list: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
        copy: jest.fn(),
        generateIds: jest.fn(),
        getMetadata: jest.fn(),
        updateMetadata: jest.fn(),
        createPermission: jest.fn(),
        listPermissions: jest.fn(),
        deletePermission: jest.fn()
      }
    };
    
    const { google } = require('googleapis');
    google.drive.mockReturnValue(mockDrive);
    
    googleDriveService = new GoogleDriveService(mockOAuth2Client);
  });

  describe('uploadFile', () => {
    it('should upload file successfully', async () => {
      const fileData = {
        fileName: 'test.txt',
        fileData: Buffer.from('test content'),
        mimeType: 'text/plain',
        folderId: 'folder123',
        description: 'Test file'
      };

      mockValidationService.validateFileName.mockReturnValue({ valid: true });
      mockValidationService.validateFileType.mockReturnValue({ valid: true });
      mockValidationService.validateFileSize.mockReturnValue({ valid: true });

      const mockResponse = {
        data: {
          id: 'file123',
          name: 'test.txt',
          mimeType: 'text/plain',
          size: '11',
          webViewLink: 'https://drive.google.com/file/d/file123/view',
          webContentLink: 'https://drive.google.com/uc?id=file123'
        }
      };

      mockDrive.files.create.mockResolvedValue(mockResponse);

      const result = await googleDriveService.uploadFile(fileData);

      expect(result).toEqual({
        id: 'file123',
        name: 'test.txt',
        mimeType: 'text/plain',
        size: 11,
        webViewLink: 'https://drive.google.com/file/d/file123/view',
        webContentLink: 'https://drive.google.com/uc?id=file123'
      });

      expect(mockDrive.files.create).toHaveBeenCalledWith({
        resource: {
          name: 'test.txt',
          parents: ['folder123'],
          description: 'Test file'
        },
        media: {
          mimeType: 'text/plain',
          body: Buffer.from('test content')
        }
      });
    });

    it('should validate file name', async () => {
      const fileData = {
        fileName: 'invalid<>name',
        fileData: Buffer.from('test content'),
        mimeType: 'text/plain'
      };

      mockValidationService.validateFileName.mockReturnValue({
        valid: false,
        error: 'Invalid file name'
      });

      await expect(googleDriveService.uploadFile(fileData))
        .rejects.toThrow('Invalid file name');
    });

    it('should validate file type', async () => {
      const fileData = {
        fileName: 'test.exe',
        fileData: Buffer.from('test content'),
        mimeType: 'application/x-executable'
      };

      mockValidationService.validateFileName.mockReturnValue({ valid: true });
      mockValidationService.validateFileType.mockReturnValue({
        valid: false,
        error: 'File type not allowed'
      });

      await expect(googleDriveService.uploadFile(fileData))
        .rejects.toThrow('File type not allowed');
    });

    it('should validate file size', async () => {
      const fileData = {
        fileName: 'test.txt',
        fileData: Buffer.alloc(200 * 1024 * 1024), // 200MB
        mimeType: 'text/plain'
      };

      mockValidationService.validateFileName.mockReturnValue({ valid: true });
      mockValidationService.validateFileType.mockReturnValue({ valid: true });
      mockValidationService.validateFileSize.mockReturnValue({
        valid: false,
        error: 'File too large'
      });

      await expect(googleDriveService.uploadFile(fileData))
        .rejects.toThrow('File too large');
    });
  });

  describe('downloadFile', () => {
    it('should download file successfully', async () => {
      const fileId = 'file123';
      const mockResponse = {
        data: Buffer.from('file content')
      };

      mockDrive.files.get.mockResolvedValue({
        data: {
          id: fileId,
          name: 'test.txt',
          mimeType: 'text/plain',
          size: '12'
        }
      });

      mockDrive.files.get.mockResolvedValueOnce({
        data: {
          id: fileId,
          name: 'test.txt',
          mimeType: 'text/plain',
          size: '12'
        }
      }).mockResolvedValueOnce(mockResponse);

      const result = await googleDriveService.downloadFile(fileId);

      expect(result).toEqual({
        id: fileId,
        name: 'test.txt',
        mimeType: 'text/plain',
        size: 12,
        data: Buffer.from('file content')
      });
    });

    it('should handle file not found', async () => {
      const fileId = 'nonexistent';
      const error = new Error('File not found');
      (error as any).code = 404;

      mockDrive.files.get.mockRejectedValue(error);

      await expect(googleDriveService.downloadFile(fileId))
        .rejects.toThrow('File not found');
    });
  });

  describe('listFiles', () => {
    it('should list files successfully', async () => {
      const folderId = 'folder123';
      const mockResponse = {
        data: {
          files: [
            {
              id: 'file1',
              name: 'file1.txt',
              mimeType: 'text/plain',
              size: '100',
              webViewLink: 'https://drive.google.com/file/d/file1/view'
            },
            {
              id: 'file2',
              name: 'file2.pdf',
              mimeType: 'application/pdf',
              size: '200',
              webViewLink: 'https://drive.google.com/file/d/file2/view'
            }
          ],
          nextPageToken: 'next-token'
        }
      };

      mockDrive.files.list.mockResolvedValue(mockResponse);

      const result = await googleDriveService.listFiles(folderId, 1, '10');

      expect(result.files).toHaveLength(2);
      expect(result.files[0]).toEqual({
        id: 'file1',
        name: 'file1.txt',
        mimeType: 'text/plain',
        size: 100,
        webViewLink: 'https://drive.google.com/file/d/file1/view'
      });
      expect(result.nextPageToken).toBe('next-token');
    });

    it('should handle empty folder', async () => {
      const folderId = 'empty-folder';
      const mockResponse = {
        data: {
          files: []
        }
      };

      mockDrive.files.list.mockResolvedValue(mockResponse);

      const result = await googleDriveService.listFiles(folderId);

      expect(result.files).toHaveLength(0);
      expect(result.nextPageToken).toBeUndefined();
    });
  });

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      const fileId = 'file123';
      mockDrive.files.delete.mockResolvedValue({ data: {} });

      await googleDriveService.deleteFile(fileId);

      expect(mockDrive.files.delete).toHaveBeenCalledWith({
        fileId: fileId
      });
    });

    it('should handle file not found', async () => {
      const fileId = 'nonexistent';
      const error = new Error('File not found');
      (error as any).code = 404;

      mockDrive.files.delete.mockRejectedValue(error);

      await expect(googleDriveService.deleteFile(fileId))
        .rejects.toThrow('File not found');
    });
  });

  describe('createFolder', () => {
    it('should create folder successfully', async () => {
      const folderName = 'Test Folder';
      const parentId = 'parent123';
      const mockResponse = {
        data: {
          id: 'folder123',
          name: 'Test Folder',
          mimeType: 'application/vnd.google-apps.folder',
          webViewLink: 'https://drive.google.com/drive/folders/folder123'
        }
      };

      mockDrive.files.create.mockResolvedValue(mockResponse);

      const result = await googleDriveService.createFolder(folderName, parentId);

      expect(result).toEqual({
        id: 'folder123',
        name: 'Test Folder',
        mimeType: 'application/vnd.google-apps.folder',
        webViewLink: 'https://drive.google.com/drive/folders/folder123'
      });

      expect(mockDrive.files.create).toHaveBeenCalledWith({
        resource: {
          name: 'Test Folder',
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId]
        }
      });
    });
  });

  describe('searchFiles', () => {
    it('should search files successfully', async () => {
      const query = 'test file';
      const mockResponse = {
        data: {
          files: [
            {
              id: 'file1',
              name: 'test file.txt',
              mimeType: 'text/plain',
              size: '100'
            }
          ]
        }
      };

      mockDrive.files.list.mockResolvedValue(mockResponse);

      const result = await googleDriveService.searchFiles({ query });

      expect(result.files).toHaveLength(1);
      expect(result.files[0].name).toBe('test file.txt');
    });

    it('should search files with folder filter', async () => {
      const query = 'test file';
      const folderId = 'folder123';
      const mockResponse = {
        data: {
          files: []
        }
      };

      mockDrive.files.list.mockResolvedValue(mockResponse);

      await googleDriveService.searchFiles({ query, folderId });

      expect(mockDrive.files.list).toHaveBeenCalledWith({
        q: `name contains 'test file' and '${folderId}' in parents`,
        fields: 'files(id,name,mimeType,size,webViewLink,webContentLink)',
        pageSize: 100
      });
    });
  });

  describe('getFileInfo', () => {
    it('should get file info successfully', async () => {
      const fileId = 'file123';
      const mockResponse = {
        data: {
          id: 'file123',
          name: 'test.txt',
          mimeType: 'text/plain',
          size: '100',
          webViewLink: 'https://drive.google.com/file/d/file123/view'
        }
      };

      mockDrive.files.get.mockResolvedValue(mockResponse);

      const result = await googleDriveService.getFile(fileId);

      expect(result).toEqual({
        id: 'file123',
        name: 'test.txt',
        mimeType: 'text/plain',
        size: 100,
        webViewLink: 'https://drive.google.com/file/d/file123/view'
      });
    });
  });

  describe('getStorageInfo', () => {
    it('should get storage info successfully', async () => {
      const mockResponse = {
        data: {
          storageQuota: {
            limit: '15000000000', // 15GB
            usage: '1000000000',  // 1GB
            usageInDrive: '500000000',
            usageInDriveTrash: '100000000'
          }
        }
      };

      mockDrive.about.get.mockResolvedValue(mockResponse);

      const result = await googleDriveService.getStorageQuota();

      expect(result).toEqual({
        totalSpace: 15000000000,
        usedSpace: 1000000000,
        usedSpaceInDrive: 500000000,
        usedSpaceInTrash: 100000000,
        freeSpace: 14000000000
      });
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      const fileId = 'file123';
      const error = new Error('API Error');
      (error as any).code = 500;

      mockDrive.files.get.mockRejectedValue(error);

      await expect(googleDriveService.getFile(fileId))
        .rejects.toThrow('API Error');
    });

    it('should log errors appropriately', async () => {
      const fileId = 'file123';
      const error = new Error('API Error');
      (error as any).code = 500;

      mockDrive.files.get.mockRejectedValue(error);

      try {
        await googleDriveService.getFile(fileId);
      } catch (e) {
        // Expected to throw
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Google Drive API error',
        error,
        { fileId, operation: 'getFileInfo' }
      );
    });
  });
});
