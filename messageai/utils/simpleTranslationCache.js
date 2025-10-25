/**
 * Enhanced Translation Caching - Industry Standard Approach
 * 
 * Uses in-memory cache with proper cleanup integration following existing app patterns.
 * Integrates with existing cleanup mechanisms and follows industry best practices.
 */

// In-memory translation cache with size and time limits
const translationCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes (same as proactive cache)
const MAX_CACHE_SIZE = 1000; // Maximum cached translations
const MAX_TRANSLATION_LENGTH = 2000; // Maximum characters to cache

/**
 * Generate cache key for translation
 * @param {string} messageId - Message ID
 * @param {string} targetLanguage - Target language
 * @returns {string} - Cache key
 */
function generateCacheKey(messageId, targetLanguage) {
  return `${messageId}_${targetLanguage}`;
}

/**
 * Check if cached translation is valid
 * @param {object} cached - Cached translation object
 * @returns {boolean} - Whether cache is valid
 */
function isCacheValid(cached) {
  if (!cached || !cached.timestamp) return false;
  return (Date.now() - cached.timestamp) < CACHE_TTL;
}

/**
 * Clean up expired cache entries (follows existing patterns)
 */
function cleanupExpiredCache() {
  const now = Date.now();
  const toDelete = [];
  
  for (const [key, value] of translationCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      toDelete.push(key);
    }
  }
  
  toDelete.forEach(key => translationCache.delete(key));
  
  if (toDelete.length > 0) {
    console.log(`🗑️ Cleaned up ${toDelete.length} expired translation cache entries`);
  }
}

/**
 * Enforce cache size limits (LRU eviction)
 */
function enforceCacheLimit() {
  if (translationCache.size <= MAX_CACHE_SIZE) return;
  
  // Convert to array and sort by timestamp (oldest first)
  const entries = Array.from(translationCache.entries()).sort(
    (a, b) => a[1].timestamp - b[1].timestamp
  );
  
  // Remove oldest entries
  const toRemove = entries.slice(0, translationCache.size - MAX_CACHE_SIZE);
  toRemove.forEach(([key]) => translationCache.delete(key));
  
  console.log(`📦 Removed ${toRemove.length} old cache entries to enforce size limit`);
}

/**
 * Get cached translation with proper validation
 * @param {string} messageId - Message ID
 * @param {string} targetLanguage - Target language
 * @returns {object|null} - Cached translation or null
 */
export function getCachedTranslation(messageId, targetLanguage) {
  if (!messageId || !targetLanguage) return null;
  
  const key = generateCacheKey(messageId, targetLanguage);
  const cached = translationCache.get(key);
  
  if (cached && isCacheValid(cached)) {
    console.log(`🚀 Cache hit for translation: ${messageId} → ${targetLanguage}`);
    return {
      ...cached.data,
      fromCache: true
    };
  }
  
  return null;
}

/**
 * Cache translation in memory
 * @param {string} messageId - Message ID
 * @param {string} targetLanguage - Target language  
 * @param {object} translationData - Translation data to cache
 */
function cacheTranslation(messageId, targetLanguage, translationData) {
  // Don't cache overly long translations to prevent memory bloat
  if (translationData.translation && translationData.translation.length > MAX_TRANSLATION_LENGTH) {
    console.warn(`⚠️ Translation too long to cache (${translationData.translation.length} chars)`);
    return;
  }
  
  const key = generateCacheKey(messageId, targetLanguage);
  
  translationCache.set(key, {
    data: translationData,
    timestamp: Date.now()
  });
  
  console.log(`💾 Cached translation: ${messageId} → ${targetLanguage}`);
  
  // Enforce size limits
  enforceCacheLimit();
}

/**
 * Enhanced translation loading with memory cache
 * @param {string} messageId - Message ID
 * @param {string} messageText - Message text
 * @param {string} targetLanguage - Target language
 * @param {string} sourceLanguage - Source language
 * @returns {Promise<object>} - Translation result
 */
export async function getTranslationWithCache(messageId, messageText, targetLanguage, sourceLanguage = 'English') {
  try {
    // First check memory cache
    const cached = getCachedTranslation(messageId, targetLanguage);
    if (cached) {
      return cached;
    }

    // Generate new translation
    console.log('🌐 Cache miss, generating new translation');
    
    const { translateText } = await import('./aiService');
    const result = await translateText({
      text: messageText,
      targetLanguage,
      sourceLanguage,
      formality: 'casual',
      culturalContext: {
        chatContext: 'Enhanced inline translation',
        responseLanguage: targetLanguage
      }
    });

    // Cache successful translations
    if (result.success) {
      cacheTranslation(messageId, targetLanguage, result);
    }

    return result;
  } catch (error) {
    console.error('❌ Error in translation with cache:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Clear translation cache (integrates with existing cleanup patterns)
 * @param {string} chatId - Optional chat ID to clear specific chat cache
 */
export function clearTranslationCache(chatId = null) {
  if (chatId) {
    // Clear translations for specific chat
    const toDelete = [];
    for (const key of translationCache.keys()) {
      if (key.includes(chatId)) {
        toDelete.push(key);
      }
    }
    toDelete.forEach(key => translationCache.delete(key));
    console.log(`🗑️ Cleared ${toDelete.length} translation cache entries for chat: ${chatId}`);
  } else {
    // Clear all
    const size = translationCache.size;
    translationCache.clear();
    console.log(`🗑️ Cleared all translation cache (${size} entries)`);
  }
}

/**
 * Periodic cleanup (can be called from existing cleanup systems)
 */
export function performTranslationCacheCleanup() {
  console.log('🧹 Performing translation cache cleanup...');
  cleanupExpiredCache();
  enforceCacheLimit();
}

/**
 * Get cache statistics (for debugging)
 * @returns {object} - Cache statistics
 */
export function getTranslationCacheStats() {
  return {
    size: translationCache.size,
    maxSize: MAX_CACHE_SIZE,
    ttl: CACHE_TTL,
    entries: Array.from(translationCache.keys())
  };
}

export default {
  getCachedTranslation,
  getTranslationWithCache,
  clearTranslationCache,
  performTranslationCacheCleanup,
  getTranslationCacheStats
};
