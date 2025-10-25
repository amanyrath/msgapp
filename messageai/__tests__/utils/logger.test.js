/**
 * Tests for logger utility
 */

import logger from '../../utils/logger';

// Mock console methods
const mockConsole = {
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('logger', () => {
  beforeEach(() => {
    // Clear mock calls
    Object.values(mockConsole).forEach(mock => mock.mockClear());
    
    // Mock console methods
    global.console = mockConsole;
  });

  describe('in development mode', () => {
    beforeEach(() => {
      // Mock __DEV__ to be true
      global.__DEV__ = true;
    });

    it('should log debug messages in development', () => {
      logger.debug('test message');
      expect(mockConsole.log).toHaveBeenCalledWith('🐛 DEBUG:', 'test message');
    });

    it('should log info messages in development', () => {
      logger.info('test info');
      expect(mockConsole.info).toHaveBeenCalledWith('test info');
    });

    it('should log warnings in development', () => {
      logger.warn('test warning');
      expect(mockConsole.warn).toHaveBeenCalledWith('test warning');
    });

    it('should log language messages in development', () => {
      logger.language('test language');
      expect(mockConsole.log).toHaveBeenCalledWith('🌍 LANG:', 'test language');
    });

    it('should log AI messages in development', () => {
      logger.ai('test AI');
      expect(mockConsole.log).toHaveBeenCalledWith('🤖 AI:', 'test AI');
    });

    it('should log Firebase messages in development', () => {
      logger.firebase('test firebase');
      expect(mockConsole.log).toHaveBeenCalledWith('🔥 FB:', 'test firebase');
    });
  });

  describe('in production mode', () => {
    beforeEach(() => {
      // Mock __DEV__ to be false
      global.__DEV__ = false;
      process.env.NODE_ENV = 'production';
    });

    it('should not log debug messages in production', () => {
      logger.debug('test message');
      expect(mockConsole.log).not.toHaveBeenCalled();
    });

    it('should not log info messages in production', () => {
      logger.info('test info');
      expect(mockConsole.info).not.toHaveBeenCalled();
    });

    it('should not log warnings in production', () => {
      logger.warn('test warning');
      expect(mockConsole.warn).not.toHaveBeenCalled();
    });

    it('should not log language messages in production', () => {
      logger.language('test language');
      expect(mockConsole.log).not.toHaveBeenCalled();
    });
  });

  describe('error logging', () => {
    it('should always log errors even in production', () => {
      global.__DEV__ = false;
      process.env.NODE_ENV = 'production';
      
      logger.error('test error');
      expect(mockConsole.error).toHaveBeenCalledWith('test error');
    });
  });

  it('should measure performance in development', () => {
    global.__DEV__ = true;
    
    logger.performance('test performance');
    expect(mockConsole.log).toHaveBeenCalledWith('⚡ PERF:', 'test performance');
  });

  describe('backward compatibility', () => {
    it('should export debugLog for backward compatibility', () => {
      const { debugLog } = require('../../utils/logger');
      expect(typeof debugLog).toBe('function');
    });

    it('should export errorLog for backward compatibility', () => {
      const { errorLog } = require('../../utils/logger');
      expect(typeof errorLog).toBe('function');
    });
  });

  describe('with multiple arguments', () => {
    it('should log in development mode', () => {
      global.__DEV__ = true;
      
      logger.log('message', { data: 'test' }, 123);
      expect(mockConsole.log).toHaveBeenCalledWith('message', { data: 'test' }, 123);
    });
  });
});
