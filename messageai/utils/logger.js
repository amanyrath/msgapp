/**
 * Development and production logging utility
 * Replaces console.log with conditional, structured logging
 */

import Constants from 'expo-constants';

// Environment detection
const isDevelopment = () => {
  return __DEV__ || Constants.appOwnership === 'expo' || Constants.appOwnership === null;
};

const isProduction = () => {
  return Constants.appOwnership === 'standalone';
};

// Log levels
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

// Current log level (can be configured)
const CURRENT_LOG_LEVEL = isDevelopment() ? LOG_LEVELS.DEBUG : LOG_LEVELS.WARN;

/**
 * Core logging function
 * @param {string} level - Log level (DEBUG, INFO, WARN, ERROR)
 * @param {string} tag - Log tag/category
 * @param {string} message - Log message
 * @param {any} data - Additional data to log
 */
const log = (level, tag, message, data = null) => {
  if (LOG_LEVELS[level] < CURRENT_LOG_LEVEL) {
    return; // Skip if below current log level
  }

  const timestamp = new Date().toISOString().substr(11, 12); // HH:MM:SS.mmm
  const prefix = `[${timestamp}] ${level.padEnd(5)} ${tag}:`;
  
  if (data) {
    console.log(prefix, message, data);
  } else {
    console.log(prefix, message);
  }
};

/**
 * Development-only logging utilities
 */
export const Logger = {
  /**
   * Debug level logging (development only)
   */
  debug: (tag, message, data) => {
    if (isDevelopment()) {
      log('DEBUG', tag, message, data);
    }
  },

  /**
   * Informational logging
   */
  info: (tag, message, data) => {
    log('INFO', tag, message, data);
  },

  /**
   * Warning logging
   */
  warn: (tag, message, data) => {
    log('WARN', tag, message, data);
  },

  /**
   * Error logging (always shown)
   */
  error: (tag, message, data) => {
    log('ERROR', tag, message, data);
  },

  /**
   * Firebase operation logging
   */
  firebase: (operation, message, data) => {
    Logger.debug('Firebase', `${operation}: ${message}`, data);
  },

  /**
   * Network operation logging
   */
  network: (message, data) => {
    Logger.debug('Network', message, data);
  },

  /**
   * Photo operation logging
   */
  photo: (message, data) => {
    Logger.debug('Photo', message, data);
  },

  /**
   * Authentication logging
   */
  auth: (message, data) => {
    Logger.debug('Auth', message, data);
  },

  /**
   * UI interaction logging
   */
  ui: (message, data) => {
    Logger.debug('UI', message, data);
  },

  /**
   * Performance logging
   */
  perf: (operation, duration, data) => {
    Logger.debug('Perf', `${operation} took ${duration}ms`, data);
  },
};

/**
 * Performance measurement utility
 */
export const PerfLogger = {
  start: (operation) => {
    if (isDevelopment()) {
      return {
        operation,
        startTime: Date.now(),
        end: function(data) {
          const duration = Date.now() - this.startTime;
          Logger.perf(this.operation, duration, data);
        }
      };
    }
    return { end: () => {} }; // No-op in production
  }
};

/**
 * Conditional console replacement for backward compatibility
 * Use this to gradually replace console.log statements
 */
export const devLog = (...args) => {
  if (isDevelopment()) {
    console.log(...args);
  }
};

export const devWarn = (...args) => {
  if (isDevelopment()) {
    console.warn(...args);
  }
};

export const devError = (...args) => {
  // Always log errors
  console.error(...args);
};

export default Logger;
