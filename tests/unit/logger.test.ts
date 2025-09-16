// Mock config before importing logger
jest.mock('../../src/config', () => ({
  config: {
    logLevel: 'info'
  }
}));

import { Logger } from '../../src/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');
jest.mock('path');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;

describe('Logger', () => {
  let originalConsole: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock console methods
    originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug
    };
    
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
    console.info = jest.fn();
    console.debug = jest.fn();
    
    // Mock fs methods
    mockFs.existsSync.mockReturnValue(true);
    mockFs.mkdirSync.mockImplementation(() => '');
    mockFs.appendFileSync.mockImplementation(() => {});
    
    // Mock path methods
    mockPath.join.mockReturnValue('/test/logs/app.log');
    mockPath.dirname.mockReturnValue('/test/logs');
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.info = originalConsole.info;
    console.debug = originalConsole.debug;
  });

  describe('info', () => {
    it('should log info messages', () => {
      const message = 'Test info message';
      const meta = { userId: '123456789012345678' };
      
      Logger.info(message, meta);
      
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining(message),
        expect.objectContaining(meta)
      );
    });

    it('should log info messages without metadata', () => {
      const message = 'Test info message';
      
      Logger.info(message);
      
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining(message)
      );
    });
  });

  describe('error', () => {
    it('should log error messages', () => {
      const message = 'Test error message';
      const error = new Error('Test error');
      const meta = { userId: '123456789012345678' };
      
      Logger.error(message, error, meta);
      
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(message),
        expect.objectContaining({
          error: error.message,
          stack: error.stack
        }),
        expect.objectContaining(meta)
      );
    });

    it('should log error messages without error object', () => {
      const message = 'Test error message';
      const meta = { userId: '123456789012345678' };
      
      Logger.error(message, undefined, meta);
      
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(message),
        undefined,
        expect.objectContaining(meta)
      );
    });
  });

  describe('warn', () => {
    it('should log warning messages', () => {
      const message = 'Test warning message';
      const meta = { userId: '123456789012345678' };
      
      Logger.warn(message, meta);
      
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining(message),
        expect.objectContaining(meta)
      );
    });
  });

  describe('debug', () => {
    it('should log debug messages', () => {
      const message = 'Test debug message';
      const meta = { userId: '123456789012345678' };
      
      Logger.debug(message, meta);
      
      expect(console.debug).toHaveBeenCalledWith(
        expect.stringContaining(message),
        expect.objectContaining(meta)
      );
    });
  });

  describe('security', () => {
    it('should log security messages', () => {
      const message = 'Security event detected';
      const meta = { userId: '123456789012345678', eventType: 'suspicious_activity' };
      
      Logger.security(message, meta);
      
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining(message),
        expect.objectContaining(meta)
      );
    });
  });

  describe('audit', () => {
    it('should log audit messages', () => {
      const userId = BigInt('123456789012345678');
      const action = 'file_upload';
      const details = { fileId: 'file123' };
      
      Logger.audit(userId, action, details);
      
      expect(console.info).toHaveBeenCalledWith(
        'AUDIT',
        expect.objectContaining({
          userId: userId.toString(),
          action,
          fileId: 'file123'
        })
      );
    });
  });

  describe('file logging', () => {
    it('should write to log file', () => {
      const message = 'Test message';
      const meta = { userId: '123456789012345678' };
      
      Logger.info(message, meta);
      
      expect(mockFs.appendFileSync).toHaveBeenCalledWith(
        '/test/logs/app.log',
        expect.stringContaining(message)
      );
    });

    it('should create log directory if it does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      
      const message = 'Test message';
      Logger.info(message);
      
      expect(mockFs.mkdirSync).toHaveBeenCalledWith('/test/logs', { recursive: true });
    });
  });

  describe('log formatting', () => {
    it('should format log messages with timestamp', () => {
      const message = 'Test message';
      const meta = { userId: '123456789012345678' };
      
      Logger.info(message, meta);
      
      const logCall = (console.info as jest.Mock).mock.calls[0][0];
      expect(logCall).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    });

    it('should format log messages with level', () => {
      const message = 'Test message';
      
      Logger.info(message);
      const infoCall = (console.info as jest.Mock).mock.calls[0][0];
      expect(infoCall).toContain('[INFO]');
      
      Logger.error(message);
      const errorCall = (console.error as jest.Mock).mock.calls[0][0];
      expect(errorCall).toContain('[ERROR]');
      
      Logger.warn(message);
      const warnCall = (console.warn as jest.Mock).mock.calls[0][0];
      expect(warnCall).toContain('[WARN]');
      
      Logger.debug(message);
      const debugCall = (console.debug as jest.Mock).mock.calls[0][0];
      expect(debugCall).toContain('[DEBUG]');
    });

    it('should format log messages with service name', () => {
      const message = 'Test message';
      
      Logger.info(message);
      
      const logCall = (console.info as jest.Mock).mock.calls[0][0];
      expect(logCall).toContain('discord-drive-bot');
    });
  });

  describe('error handling', () => {
    it('should handle file write errors gracefully', () => {
      mockFs.appendFileSync.mockImplementation(() => {
        throw new Error('File write error');
      });
      
      // Should not throw
      expect(() => {
        Logger.info('Test message');
      }).not.toThrow();
    });

    it('should handle directory creation errors gracefully', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => {
        throw new Error('Directory creation error');
      });
      
      // Should not throw
      expect(() => {
        Logger.info('Test message');
      }).not.toThrow();
    });
  });

  describe('log levels', () => {
    it('should respect log level configuration', () => {
      // Test with different log levels
      Logger.debug('Debug message');
      Logger.info('Info message');
      Logger.warn('Warning message');
      Logger.error('Error message');
      
      expect(console.debug).toHaveBeenCalled();
      expect(console.info).toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('metadata handling', () => {
    it('should handle complex metadata objects', () => {
      const message = 'Test message';
      const meta = {
        userId: '123456789012345678',
        action: 'file_upload',
        fileInfo: {
          name: 'test.txt',
          size: 1024,
          type: 'text/plain'
        },
        timestamp: new Date().toISOString()
      };
      
      Logger.info(message, meta);
      
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining(message),
        expect.objectContaining(meta)
      );
    });

    it('should handle circular references in metadata', () => {
      const message = 'Test message';
      const meta: any = { userId: '123456789012345678' };
      meta.self = meta; // Create circular reference
      
      Logger.info(message, meta);
      
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining(message),
        expect.any(Object)
      );
    });
  });

  describe('performance', () => {
    it('should not block on file operations', () => {
      const start = Date.now();
      
      // Log multiple messages
      for (let i = 0; i < 100; i++) {
        Logger.info(`Message ${i}`);
      }
      
      const end = Date.now();
      const duration = end - start;
      
      // Should complete quickly (less than 100ms for 100 messages)
      expect(duration).toBeLessThan(100);
    });
  });
});
