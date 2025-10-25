/**
 * Translation Cache Integration Utilities
 * 
 * Provides simple integration points for the enhanced translation cache 
 * to work with existing ChatScreen cleanup patterns.
 */

import { clearTranslationCache, performTranslationCacheCleanup } from './simpleTranslationCache';

/**
 * Clear translation cache for a specific chat (integrates with ChatScreen cleanup)
 * This can be called from ChatScreen's existing cleanup logic
 * @param {string} chatId - Chat ID to clear cache for
 */
export function clearChatTranslationCache(chatId) {
  try {
    console.log('🧹 Clearing translation cache for chat:', chatId);
    clearTranslationCache(chatId);
  } catch (error) {
    console.warn('⚠️ Error clearing translation cache (non-critical):', error);
    // Silent fail - cache clearing is non-critical
  }
}

/**
 * Clear all translation cache (for app-wide cleanup)
 */
export function clearAllTranslationCache() {
  try {
    console.log('🧹 Clearing all translation cache');
    clearTranslationCache();
  } catch (error) {
    console.warn('⚠️ Error clearing all translation cache (non-critical):', error);
  }
}

/**
 * Perform periodic cache cleanup (can be integrated with existing cleanup intervals)
 */
export function performCacheMaintenanceCleanup() {
  try {
    console.log('🧹 Performing translation cache maintenance');
    performTranslationCacheCleanup();
  } catch (error) {
    console.warn('⚠️ Error in cache maintenance (non-critical):', error);
  }
}

export default {
  clearChatTranslationCache,
  clearAllTranslationCache,
  performCacheMaintenanceCleanup
};


