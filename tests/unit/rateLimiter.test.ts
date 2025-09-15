import { RateLimiter } from '../../src/middleware/rateLimiter';
import { RateLimitModel } from '../../src/database/connection';

// Mock the database connection
jest.mock('../../src/database/connection', () => ({
  RateLimitModel: {
    get: jest.fn(),
    increment: jest.fn(),
    reset: jest.fn(),
    cleanup: jest.fn()
  }
}));

const mockRateLimitModel = RateLimitModel as jest.Mocked<typeof RateLimitModel>;

describe('RateLimiter', () => {
  const userId = BigInt('123456789012345678');
  const command = 'upload';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkRateLimit', () => {
    it('should allow request when no previous rate limit exists', async () => {
      mockRateLimitModel.get.mockResolvedValue(null);
      mockRateLimitModel.increment.mockResolvedValue({
        user_id: userId,
        command,
        count: 1,
        window_start: new Date()
      });

      const result = await RateLimiter.checkRateLimit(userId, command);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(19); // 20 - 1
      expect(result.error).toBeUndefined();
      expect(mockRateLimitModel.increment).toHaveBeenCalledWith(userId, command);
    });

    it('should allow request when window has expired', async () => {
      const expiredTime = new Date(Date.now() - 20 * 60 * 1000); // 20 minutes ago
      mockRateLimitModel.get.mockResolvedValue({
        user_id: userId,
        command,
        count: 15,
        window_start: expiredTime
      });
      mockRateLimitModel.reset.mockResolvedValue(true);

      const result = await RateLimiter.checkRateLimit(userId, command);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(19); // 20 - 1
      expect(mockRateLimitModel.reset).toHaveBeenCalledWith(userId, command);
    });

    it('should allow request when under limit', async () => {
      const recentTime = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      mockRateLimitModel.get.mockResolvedValue({
        user_id: userId,
        command,
        count: 10,
        window_start: recentTime
      });
      mockRateLimitModel.increment.mockResolvedValue({
        user_id: userId,
        command,
        count: 11,
        window_start: recentTime
      });

      const result = await RateLimiter.checkRateLimit(userId, command);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9); // 20 - 11
      expect(mockRateLimitModel.increment).toHaveBeenCalledWith(userId, command);
    });

    it('should deny request when limit exceeded', async () => {
      const recentTime = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      mockRateLimitModel.get.mockResolvedValue({
        user_id: userId,
        command,
        count: 20, // At limit
        window_start: recentTime
      });

      const result = await RateLimiter.checkRateLimit(userId, command);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.error).toContain('Rate limit exceeded');
      expect(mockRateLimitModel.increment).not.toHaveBeenCalled();
    });

    it('should handle unknown commands with default limits', async () => {
      const unknownCommand = 'unknown-command';
      mockRateLimitModel.get.mockResolvedValue(null);
      mockRateLimitModel.increment.mockResolvedValue({
        user_id: userId,
        command: unknownCommand,
        count: 1,
        window_start: new Date()
      });

      const result = await RateLimiter.checkRateLimit(userId, unknownCommand);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(100); // Default max - 1
    });

    it('should handle database errors gracefully', async () => {
      mockRateLimitModel.get.mockRejectedValue(new Error('Database error'));

      const result = await RateLimiter.checkRateLimit(userId, command);

      expect(result.allowed).toBe(true); // Should allow on error
      expect(result.remaining).toBe(100); // Default max
    });
  });

  describe('cleanupExpiredLimits', () => {
    it('should cleanup expired rate limits', async () => {
      mockRateLimitModel.cleanup.mockResolvedValue(5);

      await RateLimiter.cleanupExpiredLimits();

      expect(mockRateLimitModel.cleanup).toHaveBeenCalledWith(
        expect.any(Date)
      );
    });

    it('should handle cleanup errors gracefully', async () => {
      mockRateLimitModel.cleanup.mockRejectedValue(new Error('Cleanup error'));

      // Should not throw
      await expect(RateLimiter.cleanupExpiredLimits()).resolves.toBeUndefined();
    });
  });

  describe('getCommandLimits', () => {
    it('should return command limits', () => {
      const limits = RateLimiter.getCommandLimits();

      expect(limits).toHaveProperty('upload');
      expect(limits).toHaveProperty('download');
      expect(limits).toHaveProperty('login');
      expect(limits.upload.max).toBe(20);
      expect(limits.upload.windowMs).toBe(15 * 60 * 1000);
    });
  });

  describe('updateCommandLimit', () => {
    it('should update command limit', () => {
      const newMax = 30;
      const newWindowMs = 30 * 60 * 1000;

      RateLimiter.updateCommandLimit('test-command', newMax, newWindowMs);

      const limits = RateLimiter.getCommandLimits();
      expect(limits['test-command']).toEqual({
        max: newMax,
        windowMs: newWindowMs
      });
    });
  });

  describe('resetUserLimits', () => {
    it('should reset user limits', async () => {
      mockRateLimitModel.cleanup.mockResolvedValue(3);

      await RateLimiter.resetUserLimits(userId);

      expect(mockRateLimitModel.cleanup).toHaveBeenCalledWith(new Date(0));
    });
  });
});
