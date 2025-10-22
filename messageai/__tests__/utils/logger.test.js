/**
 * Logger utility tests
 */

import { Logger, PerfLogger, devLog } from '../../utils/logger';

// Mock Constants to control environment detection
jest.mock('expo-constants', () => ({
  appOwnership: null, // Simulate Expo Go
}));

describe('Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.console.log = jest.fn();
  });

  describe('debug logging', () => {
    it('should log debug messages in development', () => {
      Logger.debug('TEST', 'debug message');
      expect(console.log).toHaveBeenCalled();
    });

    it('should include timestamp and tag', () => {
      Logger.debug('AUTH', 'user login', { userId: '123' });
      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/\[\d{2}:\d{2}:\d{2}\.\d{3}\] DEBUG AUTH:/),
        'user login',
        { userId: '123' }
      );
    });
  });

  describe('specialized loggers', () => {
    it('should use firebase logger', () => {
      Logger.firebase('auth', 'user signed in', { uid: '123' });
      expect(console.log).toHaveBeenCalled();
    });

    it('should use network logger', () => {
      Logger.network('connection established');
      expect(console.log).toHaveBeenCalled();
    });

    it('should use photo logger', () => {
      Logger.photo('photo uploaded', { size: 1024 });
      expect(console.log).toHaveBeenCalled();
    });
  });

  describe('error logging', () => {
    it('should always log errors', () => {
      Logger.error('CRITICAL', 'something went wrong');
      expect(console.log).toHaveBeenCalled();
    });
  });
});

describe('PerfLogger', () => {
  it('should measure performance in development', () => {
    const perf = PerfLogger.start('test-operation');
    expect(perf).toHaveProperty('end');
    expect(typeof perf.end).toBe('function');
  });

  it('should log performance when ended', () => {
    const perf = PerfLogger.start('test-operation');
    perf.end({ data: 'test' });
    // Performance logging is tested by ensuring no errors are thrown
  });
});

describe('devLog compatibility', () => {
  it('should log in development mode', () => {
    devLog('test message');
    expect(console.log).toHaveBeenCalledWith('test message');
  });
});
