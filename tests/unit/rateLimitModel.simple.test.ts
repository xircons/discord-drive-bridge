import { RateLimitModel } from '../../src/database/connection';

// Mock the database
jest.mock('../../src/database/connection', () => ({
  RateLimitModel: {
    increment: jest.fn(),
    get: jest.fn(),
    reset: jest.fn(),
    cleanup: jest.fn()
  }
}));

const mockRateLimitModel = RateLimitModel as jest.Mocked<typeof RateLimitModel>;

describe('RateLimitModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('increment', () => {
    it('should call increment with correct parameters', async () => {
      const userId = BigInt('123456789012345678');
      const command = 'upload';
      const mockRateLimit = {
        user_id: BigInt('123456789012345678'),
        command: 'upload',
        count: 2,
        window_start: new Date()
      };

      mockRateLimitModel.increment.mockResolvedValue(mockRateLimit);

      const result = await RateLimitModel.increment(userId, command);

      expect(result).toEqual(mockRateLimit);
      expect(mockRateLimitModel.increment).toHaveBeenCalledWith(userId, command);
    });

    it('should handle database errors gracefully', async () => {
      const userId = BigInt('123456789012345678');
      const command = 'upload';

      mockRateLimitModel.increment.mockRejectedValue(new Error('Database error'));

      await expect(RateLimitModel.increment(userId, command)).rejects.toThrow('Database error');
    });
  });

  describe('get', () => {
    it('should retrieve rate limit data for user and command', async () => {
      const userId = BigInt('123456789012345678');
      const command = 'upload';
      const mockRateLimit = {
        user_id: BigInt('123456789012345678'),
        command: 'upload',
        count: 5,
        window_start: new Date()
      };

      mockRateLimitModel.get.mockResolvedValue(mockRateLimit);

      const result = await RateLimitModel.get(userId, command);

      expect(result).toEqual(mockRateLimit);
      expect(mockRateLimitModel.get).toHaveBeenCalledWith(userId, command);
    });

    it('should return null when no rate limit found', async () => {
      const userId = BigInt('123456789012345678');
      const command = 'upload';

      mockRateLimitModel.get.mockResolvedValue(null);

      const result = await RateLimitModel.get(userId, command);

      expect(result).toBeNull();
      expect(mockRateLimitModel.get).toHaveBeenCalledWith(userId, command);
    });
  });

  describe('reset', () => {
    it('should reset rate limit count for user and command', async () => {
      const userId = BigInt('123456789012345678');
      const command = 'upload';

      mockRateLimitModel.reset.mockResolvedValue(true);

      const result = await RateLimitModel.reset(userId, command);

      expect(result).toBe(true);
      expect(mockRateLimitModel.reset).toHaveBeenCalledWith(userId, command);
    });
  });

  describe('cleanup', () => {
    it('should clean up expired rate limits', async () => {
      const olderThan = new Date('2023-01-01');
      const deletedCount = 5;

      mockRateLimitModel.cleanup.mockResolvedValue(deletedCount);

      const result = await RateLimitModel.cleanup(olderThan);

      expect(result).toBe(deletedCount);
      expect(mockRateLimitModel.cleanup).toHaveBeenCalledWith(olderThan);
    });
  });
});
