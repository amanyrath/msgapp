/**
 * Development Logger Utility
 * Guards console logs behind development flags for production builds
 */

const isDevelopment = __DEV__ || process.env.NODE_ENV === 'development';

export const logger = {
  log: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  info: (...args) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
  
  warn: (...args) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  
  error: (...args) => {
    // Always show errors, even in production
    console.error(...args);
  },
  
  debug: (...args) => {
    if (isDevelopment) {
      console.log('🐛 DEBUG:', ...args);
    }
  },
  
  // Special loggers for specific features
  language: (...args) => {
    if (isDevelopment) {
      console.log('🌍 LANG:', ...args);
    }
  },
  
  ai: (...args) => {
    if (isDevelopment) {
      console.log('🤖 AI:', ...args);
    }
  },
  
  firebase: (...args) => {
    if (isDevelopment) {
      console.log('🔥 FB:', ...args);
    }
  },
  
  performance: (...args) => {
    if (isDevelopment) {
      console.log('⚡ PERF:', ...args);
    }
  },
  
  ui: (...args) => {
    if (isDevelopment) {
      console.log('🎨 UI:', ...args);
    }
  }
};

// For backward compatibility
export const debugLog = logger.debug;
export const errorLog = logger.error;
export default logger;