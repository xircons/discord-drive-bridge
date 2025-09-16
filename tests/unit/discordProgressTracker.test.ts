import { DiscordProgressTracker } from '../../src/services/discordProgressTracker';
// import { Logger } from '../../src/utils/logger';

// Mock Logger
jest.mock('../../src/utils/logger');

describe('DiscordProgressTracker', () => {
  let tracker: DiscordProgressTracker;
  let mockInteraction: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Discord interaction
    mockInteraction = {
      user: { id: '123456789012345678' },
      followUp: jest.fn(),
      editReply: jest.fn(),
      reply: jest.fn()
    };
    
    tracker = DiscordProgressTracker.getInstance();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = DiscordProgressTracker.getInstance();
      const instance2 = DiscordProgressTracker.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('trackUploadProgress', () => {
    it('should track upload progress', async () => {
      const fileName = 'test.txt';
      const fileSize = 1024;
      const uploadFunction = jest.fn().mockResolvedValue({ id: 'file123' });

      const result = await tracker.trackUploadProgress(
        mockInteraction,
        fileName,
        fileSize,
        uploadFunction
      );

      expect(uploadFunction).toHaveBeenCalled();
      expect(result).toEqual({ id: 'file123' });
    });

    it('should handle upload errors', async () => {
      const fileName = 'test.txt';
      const fileSize = 1024;
      const uploadFunction = jest.fn().mockRejectedValue(new Error('Upload failed'));

      await expect(tracker.trackUploadProgress(
        mockInteraction,
        fileName,
        fileSize,
        uploadFunction
      )).rejects.toThrow('Upload failed');
    });
  });

  describe('trackDownloadProgress', () => {
    it('should track download progress', async () => {
      const fileName = 'test.txt';
      const fileSize = 1024;
      const downloadFunction = jest.fn().mockResolvedValue(Buffer.from('test content'));

      const result = await tracker.trackDownloadProgress(
        mockInteraction,
        fileName,
        fileSize,
        downloadFunction
      );

      expect(downloadFunction).toHaveBeenCalled();
      expect(result).toEqual(Buffer.from('test content'));
    });

    it('should handle download errors', async () => {
      const fileName = 'test.txt';
      const fileSize = 1024;
      const downloadFunction = jest.fn().mockRejectedValue(new Error('Download failed'));

      await expect(tracker.trackDownloadProgress(
        mockInteraction,
        fileName,
        fileSize,
        downloadFunction
      )).rejects.toThrow('Download failed');
    });
  });

  describe('cleanup', () => {
    it('should cleanup intervals', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      tracker.cleanup();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });
});