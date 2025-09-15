import { createClient, RedisClientType } from 'redis';
import { Logger } from '../utils/logger';

export class CacheService {
  private static instance: CacheService;
  private client: RedisClientType;
  private isConnected: boolean = false;

  private constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    this.setupEventHandlers();
  }

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      Logger.info('Redis client connected');
      this.isConnected = true;
    });

    this.client.on('error', (error) => {
      Logger.error('Redis client error', error);
      this.isConnected = false;
    });

    this.client.on('disconnect', () => {
      Logger.warn('Redis client disconnected');
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      try {
        await this.client.connect();
        Logger.info('Connected to Redis cache');
      } catch (error) {
        Logger.error('Failed to connect to Redis', error as Error);
        throw error;
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.disconnect();
      Logger.info('Disconnected from Redis cache');
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.isConnected) {
      return null;
    }

    try {
      return await this.client.get(key);
    } catch (error) {
      Logger.error('Redis GET error', error as Error, { key });
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      Logger.error('Redis SET error', error as Error, { key });
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      Logger.error('Redis DEL error', error as Error, { key });
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      Logger.error('Redis EXISTS error', error as Error, { key });
      return false;
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as T;
    } catch (error) {
      Logger.error('Failed to parse cached JSON', error as Error, { key });
      return null;
    }
  }

  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
    try {
      const jsonString = JSON.stringify(value);
      return await this.set(key, jsonString, ttlSeconds);
    } catch (error) {
      Logger.error('Failed to stringify JSON for cache', error as Error, { key });
      return false;
    }
  }

  // Cache key generators
  static getUserCacheKey(userId: bigint, type: string): string {
    return `user:${userId}:${type}`;
  }

  static getFileCacheKey(fileId: string, type: string): string {
    return `file:${fileId}:${type}`;
  }

  static getSearchCacheKey(query: string, folderId?: string): string {
    const folder = folderId ? `:${folderId}` : '';
    return `search:${Buffer.from(query).toString('base64')}${folder}`;
  }

  static getStorageCacheKey(userId: bigint): string {
    return `storage:${userId}`;
  }

  // Cache TTL constants
  static readonly TTL = {
    USER_DATA: 3600, // 1 hour
    FILE_METADATA: 1800, // 30 minutes
    SEARCH_RESULTS: 900, // 15 minutes
    STORAGE_INFO: 300, // 5 minutes
    RATE_LIMIT: 900 // 15 minutes
  };
}
