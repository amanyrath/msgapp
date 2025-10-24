import { translateText } from './aiService';
import { shouldShowTranslationForChat } from './chatLanguageAnalysis';
import { getCachedUserLanguagePreference } from './languageIntegration';

// Cache for pre-generated translations
const proactiveTranslationCache = new Map();
const CACHE_EXPIRY_TIME = 30 * 60 * 1000; // 30 minutes

/**
 * Proactively generate translations for messages when user enters chat
 * Analyzes last 15 messages and pre-generates translations for foreign language content
 * @param {string} chatId - Chat ID
 * @param {Array} messages - Chat messages (should be last 15)
 * @param {string} userId - Current user ID
 * @param {object} options - Options for translation generation
 * @returns {Promise<object>} - Pre-generated translations result
 */
export async function generateProactiveTranslations(chatId, messages, userId, options = {}) {
  try {
    const {
      maxMessages = 15,
      forceRefresh = false
    } = options;

    console.log('🔄 Starting proactive translation generation for chat:', chatId);

    // Get user's language preference
    const userLanguage = await getCachedUserLanguagePreference(userId);
    if (!userLanguage) {
      console.log('❌ No user language preference found, skipping proactive translation');
      return { success: false, reason: 'No user language preference' };
    }

    // Check if this chat needs translations at all
    const translationRecommendation = await shouldShowTranslationForChat(
      chatId,
      messages,
      userId,
      { forceRefresh }
    );

    if (!translationRecommendation.shouldShow) {
      console.log('🚫 Chat does not need translations:', translationRecommendation.reason);
      return { 
        success: true, 
        translationsGenerated: 0, 
        reason: 'No translations needed',
        userLanguage,
        chatLanguage: translationRecommendation.chatLanguage
      };
    }

    // Filter messages that need translation (from others, not AI, with text content)
    const messagesToTranslate = messages
      .filter(msg => 
        msg.senderId !== userId &&           // Not from current user
        msg.type !== 'ai' &&               // Not AI messages
        msg.text &&                         // Has text content
        msg.text.trim().length > 10 &&     // Meaningful length
        !msg.sending                        // Not currently sending
      )
      .slice(-maxMessages); // Take last N messages

    if (messagesToTranslate.length === 0) {
      console.log('📝 No messages found that need translation');
      return { 
        success: true, 
        translationsGenerated: 0, 
        reason: 'No translatable messages',
        userLanguage,
        chatLanguage: translationRecommendation.chatLanguage
      };
    }

    console.log(`🎯 Found ${messagesToTranslate.length} messages that may need translation`);

    // Check cache for existing translations
    const cacheKey = generateCacheKey(chatId, userLanguage);
    const cached = proactiveTranslationCache.get(cacheKey);

    let preGeneratedTranslations = {};
    
    if (cached && !forceRefresh) {
      const cacheAge = Date.now() - cached.timestamp;
      if (cacheAge < CACHE_EXPIRY_TIME) {
        preGeneratedTranslations = cached.translations;
        console.log('🚀 Using cached proactive translations:', Object.keys(preGeneratedTranslations).length);
      }
    }

    // Identify messages that need new translations
    const messagesToProcess = messagesToTranslate.filter(msg => 
      !preGeneratedTranslations[msg.id] || 
      forceRefresh
    );

    if (messagesToProcess.length === 0) {
      console.log('✅ All translations already cached');
      return {
        success: true,
        translationsGenerated: Object.keys(preGeneratedTranslations).length,
        preGeneratedTranslations,
        userLanguage,
        chatLanguage: translationRecommendation.chatLanguage,
        fromCache: true
      };
    }

    console.log(`🤖 Generating translations for ${messagesToProcess.length} messages`);

    // Batch process translations (limit concurrency to prevent rate limiting)
    const batchSize = 3; // Process 3 at a time to avoid overwhelming the API
    const translationResults = {};
    
    for (let i = 0; i < messagesToProcess.length; i += batchSize) {
      const batch = messagesToProcess.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (message) => {
        try {
          const result = await translateText({
            text: message.text,
            targetLanguage: userLanguage,
            sourceLanguage: translationRecommendation.chatLanguage,
            formality: 'casual',
            culturalContext: {
              chatContext: 'Proactive chat translation',
              messageId: message.id,
              proactive: true,
              responseLanguage: userLanguage, // Ensure AI responds in user's language
              userInterfaceLanguage: userLanguage // Cultural context in user's language
            }
          });

          if (result.success) {
            return {
              messageId: message.id,
              translation: result,
              success: true
            };
          } else {
            console.warn('Translation failed for message:', message.id, result.error);
            return {
              messageId: message.id,
              success: false,
              error: result.error
            };
          }
        } catch (error) {
          console.error('Translation error for message:', message.id, error);
          return {
            messageId: message.id,
            success: false,
            error: error.message
          };
        }
      });

      // Wait for current batch to complete
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Process batch results
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success) {
          translationResults[result.value.messageId] = result.value.translation;
        } else {
          console.warn('Failed to generate translation for batch item:', index, result.reason || result.value?.error);
        }
      });

      // Add small delay between batches to be nice to the API
      if (i + batchSize < messagesToProcess.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Merge with existing cached translations
    const allTranslations = {
      ...preGeneratedTranslations,
      ...translationResults
    };

    // Cache the complete set of translations
    proactiveTranslationCache.set(cacheKey, {
      translations: allTranslations,
      timestamp: Date.now(),
      chatId,
      userLanguage
    });

    const totalGenerated = Object.keys(translationResults).length;
    const totalCached = Object.keys(allTranslations).length;

    console.log(`✅ Proactive translation complete: ${totalGenerated} new, ${totalCached} total available`);

    return {
      success: true,
      translationsGenerated: totalGenerated,
      preGeneratedTranslations: allTranslations,
      userLanguage,
      chatLanguage: translationRecommendation.chatLanguage,
      fromCache: false,
      cacheStats: {
        newTranslations: totalGenerated,
        totalAvailable: totalCached,
        cacheHits: totalCached - totalGenerated
      }
    };

  } catch (error) {
    console.error('Error in proactive translation generation:', error);
    return {
      success: false,
      error: error.message,
      translationsGenerated: 0
    };
  }
}

/**
 * Get pre-generated translation for a specific message
 * @param {string} chatId - Chat ID
 * @param {string} messageId - Message ID
 * @param {string} userLanguage - User's preferred language
 * @returns {object|null} - Pre-generated translation or null
 */
export function getPreGeneratedTranslation(chatId, messageId, userLanguage) {
  const cacheKey = generateCacheKey(chatId, userLanguage);
  const cached = proactiveTranslationCache.get(cacheKey);

  if (!cached) return null;

  // Check if cache is still valid
  const cacheAge = Date.now() - cached.timestamp;
  if (cacheAge > CACHE_EXPIRY_TIME) {
    proactiveTranslationCache.delete(cacheKey);
    return null;
  }

  const translation = cached.translations[messageId];
  if (translation) {
    console.log('🚀 Retrieved pre-generated translation for message:', messageId);
  }

  return translation || null;
}

/**
 * Check if a message has a pre-generated translation
 * @param {string} chatId - Chat ID
 * @param {string} messageId - Message ID
 * @param {string} userLanguage - User's preferred language
 * @returns {boolean} - Whether pre-generated translation exists
 */
export function hasPreGeneratedTranslation(chatId, messageId, userLanguage) {
  return getPreGeneratedTranslation(chatId, messageId, userLanguage) !== null;
}

/**
 * Generate cache key for translations
 * @param {string} chatId - Chat ID
 * @param {string} userLanguage - User language
 * @returns {string} - Cache key
 */
function generateCacheKey(chatId, userLanguage) {
  return `proactive_${chatId}_${userLanguage}`;
}

/**
 * Clear proactive translation cache for a specific chat
 * @param {string} chatId - Chat ID
 */
export function clearProactiveTranslationCache(chatId = null) {
  if (chatId) {
    // Clear all entries for this chat
    const keysToDelete = [];
    for (const key of proactiveTranslationCache.keys()) {
      if (key.includes(`proactive_${chatId}_`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => proactiveTranslationCache.delete(key));
    console.log(`🗑️ Cleared proactive translation cache for chat: ${chatId}`);
  } else {
    // Clear all
    proactiveTranslationCache.clear();
    console.log('🗑️ Cleared all proactive translation cache');
  }
}

/**
 * Get cache statistics (for debugging)
 * @returns {object} - Cache statistics
 */
export function getProactiveTranslationStats() {
  const stats = {
    totalCacheEntries: proactiveTranslationCache.size,
    entries: []
  };

  for (const [key, value] of proactiveTranslationCache.entries()) {
    stats.entries.push({
      key,
      translationCount: Object.keys(value.translations).length,
      age: Date.now() - value.timestamp,
      chatId: value.chatId,
      userLanguage: value.userLanguage
    });
  }

  return stats;
}

/**
 * Estimate cost for proactive translation generation
 * @param {Array} messages - Messages to analyze
 * @param {string} userId - Current user ID
 * @returns {object} - Cost estimation
 */
export function estimateProactiveTranslationCost(messages, userId) {
  const messagesToTranslate = messages
    .filter(msg => 
      msg.senderId !== userId &&
      msg.type !== 'ai' &&
      msg.text &&
      msg.text.trim().length > 10
    )
    .slice(-15); // Last 15 messages

  const averageCostPerTranslation = 0.0001; // $0.0001 per translation
  const estimatedCost = messagesToTranslate.length * averageCostPerTranslation;

  return {
    messagesToTranslate: messagesToTranslate.length,
    estimatedCost,
    formattedCost: `$${estimatedCost.toFixed(4)}`
  };
}
