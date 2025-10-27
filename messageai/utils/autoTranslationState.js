/**
 * Auto Translation State Management
 * 
 * This module manages per-chat auto translation settings with both local caching
 * and Firestore persistence for cross-device synchronization and improved performance.
 * 
 * Features:
 * - Per-user per-chat auto translation preferences
 * - Local AsyncStorage caching for performance
 * - Firestore persistence for cross-device sync
 * - Translation result caching to reduce API calls
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { db } from '../config/firebase';

// Storage keys
const AUTO_TRANSLATE_STORAGE_KEY = 'msgapp_autoTranslateSettings';
const TRANSLATION_CACHE_KEY = 'msgapp_translationCache';

/**
 * Auto Translation Settings Schema:
 * {
 *   enabled: boolean,
 *   targetLanguage: string,
 *   formality: 'casual' | 'formal',
 *   lastUpdated: timestamp
 * }
 */

/**
 * Translation Cache Schema:
 * {
 *   [messageText]: {
 *     translation: string,
 *     targetLanguage: string,
 *     sourceLanguage: string,
 *     culturalNotes: array,
 *     confidence: number,
 *     timestamp: number,
 *     expiresAt: number
 *   }
 * }
 */

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const MAX_CACHE_SIZE = 500; // Maximum number of cached translations

/**
 * Get auto translation settings for a specific chat and user
 * @param {string} chatId - Chat ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Auto translation settings
 */
export const getAutoTranslationSettings = async (chatId, userId) => {
  try {
    // First try local cache for performance
    const localSettings = await getLocalAutoTranslationSettings(chatId, userId);
    if (localSettings && isSettingsValid(localSettings)) {
      console.log('📱 Using cached auto translation settings:', localSettings);
      return localSettings;
    }

    // Fallback to Firestore for cross-device sync
    const firestoreSettings = await getFirestoreAutoTranslationSettings(chatId, userId);
    
    // Cache the Firestore result locally
    if (firestoreSettings) {
      await setLocalAutoTranslationSettings(chatId, userId, firestoreSettings);
    }

    return firestoreSettings || getDefaultAutoTranslationSettings();
  } catch (error) {
    console.error('❌ Error getting auto translation settings:', error);
    return getDefaultAutoTranslationSettings();
  }
};

/**
 * Save auto translation settings for a specific chat and user
 * @param {string} chatId - Chat ID
 * @param {string} userId - User ID
 * @param {Object} settings - Auto translation settings
 * @returns {Promise<void>}
 */
export const saveAutoTranslationSettings = async (chatId, userId, settings) => {
  try {
    const settingsWithTimestamp = {
      ...settings,
      lastUpdated: Date.now()
    };

    // Save to both local cache and Firestore simultaneously
    await Promise.all([
      setLocalAutoTranslationSettings(chatId, userId, settingsWithTimestamp),
      setFirestoreAutoTranslationSettings(chatId, userId, settingsWithTimestamp)
    ]);

    console.log('💾 Auto translation settings saved:', settingsWithTimestamp);
  } catch (error) {
    console.error('❌ Error saving auto translation settings:', error);
    throw error;
  }
};

/**
 * Get local auto translation settings from AsyncStorage
 * @private
 */
const getLocalAutoTranslationSettings = async (chatId, userId) => {
  try {
    const key = `${AUTO_TRANSLATE_STORAGE_KEY}_${chatId}_${userId}`;
    const cachedSettings = await AsyncStorage.getItem(key);
    return cachedSettings ? JSON.parse(cachedSettings) : null;
  } catch (error) {
    console.warn('⚠️ Error reading local auto translation settings:', error);
    return null;
  }
};

/**
 * Save local auto translation settings to AsyncStorage
 * @private
 */
const setLocalAutoTranslationSettings = async (chatId, userId, settings) => {
  try {
    const key = `${AUTO_TRANSLATE_STORAGE_KEY}_${chatId}_${userId}`;
    await AsyncStorage.setItem(key, JSON.stringify(settings));
  } catch (error) {
    console.warn('⚠️ Error saving local auto translation settings:', error);
  }
};

/**
 * Get auto translation settings from Firestore
 * @private
 */
const getFirestoreAutoTranslationSettings = async (chatId, userId) => {
  try {
    const settingsRef = doc(db, 'chats', chatId, 'autoTranslationSettings', userId);
    const settingsDoc = await getDoc(settingsRef);
    
    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      return {
        enabled: data.enabled || false,
        targetLanguage: data.targetLanguage || 'English',
        formality: data.formality || 'casual',
        lastUpdated: data.lastUpdated?.toMillis() || Date.now()
      };
    }
    
    return null;
  } catch (error) {
    console.warn('⚠️ Error reading Firestore auto translation settings:', error);
    return null;
  }
};

/**
 * Save auto translation settings to Firestore
 * @private
 */
const setFirestoreAutoTranslationSettings = async (chatId, userId, settings) => {
  try {
    const settingsRef = doc(db, 'chats', chatId, 'autoTranslationSettings', userId);
    
    await setDoc(settingsRef, {
      enabled: settings.enabled,
      targetLanguage: settings.targetLanguage,
      formality: settings.formality,
      lastUpdated: serverTimestamp(),
      userId: userId,
      chatId: chatId
    }, { merge: true });
  } catch (error) {
    console.warn('⚠️ Error saving Firestore auto translation settings:', error);
    throw error;
  }
};

/**
 * Check if cached settings are still valid (not expired)
 * @private
 */
const isSettingsValid = (settings) => {
  if (!settings || !settings.lastUpdated) return false;
  
  const age = Date.now() - settings.lastUpdated;
  const maxAge = 60 * 60 * 1000; // 1 hour
  
  return age < maxAge;
};

/**
 * Get default auto translation settings
 * @private
 */
const getDefaultAutoTranslationSettings = () => ({
  enabled: false,
  targetLanguage: 'English',
  formality: 'casual',
  lastUpdated: Date.now()
});

/**
 * Enhanced Translation Caching System
 * Caches translation results to reduce API calls and improve performance
 */

/**
 * Get cached translation for a message
 * @param {string} messageText - Original message text
 * @param {string} targetLanguage - Target language
 * @param {string} sourceLanguage - Source language (optional)
 * @returns {Promise<Object|null>} Cached translation or null
 */
export const getCachedTranslation = async (messageText, targetLanguage, sourceLanguage = '') => {
  try {
    const cacheKey = generateCacheKey(messageText, targetLanguage, sourceLanguage);
    const cachedData = await AsyncStorage.getItem(`${TRANSLATION_CACHE_KEY}_${cacheKey}`);
    
    if (!cachedData) return null;
    
    const translation = JSON.parse(cachedData);
    
    // Check if cache is expired
    if (Date.now() > translation.expiresAt) {
      await AsyncStorage.removeItem(`${TRANSLATION_CACHE_KEY}_${cacheKey}`);
      return null;
    }
    
    console.log('🚀 Using cached translation for:', messageText.substring(0, 50));
    return translation;
  } catch (error) {
    console.warn('⚠️ Error reading translation cache:', error);
    return null;
  }
};

/**
 * Cache a translation result
 * @param {string} messageText - Original message text
 * @param {Object} translationResult - Translation result from AI service
 * @returns {Promise<void>}
 */
export const cacheTranslation = async (messageText, translationResult) => {
  try {
    const cacheKey = generateCacheKey(
      messageText, 
      translationResult.targetLanguage, 
      translationResult.sourceLanguage
    );
    
    const cacheData = {
      ...translationResult,
      timestamp: Date.now(),
      expiresAt: Date.now() + CACHE_DURATION
    };
    
    await AsyncStorage.setItem(`${TRANSLATION_CACHE_KEY}_${cacheKey}`, JSON.stringify(cacheData));
    
    // Clean up old cache entries periodically
    await cleanupTranslationCache();
    
    console.log('💾 Cached translation for:', messageText.substring(0, 50));
  } catch (error) {
    console.warn('⚠️ Error caching translation:', error);
  }
};

/**
 * Generate cache key for translation
 * @private
 */
const generateCacheKey = (messageText, targetLanguage, sourceLanguage = '') => {
  const text = messageText.toLowerCase().trim();
  const hash = simpleHash(text + targetLanguage + sourceLanguage);
  return hash.toString();
};

/**
 * Simple hash function for cache keys
 * @private
 */
const simpleHash = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
};

/**
 * Clean up old translation cache entries
 * @private
 */
const cleanupTranslationCache = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => key.startsWith(TRANSLATION_CACHE_KEY));
    
    if (cacheKeys.length <= MAX_CACHE_SIZE) return;
    
    // Get cache entries with timestamps
    const cacheEntries = [];
    for (const key of cacheKeys) {
      try {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          cacheEntries.push({ key, timestamp: parsed.timestamp || 0 });
        }
      } catch (error) {
        // Remove corrupted cache entries
        await AsyncStorage.removeItem(key);
      }
    }
    
    // Sort by timestamp (oldest first)
    cacheEntries.sort((a, b) => a.timestamp - b.timestamp);
    
    // Remove oldest entries if cache is too large
    const entriesToRemove = cacheEntries.slice(0, cacheEntries.length - MAX_CACHE_SIZE + 50);
    for (const entry of entriesToRemove) {
      await AsyncStorage.removeItem(entry.key);
    }
    
    console.log(`🧹 Cleaned up ${entriesToRemove.length} old translation cache entries`);
  } catch (error) {
    console.warn('⚠️ Error cleaning up translation cache:', error);
  }
};

/**
 * Clear all cached translations (for testing or reset)
 * @returns {Promise<void>}
 */
export const clearTranslationCache = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => 
      key.startsWith(TRANSLATION_CACHE_KEY) || 
      key.startsWith(AUTO_TRANSLATE_STORAGE_KEY)
    );
    
    await AsyncStorage.multiRemove(cacheKeys);
    console.log('🧹 Cleared all translation cache and settings');
  } catch (error) {
    console.error('❌ Error clearing translation cache:', error);
  }
};

/**
 * Get cache statistics for debugging
 * @returns {Promise<Object>} Cache statistics
 */
export const getTranslationCacheStats = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => key.startsWith(TRANSLATION_CACHE_KEY));
    
    let validEntries = 0;
    let expiredEntries = 0;
    let totalSize = 0;
    
    for (const key of cacheKeys) {
      try {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          totalSize += data.length;
          const parsed = JSON.parse(data);
          if (Date.now() > parsed.expiresAt) {
            expiredEntries++;
          } else {
            validEntries++;
          }
        }
      } catch (error) {
        expiredEntries++;
      }
    }
    
    return {
      totalEntries: cacheKeys.length,
      validEntries,
      expiredEntries,
      totalSizeKB: Math.round(totalSize / 1024),
      maxSize: MAX_CACHE_SIZE
    };
  } catch (error) {
    console.error('❌ Error getting cache stats:', error);
    return { error: error.message };
  }
};
