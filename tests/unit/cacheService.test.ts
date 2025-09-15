import { CacheService } from '../../src/services/cacheService';

// Mock Redis client
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    on: jest.fn()
  }))
}));

describe('CacheService Singleton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear the singleton instance
    (CacheService as any).instance = undefined;
  });

  describe('getInstance', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = CacheService.getInstance();
      const instance2 = CacheService.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(CacheService);
    });

    it('should create only one instance', () => {
      const instance1 = CacheService.getInstance();
      const instance2 = CacheService.getInstance();
      const instance3 = CacheService.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);
      expect(instance1).toBe(instance3);
    });

    it('should maintain state across multiple getInstance calls', () => {
      const instance1 = CacheService.getInstance();
      const instance2 = CacheService.getInstance();

      // Both instances should be the same object
      expect(instance1).toBe(instance2);
    });
  });

  describe('Redis operations', () => {
    let cacheService: CacheService;
    let mockRedisClient: any;

    beforeEach(() => {
      cacheService = CacheService.getInstance();
      mockRedisClient = (cacheService as any).client;
    });

    describe('get', () => {
      it('should return null when not connected', async () => {
        (cacheService as any).isConnected = false;
        mockRedisClient.get.mockResolvedValue('test_value');

        const result = await cacheService.get('test_key');

        expect(result).toBeNull();
        expect(mockRedisClient.get).not.toHaveBeenCalled();
      });

      it('should return value when connected', async () => {
        (cacheService as any).isConnected = true;
        mockRedisClient.get.mockResolvedValue('test_value');

        const result = await cacheService.get('test_key');

        expect(result).toBe('test_value');
        expect(mockRedisClient.get).toHaveBeenCalledWith('test_key');
      });

      it('should handle Redis errors gracefully', async () => {
        (cacheService as any).isConnected = true;
        mockRedisClient.get.mockRejectedValue(new Error('Redis error'));

        const result = await cacheService.get('test_key');

        expect(result).toBeNull();
      });
    });

    describe('set', () => {
      it('should return false when not connected', async () => {
        (cacheService as any).isConnected = false;
        mockRedisClient.setEx.mockResolvedValue('OK');

        const result = await cacheService.set('test_key', 'test_value', 60);

        expect(result).toBe(false);
        expect(mockRedisClient.setEx).not.toHaveBeenCalled();
      });

      it('should set value with TTL when connected', async () => {
        (cacheService as any).isConnected = true;
        mockRedisClient.setEx.mockResolvedValue('OK');

        const result = await cacheService.set('test_key', 'test_value', 60);

        expect(result).toBe(true);
        expect(mockRedisClient.setEx).toHaveBeenCalledWith('test_key', 60, 'test_value');
      });

      it('should set value without TTL when connected', async () => {
        (cacheService as any).isConnected = true;
        mockRedisClient.set.mockResolvedValue('OK');

        const result = await cacheService.set('test_key', 'test_value');

        expect(result).toBe(true);
        expect(mockRedisClient.set).toHaveBeenCalledWith('test_key', 'test_value');
      });

      it('should handle Redis errors gracefully', async () => {
        (cacheService as any).isConnected = true;
        mockRedisClient.setEx.mockRejectedValue(new Error('Redis error'));

        const result = await cacheService.set('test_key', 'test_value', 60);

        expect(result).toBe(false);
      });
    });

    describe('del', () => {
      it('should return false when not connected', async () => {
        (cacheService as any).isConnected = false;
        mockRedisClient.del.mockResolvedValue(1);

        const result = await cacheService.del('test_key');

        expect(result).toBe(false);
        expect(mockRedisClient.del).not.toHaveBeenCalled();
      });

      it('should delete key when connected', async () => {
        (cacheService as any).isConnected = true;
        mockRedisClient.del.mockResolvedValue(1);

        const result = await cacheService.del('test_key');

        expect(result).toBe(true);
        expect(mockRedisClient.del).toHaveBeenCalledWith('test_key');
      });

      it('should handle Redis errors gracefully', async () => {
        (cacheService as any).isConnected = true;
        mockRedisClient.del.mockRejectedValue(new Error('Redis error'));

        const result = await cacheService.del('test_key');

        expect(result).toBe(false);
      });
    });

    describe('exists', () => {
      it('should return false when not connected', async () => {
        (cacheService as any).isConnected = false;
        mockRedisClient.exists.mockResolvedValue(1);

        const result = await cacheService.exists('test_key');

        expect(result).toBe(false);
        expect(mockRedisClient.exists).not.toHaveBeenCalled();
      });

      it('should check key existence when connected', async () => {
        (cacheService as any).isConnected = true;
        mockRedisClient.exists.mockResolvedValue(1);

        const result = await cacheService.exists('test_key');

        expect(result).toBe(true);
        expect(mockRedisClient.exists).toHaveBeenCalledWith('test_key');
      });

      it('should handle Redis errors gracefully', async () => {
        (cacheService as any).isConnected = true;
        mockRedisClient.exists.mockRejectedValue(new Error('Redis error'));

        const result = await cacheService.exists('test_key');

        expect(result).toBe(false);
      });
    });

    describe('getJson and setJson', () => {
      it('should serialize and deserialize JSON objects', async () => {
        (cacheService as any).isConnected = true;
        const testObject = { name: 'test', value: 123 };
        const serialized = JSON.stringify(testObject);
        
        mockRedisClient.get.mockResolvedValue(serialized);

        const result = await cacheService.getJson('test_key');

        expect(result).toEqual(testObject);
        expect(mockRedisClient.get).toHaveBeenCalledWith('test_key');
      });

      it('should return null for invalid JSON', async () => {
        (cacheService as any).isConnected = true;
        mockRedisClient.get.mockResolvedValue('invalid json');

        const result = await cacheService.getJson('test_key');

        expect(result).toBeNull();
      });

      it('should set JSON objects', async () => {
        (cacheService as any).isConnected = true;
        const testObject = { name: 'test', value: 123 };
        mockRedisClient.setEx.mockResolvedValue('OK');

        const result = await cacheService.setJson('test_key', testObject, 60);

        expect(result).toBe(true);
        expect(mockRedisClient.setEx).toHaveBeenCalledWith('test_key', 60, JSON.stringify(testObject));
      });
    });
  });

  describe('Cache key generators', () => {
    it('should generate user cache keys', () => {
      const userId = BigInt('123456789012345678');
      const key = CacheService.getUserCacheKey(userId, 'data');
      expect(key).toBe('user:123456789012345678:data');
    });

    it('should generate file cache keys', () => {
      const fileId = 'test_file_id';
      const key = CacheService.getFileCacheKey(fileId, 'metadata');
      expect(key).toBe('file:test_file_id:metadata');
    });

    it('should generate search cache keys', () => {
      const query = 'test query';
      const key = CacheService.getSearchCacheKey(query);
      expect(key).toBe(`search:${Buffer.from(query).toString('base64')}`);
    });

    it('should generate search cache keys with folder', () => {
      const query = 'test query';
      const folderId = 'test_folder_id';
      const key = CacheService.getSearchCacheKey(query, folderId);
      expect(key).toBe(`search:${Buffer.from(query).toString('base64')}:${folderId}`);
    });

    it('should generate storage cache keys', () => {
      const userId = BigInt('123456789012345678');
      const key = CacheService.getStorageCacheKey(userId);
      expect(key).toBe('storage:123456789012345678');
    });
  });

  describe('TTL constants', () => {
    it('should have correct TTL values', () => {
      expect(CacheService.TTL.USER_DATA).toBe(3600); // 1 hour
      expect(CacheService.TTL.FILE_METADATA).toBe(1800); // 30 minutes
      expect(CacheService.TTL.SEARCH_RESULTS).toBe(900); // 15 minutes
      expect(CacheService.TTL.STORAGE_INFO).toBe(300); // 5 minutes
      expect(CacheService.TTL.RATE_LIMIT).toBe(900); // 15 minutes
    });
  });
});
