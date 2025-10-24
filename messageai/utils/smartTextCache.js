/**
 * Smart Text Caching System
 * Optimizes performance for SmartTextInput and SmartTextAssistant
 */

// Cache for language detection results
const languageDetectionCache = new Map();
const suggestionCache = new Map();

// Cache expiry times
const LANGUAGE_CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
const SUGGESTION_CACHE_EXPIRY = 10 * 60 * 1000; // 10 minutes

/**
 * Generate cache key for text similarity
 * @param {string} text - Input text
 * @returns {string} - Cache key
 */
function generateTextCacheKey(text) {
  // Normalize text for caching (remove extra spaces, lowercase for comparison)
  const normalized = text.toLowerCase().trim().replace(/\s+/g, ' ');
  
  // Create similarity key based on first 50 characters and length
  const prefix = normalized.substring(0, 50);
  const lengthGroup = Math.floor(normalized.length / 20) * 20; // Group by 20-char buckets
  
  return `${prefix}:${lengthGroup}`;
}

/**
 * Check if two texts are similar enough to use cached results
 * @param {string} text1 - First text
 * @param {string} text2 - Second text  
 * @returns {boolean} - Whether texts are similar
 */
function areTextsSimilar(text1, text2) {
  if (!text1 || !text2) return false;
  
  const normalize = (t) => t.toLowerCase().trim().replace(/\s+/g, ' ');
  const norm1 = normalize(text1);
  const norm2 = normalize(text2);
  
  // Same text
  if (norm1 === norm2) return true;
  
  // Similar length and high character overlap
  const lengthRatio = Math.min(norm1.length, norm2.length) / Math.max(norm1.length, norm2.length);
  if (lengthRatio < 0.8) return false;
  
  // Calculate character overlap (simple similarity)
  const overlap = calculateOverlap(norm1, norm2);
  return overlap > 0.85; // 85% similarity threshold
}

/**
 * Calculate character overlap between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Overlap ratio (0-1)
 */
function calculateOverlap(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const shorter = str1.length <= str2.length ? str1 : str2;
  const longer = str1.length > str2.length ? str1 : str2;
  
  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) {
      matches++;
    }
  }
  
  return matches / Math.max(str1.length, str2.length);
}

/**
 * Cache language detection result
 * @param {string} text - Input text
 * @param {object} result - Detection result
 */
export function cacheLanguageDetection(text, result) {
  if (!text || !result) return;
  
  const cacheKey = generateTextCacheKey(text);
  languageDetectionCache.set(cacheKey, {
    result,
    originalText: text,
    timestamp: Date.now()
  });
  
  // Cleanup old entries
  cleanupCache(languageDetectionCache, LANGUAGE_CACHE_EXPIRY);
}

/**
 * Get cached language detection result
 * @param {string} text - Input text
 * @returns {object|null} - Cached result or null
 */
export function getCachedLanguageDetection(text) {
  if (!text) return null;
  
  const cacheKey = generateTextCacheKey(text);
  const cached = languageDetectionCache.get(cacheKey);
  
  if (!cached) return null;
  
  // Check if cache is still valid
  const age = Date.now() - cached.timestamp;
  if (age > LANGUAGE_CACHE_EXPIRY) {
    languageDetectionCache.delete(cacheKey);
    return null;
  }
  
  // Check if text is similar enough to cached text
  if (!areTextsSimilar(text, cached.originalText)) {
    return null;
  }
  
  console.log('🚀 Language detection cache hit for:', text.substring(0, 30) + '...');
  return cached.result;
}

/**
 * Cache suggestions result
 * @param {string} text - Input text
 * @param {string} language - Detected language
 * @param {array} suggestions - Generated suggestions
 */
export function cacheSuggestions(text, language, suggestions) {
  if (!text || !language || !suggestions) return;
  
  const cacheKey = `${generateTextCacheKey(text)}:${language}`;
  suggestionCache.set(cacheKey, {
    suggestions,
    originalText: text,
    language,
    timestamp: Date.now()
  });
  
  // Cleanup old entries
  cleanupCache(suggestionCache, SUGGESTION_CACHE_EXPIRY);
}

/**
 * Get cached suggestions
 * @param {string} text - Input text
 * @param {string} language - Detected language
 * @returns {array|null} - Cached suggestions or null
 */
export function getCachedSuggestions(text, language) {
  if (!text || !language) return null;
  
  const cacheKey = `${generateTextCacheKey(text)}:${language}`;
  const cached = suggestionCache.get(cacheKey);
  
  if (!cached) return null;
  
  // Check if cache is still valid
  const age = Date.now() - cached.timestamp;
  if (age > SUGGESTION_CACHE_EXPIRY) {
    suggestionCache.delete(cacheKey);
    return null;
  }
  
  // Check if text is similar enough to cached text
  if (!areTextsSimilar(text, cached.originalText) || cached.language !== language) {
    return null;
  }
  
  console.log('🚀 Suggestions cache hit for:', text.substring(0, 30) + '...');
  return cached.suggestions;
}

/**
 * Cleanup expired cache entries
 * @param {Map} cache - Cache to clean
 * @param {number} expiry - Expiry time in milliseconds
 */
function cleanupCache(cache, expiry) {
  const now = Date.now();
  const toDelete = [];
  
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > expiry) {
      toDelete.push(key);
    }
  }
  
  toDelete.forEach(key => cache.delete(key));
  
  if (toDelete.length > 0) {
    console.log(`🗑️ Cleaned up ${toDelete.length} expired cache entries`);
  }
}

/**
 * Rate limiting for smart text operations
 */
const rateLimits = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_DETECTIONS_PER_MINUTE = 10;
const MAX_SUGGESTIONS_PER_MINUTE = 3;

/**
 * Check if operation is rate limited
 * @param {string} userId - User ID
 * @param {string} operation - Operation type ('detection' or 'suggestions')
 * @returns {boolean} - Whether operation is allowed
 */
export function isRateLimited(userId, operation) {
  if (!userId) return false;
  
  const key = `${userId}:${operation}`;
  const now = Date.now();
  
  let userLimits = rateLimits.get(key);
  if (!userLimits) {
    userLimits = { count: 0, windowStart: now };
    rateLimits.set(key, userLimits);
  }
  
  // Reset window if expired
  if (now - userLimits.windowStart > RATE_LIMIT_WINDOW) {
    userLimits.count = 0;
    userLimits.windowStart = now;
  }
  
  const maxAllowed = operation === 'detection' ? MAX_DETECTIONS_PER_MINUTE : MAX_SUGGESTIONS_PER_MINUTE;
  
  if (userLimits.count >= maxAllowed) {
    console.warn(`⚠️ Rate limit exceeded for user ${userId}, operation: ${operation}`);
    return true;
  }
  
  userLimits.count++;
  return false;
}

/**
 * Clear all caches (for testing/debugging)
 */
export function clearAllCaches() {
  languageDetectionCache.clear();
  suggestionCache.clear();
  rateLimits.clear();
  console.log('🗑️ All smart text caches cleared');
}

/**
 * Get cache statistics (for debugging)
 * @returns {object} - Cache statistics
 */
export function getCacheStats() {
  return {
    languageDetectionCache: {
      size: languageDetectionCache.size,
      entries: Array.from(languageDetectionCache.keys())
    },
    suggestionCache: {
      size: suggestionCache.size,
      entries: Array.from(suggestionCache.keys())
    },
    rateLimits: {
      size: rateLimits.size,
      entries: Array.from(rateLimits.entries())
    }
  };
}
