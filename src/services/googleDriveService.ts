import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { Logger } from '../utils/logger';
import { ValidationService } from '../utils/validation';
import { GoogleDriveFile, GoogleDriveFolder, FileUploadOptions, SearchOptions } from '../types';

export class GoogleDriveService {
  private drive: any;

  constructor(private oauth2Client: OAuth2Client) {
    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
  }

  // File operations
  async uploadFile(options: FileUploadOptions): Promise<GoogleDriveFile> {
    const startTime = Date.now();
    
    try {
      // Validate file name
      const nameValidation = ValidationService.validateFileName(options.fileName);
      if (!nameValidation.valid) {
        throw new Error(nameValidation.error);
      }

      // Validate file type
      const typeValidation = ValidationService.validateFileType(options.mimeType);
      if (!typeValidation.valid) {
        throw new Error(typeValidation.error);
      }

      // Validate file size
      const sizeValidation = ValidationService.validateFileSize(options.fileData.length);
      if (!sizeValidation.valid) {
        throw new Error(sizeValidation.error);
      }

      const fileMetadata = {
        name: options.fileName,
        parents: options.folderId ? [options.folderId] : undefined,
        description: options.description
      };

      const media = {
        mimeType: options.mimeType,
        body: options.fileData
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id,name,mimeType,size,modifiedTime,parents,webViewLink,webContentLink'
      });

      const duration = Date.now() - startTime;
      Logger.performance('upload_file', duration, {
        fileName: options.fileName,
        fileSize: options.fileData.length,
        folderId: options.folderId
      });

      return response.data;
    } catch (error) {
      Logger.error('Failed to upload file', error as Error, {
        fileName: options.fileName,
        folderId: options.folderId
      });
      throw error;
    }
  }

  async downloadFile(fileId: string): Promise<{ data: Buffer; mimeType: string; name: string }> {
    const startTime = Date.now();
    
    try {
      // Get file metadata first
      const file = await this.drive.files.get({
        fileId: fileId,
        fields: 'name,mimeType,size'
      });

      // Download file content
      const response = await this.drive.files.get({
        fileId: fileId,
        alt: 'media'
      }, { responseType: 'stream' });

      const chunks: Buffer[] = [];
      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.data.on('end', () => {
          const data = Buffer.concat(chunks);
          const duration = Date.now() - startTime;
          
          Logger.performance('download_file', duration, {
            fileId,
            fileName: file.data.name,
            fileSize: data.length
          });

          resolve({
            data,
            mimeType: file.data.mimeType,
            name: file.data.name
          });
        });
        response.data.on('error', reject);
      });
    } catch (error) {
      Logger.error('Failed to download file', error as Error, { fileId });
      throw error;
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    try {
      await this.drive.files.delete({
        fileId: fileId
      });

      Logger.info('File deleted successfully', { fileId });
    } catch (error) {
      Logger.error('Failed to delete file', error as Error, { fileId });
      throw error;
    }
  }

  // Folder operations
  async createFolder(name: string, parentId?: string): Promise<GoogleDriveFolder> {
    try {
      // Validate folder name
      const nameValidation = ValidationService.validateFolderName(name);
      if (!nameValidation.valid) {
        throw new Error(nameValidation.error);
      }

      const fileMetadata = {
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : undefined
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        fields: 'id,name,mimeType,modifiedTime,parents'
      });

      Logger.info('Folder created successfully', {
        folderId: response.data.id,
        name: response.data.name,
        parentId
      });

      return response.data;
    } catch (error) {
      Logger.error('Failed to create folder', error as Error, { name, parentId });
      throw error;
    }
  }

  async listFiles(folderId?: string, pageSize = 50, pageToken?: string): Promise<{
    files: (GoogleDriveFile | GoogleDriveFolder)[];
    nextPageToken?: string;
    totalCount?: number;
  }> {
    try {
      const query = folderId ? `'${folderId}' in parents` : 'parents in \'root\'';
      
      const response = await this.drive.files.list({
        q: query,
        pageSize: Math.min(pageSize, 100),
        pageToken: pageToken,
        fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime,parents,webViewLink)',
        orderBy: 'name'
      });

      return {
        files: response.data.files || [],
        nextPageToken: response.data.nextPageToken
      };
    } catch (error) {
      Logger.error('Failed to list files', error as Error, { folderId });
      throw error;
    }
  }

  async searchFiles(options: SearchOptions): Promise<{
    files: (GoogleDriveFile | GoogleDriveFolder)[];
    nextPageToken?: string;
    totalCount?: number;
  }> {
    try {
      // Validate search query
      const queryValidation = ValidationService.validateSearchQuery(options.query);
      if (!queryValidation.valid) {
        throw new Error(queryValidation.error);
      }

      let query = `name contains '${options.query}'`;
      
      if (options.folderId) {
        query += ` and '${options.folderId}' in parents`;
      }
      
      if (options.mimeType) {
        query += ` and mimeType = '${options.mimeType}'`;
      }

      const response = await this.drive.files.list({
        q: query,
        pageSize: Math.min(options.pageSize || 50, 100),
        pageToken: options.pageToken,
        fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime,parents,webViewLink)',
        orderBy: 'modifiedTime desc'
      });

      return {
        files: response.data.files || [],
        nextPageToken: response.data.nextPageToken
      };
    } catch (error) {
      Logger.error('Failed to search files', error as Error, { query: options.query });
      throw error;
    }
  }

  async getFile(fileId: string): Promise<GoogleDriveFile | GoogleDriveFolder> {
    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        fields: 'id,name,mimeType,size,modifiedTime,parents,webViewLink,webContentLink'
      });

      return response.data;
    } catch (error) {
      Logger.error('Failed to get file', error as Error, { fileId });
      throw error;
    }
  }

  async updateFile(fileId: string, updates: {
    name?: string;
    description?: string;
    parents?: string[];
  }): Promise<GoogleDriveFile | GoogleDriveFolder> {
    try {
      const response = await this.drive.files.update({
        fileId: fileId,
        resource: updates,
        fields: 'id,name,mimeType,size,modifiedTime,parents,webViewLink,webContentLink'
      });

      Logger.info('File updated successfully', { fileId, updates });
      return response.data;
    } catch (error) {
      Logger.error('Failed to update file', error as Error, { fileId, updates });
      throw error;
    }
  }

  async copyFile(fileId: string, newName: string, destinationFolderId?: string): Promise<GoogleDriveFile> {
    try {
      const fileMetadata = {
        name: newName,
        parents: destinationFolderId ? [destinationFolderId] : undefined
      };

      const response = await this.drive.files.copy({
        fileId: fileId,
        resource: fileMetadata,
        fields: 'id,name,mimeType,size,modifiedTime,parents,webViewLink,webContentLink'
      });

      Logger.info('File copied successfully', {
        originalFileId: fileId,
        newFileId: response.data.id,
        newName,
        destinationFolderId
      });

      return response.data;
    } catch (error) {
      Logger.error('Failed to copy file', error as Error, { fileId, newName, destinationFolderId });
      throw error;
    }
  }

  async getStorageQuota(): Promise<{
    limit: string;
    usage: string;
    usageInDrive: string;
    usageInDriveTrash: string;
  }> {
    try {
      const response = await this.drive.about.get({
        fields: 'storageQuota'
      });

      return response.data.storageQuota;
    } catch (error) {
      Logger.error('Failed to get storage quota', error as Error);
      throw error;
    }
  }

  async generateShareableLink(fileId: string, permission: 'reader' | 'writer' | 'commenter' = 'reader'): Promise<string> {
    try {
      // First, get the file to check if it's already shared
      const file = await this.getFile(fileId);
      
      if ('webViewLink' in file && file.webViewLink) {
        return file.webViewLink;
      }

      // Create a permission for the file
      await this.drive.permissions.create({
        fileId: fileId,
        resource: {
          role: permission,
          type: 'anyone'
        }
      });

      // Get the updated file with the shareable link
      const updatedFile = await this.getFile(fileId);
      
      if (!('webViewLink' in updatedFile) || !updatedFile.webViewLink) {
        throw new Error('Failed to generate shareable link');
      }

      Logger.info('Shareable link generated', { fileId, permission });
      return updatedFile.webViewLink;
    } catch (error) {
      Logger.error('Failed to generate shareable link', error as Error, { fileId, permission });
      throw error;
    }
  }

  async getFileStatistics(): Promise<{
    totalFiles: number;
    totalFolders: number;
    googleDocs: number;
    images: number;
    videos: number;
    other: number;
    recentFiles: number;
    monthlyFiles: number;
    averageFileSize: number;
  }> {
    try {
      // Get all files
      const allFiles = await this.drive.files.list({
        fields: 'files(id,name,mimeType,size,modifiedTime)',
        pageSize: 1000
      });

      const files = allFiles.data.files || [];
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      let totalFiles = 0;
      let totalFolders = 0;
      let googleDocs = 0;
      let images = 0;
      let videos = 0;
      let other = 0;
      let recentFiles = 0;
      let monthlyFiles = 0;
      let totalSize = 0;

      for (const file of files) {
        const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
        
        if (isFolder) {
          totalFolders++;
        } else {
          totalFiles++;
          
          if (file.mimeType?.startsWith('application/vnd.google-apps.')) {
            googleDocs++;
          } else if (file.mimeType?.startsWith('image/')) {
            images++;
          } else if (file.mimeType?.startsWith('video/')) {
            videos++;
          } else {
            other++;
          }

          if (file.size) {
            totalSize += parseInt(file.size);
          }

          const modifiedTime = new Date(file.modifiedTime || '');
          if (modifiedTime > weekAgo) {
            recentFiles++;
          }
          if (modifiedTime > monthAgo) {
            monthlyFiles++;
          }
        }
      }

      const averageFileSize = totalFiles > 0 ? totalSize / totalFiles : 0;

      return {
        totalFiles,
        totalFolders,
        googleDocs,
        images,
        videos,
        other,
        recentFiles,
        monthlyFiles,
        averageFileSize
      };
    } catch (error) {
      Logger.error('Failed to get file statistics', error as Error);
      throw error;
    }
  }

  // Chunked upload for large files (>100MB)
  async uploadFileChunked(options: FileUploadOptions, onProgress?: (progress: number) => void): Promise<GoogleDriveFile> {
    const startTime = Date.now();
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
    const fileSize = options.fileData.length;
    
    try {
      // Validate file name
      const nameValidation = ValidationService.validateFileName(options.fileName);
      if (!nameValidation.valid) {
        throw new Error(nameValidation.error);
      }

      // Validate file type
      const typeValidation = ValidationService.validateFileType(options.mimeType);
      if (!typeValidation.valid) {
        throw new Error(typeValidation.error);
      }

      // Validate file size
      const sizeValidation = ValidationService.validateFileSize(fileSize);
      if (!sizeValidation.valid) {
        throw new Error(sizeValidation.error);
      }

      const fileMetadata = {
        name: options.fileName,
        parents: options.folderId ? [options.folderId] : undefined,
        description: options.description
      };

      // For files smaller than chunk size, use regular upload
      if (fileSize <= CHUNK_SIZE) {
        return await this.uploadFile(options);
      }

      // Start resumable upload session
      const resumableSession = await this.drive.files.create({
        resource: fileMetadata,
        media: {
          mimeType: options.mimeType,
          body: null // Will be uploaded in chunks
        },
        fields: 'id'
      }, {
        onUploadProgress: (evt: any) => {
          if (onProgress && evt.bytesRead) {
            const progress = Math.round((evt.bytesRead / fileSize) * 100);
            onProgress(progress);
          }
        }
      });

      const fileId = resumableSession.data.id;
      let uploadedBytes = 0;

      // Upload file in chunks
      for (let start = 0; start < fileSize; start += CHUNK_SIZE) {
        const end = Math.min(start + CHUNK_SIZE, fileSize);
        const chunk = options.fileData.slice(start, end);
        
        await this.drive.files.update({
          fileId: fileId,
          media: {
            mimeType: options.mimeType,
            body: chunk
          },
          uploadType: 'media'
        });

        uploadedBytes += chunk.length;
        
        if (onProgress) {
          const progress = Math.round((uploadedBytes / fileSize) * 100);
          onProgress(progress);
        }

        Logger.debug('Uploaded chunk', {
          fileId,
          chunkStart: start,
          chunkEnd: end,
          chunkSize: chunk.length,
          totalUploaded: uploadedBytes,
          totalSize: fileSize
        });
      }

      // Get final file metadata
      const finalFile = await this.drive.files.get({
        fileId: fileId,
        fields: 'id,name,mimeType,size,modifiedTime,parents,webViewLink,webContentLink'
      });

      const duration = Date.now() - startTime;
      Logger.performance('chunked_upload_file', duration, {
        fileName: options.fileName,
        fileSize: fileSize,
        folderId: options.folderId,
        chunkCount: Math.ceil(fileSize / CHUNK_SIZE)
      });

      return finalFile.data;
    } catch (error) {
      Logger.error('Failed to upload file chunked', error as Error, {
        fileName: options.fileName,
        folderId: options.folderId,
        fileSize: fileSize
      });
      throw error;
    }
  }

  // Chunked download for large files
  async downloadFileChunked(fileId: string, onProgress?: (progress: number) => void): Promise<{ data: Buffer; mimeType: string; name: string; size: number }> {
    const startTime = Date.now();
    
    try {
      // Get file metadata first
      const file = await this.drive.files.get({
        fileId: fileId,
        fields: 'name,mimeType,size'
      });

      const fileSize = parseInt(file.data.size || '0');
      const fileName = file.data.name;
      const mimeType = file.data.mimeType;

      // For small files, use regular download
      if (fileSize <= 10 * 1024 * 1024) { // 10MB threshold
        const result = await this.downloadFile(fileId);
        return {
          data: result.data,
          mimeType: result.mimeType,
          name: result.name,
          size: fileSize
        };
      }

      // Download file content in chunks
      const response = await this.drive.files.get({
        fileId: fileId,
        alt: 'media'
      }, { responseType: 'stream' });

      const chunks: Buffer[] = [];
      let downloadedBytes = 0;

      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
          downloadedBytes += chunk.length;
          
          if (onProgress) {
            const progress = Math.round((downloadedBytes / fileSize) * 100);
            onProgress(progress);
          }
        });

        response.data.on('end', () => {
          const data = Buffer.concat(chunks);
          const duration = Date.now() - startTime;
          
          Logger.performance('chunked_download_file', duration, {
            fileId,
            fileName,
            fileSize: data.length,
            expectedSize: fileSize
          });

          resolve({
            data,
            mimeType,
            name: fileName,
            size: fileSize
          });
        });

        response.data.on('error', (error: Error) => {
          Logger.error('Chunked download stream error', error, { fileId });
          reject(error);
        });
      });
    } catch (error) {
      Logger.error('Failed to download file chunked', error as Error, { fileId });
      throw error;
    }
  }

  // Get upload progress for a specific file
  async getUploadProgress(fileId: string): Promise<{ progress: number; status: string }> {
    try {
      await this.drive.files.get({
        fileId: fileId,
        fields: 'size,modifiedTime'
      });

      // This is a simplified implementation
      // In a real scenario, you'd track upload progress in a database
      return {
        progress: 100,
        status: 'completed'
      };
    } catch (error) {
      Logger.error('Failed to get upload progress', error as Error, { fileId });
      throw error;
    }
  }

}
