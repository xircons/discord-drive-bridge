import { RateLimitModel } from '../database/connection';
import { Logger } from '../utils/logger';
import { config } from '../config';

export class RateLimiter {
  private static readonly commandLimits: Record<string, { max: number; windowMs: number }> = {
    // Authentication commands - more restrictive
    'login': { max: 5, windowMs: 15 * 60 * 1000 }, // 5 per 15 minutes
    'logout': { max: 10, windowMs: 15 * 60 * 1000 }, // 10 per 15 minutes
    'status': { max: 20, windowMs: 15 * 60 * 1000 }, // 20 per 15 minutes

    // File operations - moderate limits
    'upload': { max: 20, windowMs: 15 * 60 * 1000 }, // 20 per 15 minutes
    'download': { max: 30, windowMs: 15 * 60 * 1000 }, // 30 per 15 minutes
    'delete': { max: 10, windowMs: 15 * 60 * 1000 }, // 10 per 15 minutes
    'list': { max: 50, windowMs: 15 * 60 * 1000 }, // 50 per 15 minutes

    // Advanced operations - more restrictive
    'create-folder': { max: 10, windowMs: 15 * 60 * 1000 }, // 10 per 15 minutes
    'rename': { max: 15, windowMs: 15 * 60 * 1000 }, // 15 per 15 minutes
    'move': { max: 15, windowMs: 15 * 60 * 1000 }, // 15 per 15 minutes
    'copy': { max: 15, windowMs: 15 * 60 * 1000 }, // 15 per 15 minutes
    'share': { max: 20, windowMs: 15 * 60 * 1000 }, // 20 per 15 minutes

    // Bulk operations - very restrictive
    'bulk-upload': { max: 3, windowMs: 60 * 60 * 1000 }, // 3 per hour
    'bulk-download': { max: 5, windowMs: 60 * 60 * 1000 }, // 5 per hour

    // Utility commands - more lenient
    'search': { max: 100, windowMs: 15 * 60 * 1000 }, // 100 per 15 minutes
    'recent': { max: 30, windowMs: 15 * 60 * 1000 }, // 30 per 15 minutes
    'storage': { max: 20, windowMs: 15 * 60 * 1000 }, // 20 per 15 minutes
    'favorites': { max: 20, windowMs: 15 * 60 * 1000 }, // 20 per 15 minutes
    'help': { max: 50, windowMs: 15 * 60 * 1000 } // 50 per 15 minutes
  };

  static   async checkRateLimit(userId: bigint, command: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: Date;
    max: number;
    error?: string;
  }> {
    try {
      const limits = this.commandLimits[command];
      if (!limits) {
        // Unknown command, use default limits
        return {
          allowed: true,
          remaining: config.security.rateLimit.max,
          resetTime: new Date(Date.now() + config.security.rateLimit.windowMs),
          max: config.security.rateLimit.max
        };
      }

      const now = new Date();
      const windowStart = new Date(now.getTime() - limits.windowMs);

      // Get current rate limit data
      const rateLimit = await RateLimitModel.get(userId, command);

      if (!rateLimit) {
        // No previous requests, allow and create new record
        await RateLimitModel.increment(userId, command);
        return {
          allowed: true,
          remaining: limits.max - 1,
          resetTime: new Date(now.getTime() + limits.windowMs),
          max: limits.max
        };
      }

      // Check if window has expired
      if (rateLimit.window_start < windowStart) {
        // Window expired, reset counter
        await RateLimitModel.reset(userId, command);
        return {
          allowed: true,
          remaining: limits.max - 1,
          resetTime: new Date(now.getTime() + limits.windowMs),
          max: limits.max
        };
      }

      // Check if limit exceeded
      if (rateLimit.count >= limits.max) {
        const resetTime = new Date(rateLimit.window_start.getTime() + limits.windowMs);
        
        Logger.security('Rate limit exceeded', {
          userId: userId.toString(),
          command,
          count: rateLimit.count,
          max: limits.max,
          windowStart: rateLimit.window_start
        });

        return {
          allowed: false,
          remaining: 0,
          resetTime,
          max: limits.max,
          error: `Rate limit exceeded. You can use this command ${limits.max} times per ${Math.round(limits.windowMs / 60000)} minutes. Try again at ${resetTime.toISOString()}.`
        };
      }

      // Increment counter
      await RateLimitModel.increment(userId, command);
      
      return {
        allowed: true,
        remaining: limits.max - rateLimit.count - 1,
        resetTime: new Date(rateLimit.window_start.getTime() + limits.windowMs),
        max: limits.max
      };
    } catch (error) {
      Logger.error('Rate limit check failed', error as Error, { userId: userId.toString(), command });
      
      // On error, allow the request but log the issue
      return {
        allowed: true,
        remaining: config.security.rateLimit.max,
        resetTime: new Date(Date.now() + config.security.rateLimit.windowMs),
        max: config.security.rateLimit.max
      };
    }
  }

  static async cleanupExpiredLimits(): Promise<void> {
    try {
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      const deleted = await RateLimitModel.cleanup(cutoffTime);
      
      if (deleted > 0) {
        Logger.info('Cleaned up expired rate limits', { deletedCount: deleted });
      }
    } catch (error) {
      Logger.error('Failed to cleanup expired rate limits', error as Error);
    }
  }

  static getCommandLimits(): Record<string, { max: number; windowMs: number }> {
    return { ...this.commandLimits };
  }

  static updateCommandLimit(command: string, max: number, windowMs: number): void {
    this.commandLimits[command] = { max, windowMs };
    Logger.info('Updated rate limit for command', { command, max, windowMs });
  }

  static async resetUserLimits(_userId: bigint): Promise<void> {
    await RateLimitModel.cleanup(new Date(0)); // Delete all records for user
  }
}
