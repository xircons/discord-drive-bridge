import { BackupService } from '../../src/services/backupService';
import { GoogleDriveService } from '../../src/services/googleDriveService';
import { OAuthService } from '../../src/services/oauthService';
import { UserModel } from '../../src/database/connection';
// import { CacheService } from '../../src/services/cacheService';

// Mock dependencies
jest.mock('../../src/services/googleDriveService');
jest.mock('../../src/services/oauthService');
jest.mock('../../src/database/connection');
jest.mock('../../src/services/cacheService');
jest.mock('node-cron', () => ({
  schedule: jest.fn(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    destroy: jest.fn()
  }))
}));

const mockGoogleDriveService = GoogleDriveService as jest.MockedClass<typeof GoogleDriveService>;
const mockOAuthService = OAuthService as jest.MockedClass<typeof OAuthService>;
// const mockUserModel = UserModel as jest.Mocked<typeof UserModel>;

// Mock CacheService properly
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

describe('BackupService', () => {
  let backupService: BackupService;
  let mockGoogleDrive: any;
  let mockOAuth: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset singleton instance
    (BackupService as any).instance = undefined;
    
    // Mock Google Drive Service
    mockGoogleDrive = {
      listFiles: jest.fn(),
      downloadFile: jest.fn(),
      createFolder: jest.fn(),
      uploadFile: jest.fn()
    };
    mockGoogleDriveService.mockImplementation(() => mockGoogleDrive);
    
    // Mock OAuth Service
    mockOAuth = {
      getOAuth2Client: jest.fn(),
      isUserAuthenticated: jest.fn()
    };
    mockOAuthService.mockImplementation(() => mockOAuth);
    
    // Mock Cache Service
    // Cache service is already mocked above
    const mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn()
    };
    
    backupService = BackupService.getInstance();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = BackupService.getInstance();
      const instance2 = BackupService.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('createSchedule', () => {
    it('should create a new backup schedule', async () => {
      const userId = '123456789012345678';
      const folderId = 'folder123';
      const folderName = 'Test Folder';
      const cronExpression = '0 2 * * *'; // Daily at 2 AM

      const result = await backupService.createSchedule(userId, folderId, folderName, cronExpression);

      expect(result).toMatchObject({
        id: expect.any(String),
        userId,
        folderId,
        folderName,
        cronExpression,
        enabled: true
      });
    });

    it('should validate cron expression', async () => {
      const userId = '123456789012345678';
      const folderId = 'folder123';
      const folderName = 'Test Folder';
      const cronExpression = 'invalid-cron';

      await expect(backupService.createSchedule(userId, folderId, folderName, cronExpression))
        .rejects.toThrow('Invalid cron expression');
    });
  });

  describe('getSchedule', () => {
    it('should return schedule by ID', async () => {
      const userId = '123456789012345678';
      const folderId = 'folder123';
      const folderName = 'Test Folder';
      const cronExpression = '0 2 * * *';

      const created = await backupService.createSchedule(userId, folderId, folderName, cronExpression);
      const retrieved = await backupService.getSchedule(created.id);

      expect(retrieved).toEqual(created);
    });

    it('should return null for non-existent schedule', async () => {
      const result = await backupService.getSchedule('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('updateSchedule', () => {
    it('should update existing schedule', async () => {
      const userId = '123456789012345678';
      const folderId = 'folder123';
      const folderName = 'Test Folder';
      const cronExpression = '0 2 * * *';

      const created = await backupService.createSchedule(userId, folderId, folderName, cronExpression);
      const updates = {
        folderName: 'Updated Folder',
        enabled: false
      };

      const updated = await backupService.updateSchedule(created.id, updates);

      expect(updated?.folderName).toBe('Updated Folder');
      expect(updated?.enabled).toBe(false);
    });

    it('should return null for non-existent schedule', async () => {
      const result = await backupService.updateSchedule('non-existent-id', { enabled: false });
      expect(result).toBeNull();
    });
  });

  describe('deleteSchedule', () => {
    it('should delete existing schedule', async () => {
      const userId = '123456789012345678';
      const folderId = 'folder123';
      const folderName = 'Test Folder';
      const cronExpression = '0 2 * * *';

      const created = await backupService.createSchedule(userId, folderId, folderName, cronExpression);
      const result = await backupService.deleteSchedule(created.id);

      expect(result).toBe(true);
      
      const retrieved = await backupService.getSchedule(created.id);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent schedule', async () => {
      const result = await backupService.deleteSchedule('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('getUserSchedules', () => {
    it('should return all schedules for a user', async () => {
      const userId = '123456789012345678';
      
      const schedule1 = await backupService.createSchedule(userId, 'folder1', 'Folder 1', '0 2 * * *');
      const schedule2 = await backupService.createSchedule(userId, 'folder2', 'Folder 2', '0 3 * * *');

      const schedules = await backupService.getUserSchedules(userId);

      expect(schedules).toHaveLength(2);
      expect(schedules).toContainEqual(schedule1);
      expect(schedules).toContainEqual(schedule2);
    });

    it('should return empty array for user with no schedules', async () => {
      const schedules = await backupService.getUserSchedules('123456789012345678');
      expect(schedules).toHaveLength(0);
    });
  });

  describe('executeBackup', () => {
    it('should execute backup successfully', async () => {
      const userId = '123456789012345678';
      const folderId = 'folder123';
      const folderName = 'Test Folder';
      const cronExpression = '0 2 * * *';

      const schedule = await backupService.createSchedule(userId, folderId, folderName, cronExpression);
      const result = await backupService.executeBackup(schedule.id);

      expect(result).toMatchObject({
        id: expect.any(String),
        scheduleId: schedule.id,
        userId,
        status: 'pending'
      });
    });

    it('should throw error for non-existent schedule', async () => {
      await expect(backupService.executeBackup('non-existent-id'))
        .rejects.toThrow('Schedule not found');
    });
  });

  describe('getUserBackupJobs', () => {
    it('should return backup jobs for user', async () => {
      const userId = '123456789012345678';
      const folderId = 'folder123';
      const folderName = 'Test Folder';
      const cronExpression = '0 2 * * *';

      const schedule = await backupService.createSchedule(userId, folderId, folderName, cronExpression);
      await backupService.executeBackup(schedule.id);
      
      const jobs = backupService.getUserBackupJobs(userId);
      
      expect(jobs).toHaveLength(1);
      expect(jobs[0].userId).toBe(userId);
    });
  });

  describe('getBackupStats', () => {
    it('should return backup statistics', async () => {
      const userId = '123456789012345678';
      const folderId = 'folder123';
      const folderName = 'Test Folder';
      const cronExpression = '0 2 * * *';

      await backupService.createSchedule(userId, folderId, folderName, cronExpression);
      
      const stats = backupService.getBackupStats();
      
      expect(stats).toMatchObject({
        totalSchedules: expect.any(Number),
        activeSchedules: expect.any(Number),
        totalJobs: expect.any(Number),
        completedJobs: expect.any(Number),
        failedJobs: expect.any(Number)
      });
    });
  });

  describe('cleanupOldJobs', () => {
    it('should cleanup old backup jobs', () => {
      // This method doesn't return a count, it just cleans up
      expect(() => backupService.cleanupOldJobs()).not.toThrow();
    });
  });
});
