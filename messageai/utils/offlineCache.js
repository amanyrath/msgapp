import AsyncStorage from '@react-native-async-storage/async-storage';

// Keys for AsyncStorage
const MESSAGE_CACHE_KEY = 'msgapp_offline_messages';
const TRANSLATION_CACHE_KEY = 'msgapp_offline_translations';
const CACHE_METADATA_KEY = 'msgapp_offline_metadata';

// Configuration
const MAX_CACHED_MESSAGES = 10;
const CACHE_EXPIRY_DAYS = 7; // Cache expires after 7 days

/**
 * Offline Cache Manager for Messages and Translations
 * Stores the last 10 messages + their translations for offline access
 */
export class OfflineCache {
  
  /**
   * Cache messages and translations for a specific chat
   * @param {string} chatId - Chat ID
   * @param {Array} messages - Array of messages
   * @param {Object} translations - Translation data map
   */
  static async cacheMessagesWithTranslations(chatId, messages, translations = {}) {
    try {
      if (!chatId || !messages || messages.length === 0) {
        console.log('🚫 Skipping cache - no chatId or messages');
        return;
      }

      // Get the last 10 messages (most recent)
      const messagesToCache = messages
        .filter(msg => msg && msg.id && msg.text) // Only cache text messages with valid data
        .slice(-MAX_CACHED_MESSAGES); // Last 10 messages
      
      console.log(`💾 Caching ${messagesToCache.length} messages for chat: ${chatId}`);

      // Prepare cache data
      const cacheData = {
        chatId,
        messages: messagesToCache.map(msg => ({
          id: msg.id,
          text: msg.text,
          senderId: msg.senderId,
          senderEmail: msg.senderEmail,
          senderName: msg.senderName,
          timestamp: msg.timestamp ? {
            seconds: msg.timestamp.seconds || Math.floor(msg.timestamp.toDate().getTime() / 1000),
            nanoseconds: msg.timestamp.nanoseconds || 0
          } : null,
          type: msg.type || 'text',
          readBy: msg.readBy || [],
          sentWithAI: msg.sentWithAI || false
        })),
        translations: {},
        cachedAt: Date.now(),
        expiresAt: Date.now() + (CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
      };

      // Cache translations for these messages
      const messageIds = messagesToCache.map(msg => msg.id);
      messageIds.forEach(messageId => {
        if (translations[messageId]) {
          cacheData.translations[messageId] = {
            translation: translations[messageId].translation,
            originalText: translations[messageId].originalText,
            culturalNotes: translations[messageId].culturalNotes || [],
            detectedLanguage: translations[messageId].detectedLanguage,
            isShowingOriginal: translations[messageId].isShowingOriginal || false,
            autoTranslated: translations[messageId].autoTranslated || false,
            confidence: translations[messageId].confidence || 0.95
          };
        }
      });

      // Store in AsyncStorage
      const cacheKey = `${MESSAGE_CACHE_KEY}_${chatId}`;
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
      
      // Update metadata
      await this.updateCacheMetadata(chatId, messagesToCache.length, Object.keys(cacheData.translations).length);
      
      console.log(`✅ Cached ${messagesToCache.length} messages and ${Object.keys(cacheData.translations).length} translations for chat: ${chatId}`);
      
    } catch (error) {
      console.error('❌ Failed to cache messages:', error);
    }
  }

  /**
   * Retrieve cached messages and translations for a chat
   * @param {string} chatId - Chat ID
   * @returns {Object} Cached data or null
   */
  static async getCachedMessagesWithTranslations(chatId) {
    try {
      if (!chatId) return null;

      const cacheKey = `${MESSAGE_CACHE_KEY}_${chatId}`;
      const cachedData = await AsyncStorage.getItem(cacheKey);
      
      if (!cachedData) {
        console.log(`📭 No cache found for chat: ${chatId}`);
        return null;
      }

      const parsedData = JSON.parse(cachedData);
      
      // Check if cache has expired
      if (parsedData.expiresAt && Date.now() > parsedData.expiresAt) {
        console.log(`⏰ Cache expired for chat: ${chatId}, clearing...`);
        await this.clearCacheForChat(chatId);
        return null;
      }

      // Reconstruct timestamp objects
      const messages = parsedData.messages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp ? {
          seconds: msg.timestamp.seconds,
          nanoseconds: msg.timestamp.nanoseconds,
          toDate: () => new Date(msg.timestamp.seconds * 1000)
        } : null
      }));

      const result = {
        chatId: parsedData.chatId,
        messages,
        translations: parsedData.translations || {},
        cachedAt: parsedData.cachedAt,
        fromCache: true
      };

      console.log(`📦 Retrieved ${messages.length} cached messages and ${Object.keys(result.translations).length} translations for chat: ${chatId}`);
      return result;
      
    } catch (error) {
      console.error('❌ Failed to retrieve cached messages:', error);
      return null;
    }
  }

  /**
   * Update cache metadata for tracking
   * @param {string} chatId - Chat ID
   * @param {number} messageCount - Number of cached messages
   * @param {number} translationCount - Number of cached translations
   */
  static async updateCacheMetadata(chatId, messageCount, translationCount) {
    try {
      const metadata = await AsyncStorage.getItem(CACHE_METADATA_KEY);
      const metadataObj = metadata ? JSON.parse(metadata) : {};
      
      metadataObj[chatId] = {
        messageCount,
        translationCount,
        lastUpdated: Date.now(),
        version: '1.0'
      };
      
      await AsyncStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadataObj));
    } catch (error) {
      console.error('❌ Failed to update cache metadata:', error);
    }
  }

  /**
   * Get cache metadata for a chat
   * @param {string} chatId - Chat ID
   * @returns {Object} Cache metadata or null
   */
  static async getCacheMetadata(chatId) {
    try {
      const metadata = await AsyncStorage.getItem(CACHE_METADATA_KEY);
      if (!metadata) return null;
      
      const metadataObj = JSON.parse(metadata);
      return metadataObj[chatId] || null;
    } catch (error) {
      console.error('❌ Failed to get cache metadata:', error);
      return null;
    }
  }

  /**
   * Clear cache for a specific chat
   * @param {string} chatId - Chat ID
   */
  static async clearCacheForChat(chatId) {
    try {
      const cacheKey = `${MESSAGE_CACHE_KEY}_${chatId}`;
      await AsyncStorage.removeItem(cacheKey);
      
      // Update metadata
      const metadata = await AsyncStorage.getItem(CACHE_METADATA_KEY);
      if (metadata) {
        const metadataObj = JSON.parse(metadata);
        delete metadataObj[chatId];
        await AsyncStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadataObj));
      }
      
      console.log(`🗑️ Cleared cache for chat: ${chatId}`);
    } catch (error) {
      console.error('❌ Failed to clear cache:', error);
    }
  }

  /**
   * Clear all cached data
   */
  static async clearAllCache() {
    try {
      // Get all keys
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => 
        key.startsWith(MESSAGE_CACHE_KEY) || 
        key.startsWith(TRANSLATION_CACHE_KEY) ||
        key === CACHE_METADATA_KEY
      );
      
      await AsyncStorage.multiRemove(cacheKeys);
      console.log(`🗑️ Cleared all offline cache (${cacheKeys.length} keys)`);
    } catch (error) {
      console.error('❌ Failed to clear all cache:', error);
    }
  }

  /**
   * Get cache statistics for debugging
   * @returns {Object} Cache statistics
   */
  static async getCacheStats() {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const messageKeys = allKeys.filter(key => key.startsWith(MESSAGE_CACHE_KEY));
      
      const stats = {
        totalChats: messageKeys.length,
        totalMessages: 0,
        totalTranslations: 0,
        totalSize: 0,
        chats: []
      };

      for (const key of messageKeys) {
        const chatId = key.replace(`${MESSAGE_CACHE_KEY}_`, '');
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const parsedData = JSON.parse(data);
          const sizeKB = Math.round(data.length / 1024 * 100) / 100;
          
          stats.totalMessages += parsedData.messages?.length || 0;
          stats.totalTranslations += Object.keys(parsedData.translations || {}).length;
          stats.totalSize += sizeKB;
          
          stats.chats.push({
            chatId,
            messages: parsedData.messages?.length || 0,
            translations: Object.keys(parsedData.translations || {}).length,
            sizeKB,
            cachedAt: parsedData.cachedAt,
            expiresAt: parsedData.expiresAt
          });
        }
      }

      stats.totalSize = Math.round(stats.totalSize * 100) / 100;
      return stats;
    } catch (error) {
      console.error('❌ Failed to get cache stats:', error);
      return null;
    }
  }

  /**
   * Check if offline and should use cache
   * @param {boolean} isOffline - Network offline status
   * @returns {boolean} Should use cache
   */
  static shouldUseCache(isOffline) {
    return isOffline;
  }

  /**
   * Merge cached data with fresh data intelligently
   * @param {Array} freshMessages - Fresh messages from Firestore
   * @param {Array} cachedMessages - Cached messages
   * @param {Object} cachedTranslations - Cached translations
   * @returns {Object} Merged data
   */
  static mergeCachedWithFresh(freshMessages, cachedMessages, cachedTranslations = {}) {
    try {
      if (!cachedMessages || cachedMessages.length === 0) {
        return { messages: freshMessages || [], translations: {} };
      }

      if (!freshMessages || freshMessages.length === 0) {
        return { messages: cachedMessages, translations: cachedTranslations };
      }

      // Create a map of fresh messages by ID for efficient lookup
      const freshMessageMap = new Map();
      freshMessages.forEach(msg => {
        if (msg.id) {
          freshMessageMap.set(msg.id, msg);
        }
      });

      // Merge: use fresh messages when available, fall back to cached
      const mergedMessages = [...freshMessages];
      
      // Add any cached messages that aren't in fresh messages (shouldn't happen but safety)
      cachedMessages.forEach(cachedMsg => {
        if (!freshMessageMap.has(cachedMsg.id)) {
          mergedMessages.push(cachedMsg);
        }
      });

      // Sort by timestamp
      mergedMessages.sort((a, b) => {
        const aTime = a.timestamp?.seconds || (a.timestamp?.toDate?.().getTime() / 1000) || 0;
        const bTime = b.timestamp?.seconds || (b.timestamp?.toDate?.().getTime() / 1000) || 0;
        return aTime - bTime;
      });

      console.log(`🔀 Merged ${freshMessages.length} fresh + ${cachedMessages.length} cached = ${mergedMessages.length} total messages`);
      
      return {
        messages: mergedMessages,
        translations: cachedTranslations
      };
      
    } catch (error) {
      console.error('❌ Failed to merge cached with fresh data:', error);
      return { messages: freshMessages || [], translations: {} };
    }
  }
}

export default OfflineCache;

