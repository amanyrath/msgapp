/**
 * AI Conversation Storage
 * 
 * CLIENT-SIDE ONLY storage for AI assistant conversation history.
 * Respects privacy guidelines - AI conversations remain on device only.
 * 
 * Features:
 * - Per-chat AI conversation persistence
 * - AsyncStorage for local device storage
 * - Conversation history cleanup to prevent storage bloat
 * - Privacy-first approach (no Firestore sync)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const AI_CONVERSATION_PREFIX = 'msgapp_ai_conversations_';
const AI_CONVERSATION_METADATA_KEY = 'msgapp_ai_conversation_metadata';

// Configuration
const MAX_MESSAGES_PER_CHAT = 50; // Keep last 50 AI messages per chat
const CONVERSATION_EXPIRY_DAYS = 30; // Auto-delete conversations older than 30 days
const MAX_CACHED_CHATS = 20; // Keep conversations for max 20 chats

/**
 * AI Conversation Message Schema:
 * {
 *   id: string,
 *   text: string,
 *   sender: 'user' | 'ai',
 *   timestamp: Date,
 *   isError?: boolean,
 *   metadata?: object (operation type, confidence, etc.)
 * }
 */

/**
 * Load AI conversation history for a specific chat
 * @param {string} chatId - Chat ID
 * @param {string} userId - User ID (for privacy isolation)
 * @returns {Promise<Array>} Array of AI conversation messages
 */
export async function loadAIConversation(chatId, userId) {
  try {
    const key = getConversationKey(chatId, userId);
    const stored = await AsyncStorage.getItem(key);
    
    if (!stored) {
      console.log('📱 No AI conversation history found for chat:', chatId);
      return [];
    }
    
    const conversation = JSON.parse(stored);
    
    // Convert timestamp strings back to Date objects
    const messages = conversation.messages.map(msg => ({
      ...msg,
      timestamp: new Date(msg.timestamp)
    }));
    
    // Check if conversation is expired
    const lastActivity = new Date(conversation.lastActivity);
    const daysSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceActivity > CONVERSATION_EXPIRY_DAYS) {
      console.log('📱 AI conversation expired, cleaning up:', chatId);
      await deleteAIConversation(chatId, userId);
      return [];
    }
    
    console.log('📱 Loaded AI conversation history:', messages.length, 'messages for chat:', chatId);
    return messages;
    
  } catch (error) {
    console.warn('⚠️ Error loading AI conversation:', error);
    return [];
  }
}

/**
 * Save AI conversation history for a specific chat
 * @param {string} chatId - Chat ID
 * @param {string} userId - User ID (for privacy isolation)
 * @param {Array} messages - Array of AI conversation messages
 * @returns {Promise<boolean>} Success status
 */
export async function saveAIConversation(chatId, userId, messages) {
  try {
    if (!messages || messages.length === 0) {
      console.log('📱 No messages to save for chat:', chatId);
      return true;
    }
    
    // Limit number of messages to prevent storage bloat
    const limitedMessages = messages.slice(-MAX_MESSAGES_PER_CHAT);
    
    const conversationData = {
      chatId,
      userId,
      messages: limitedMessages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp.toISOString() // Convert Date to string for storage
      })),
      lastActivity: new Date().toISOString(),
      messageCount: limitedMessages.length,
      createdAt: messages[0]?.timestamp?.toISOString() || new Date().toISOString()
    };
    
    const key = getConversationKey(chatId, userId);
    await AsyncStorage.setItem(key, JSON.stringify(conversationData));
    
    // Update metadata for cleanup management
    await updateConversationMetadata(chatId, userId);
    
    console.log('📱 Saved AI conversation:', limitedMessages.length, 'messages for chat:', chatId);
    return true;
    
  } catch (error) {
    console.error('❌ Error saving AI conversation:', error);
    return false;
  }
}

/**
 * Add a single message to an existing AI conversation
 * @param {string} chatId - Chat ID
 * @param {string} userId - User ID
 * @param {object} message - AI message to add
 * @returns {Promise<boolean>} Success status
 */
export async function addMessageToAIConversation(chatId, userId, message) {
  try {
    // Load existing conversation
    const existingMessages = await loadAIConversation(chatId, userId);
    
    // Add new message
    const updatedMessages = [...existingMessages, message];
    
    // Save updated conversation
    return await saveAIConversation(chatId, userId, updatedMessages);
    
  } catch (error) {
    console.error('❌ Error adding message to AI conversation:', error);
    return false;
  }
}

/**
 * Delete AI conversation history for a specific chat
 * @param {string} chatId - Chat ID
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Success status
 */
export async function deleteAIConversation(chatId, userId) {
  try {
    const key = getConversationKey(chatId, userId);
    await AsyncStorage.removeItem(key);
    
    // Remove from metadata
    await removeConversationMetadata(chatId, userId);
    
    console.log('📱 Deleted AI conversation for chat:', chatId);
    return true;
    
  } catch (error) {
    console.error('❌ Error deleting AI conversation:', error);
    return false;
  }
}

/**
 * Clear all AI conversation history for a user (privacy cleanup)
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Success status
 */
export async function clearAllAIConversations(userId) {
  try {
    const metadata = await getConversationMetadata();
    const userConversations = metadata.conversations?.filter(conv => conv.userId === userId) || [];
    
    // Delete all conversations for this user
    for (const conv of userConversations) {
      await deleteAIConversation(conv.chatId, userId);
    }
    
    console.log('📱 Cleared all AI conversations for user:', userId, '(', userConversations.length, 'chats)');
    return true;
    
  } catch (error) {
    console.error('❌ Error clearing all AI conversations:', error);
    return false;
  }
}

/**
 * Get conversation statistics
 * @param {string} userId - User ID
 * @returns {Promise<object>} Statistics object
 */
export async function getAIConversationStats(userId) {
  try {
    const metadata = await getConversationMetadata();
    const userConversations = metadata.conversations?.filter(conv => conv.userId === userId) || [];
    
    let totalMessages = 0;
    let totalChats = userConversations.length;
    let oldestConversation = null;
    let newestConversation = null;
    
    for (const conv of userConversations) {
      totalMessages += conv.messageCount || 0;
      
      const lastActivity = new Date(conv.lastActivity);
      if (!oldestConversation || lastActivity < new Date(oldestConversation)) {
        oldestConversation = conv.lastActivity;
      }
      if (!newestConversation || lastActivity > new Date(newestConversation)) {
        newestConversation = conv.lastActivity;
      }
    }
    
    return {
      totalChats,
      totalMessages,
      oldestConversation,
      newestConversation,
      storageEstimate: `~${Math.round((totalMessages * 150) / 1024)}KB` // Rough estimate
    };
    
  } catch (error) {
    console.error('❌ Error getting AI conversation stats:', error);
    return {
      totalChats: 0,
      totalMessages: 0,
      oldestConversation: null,
      newestConversation: null,
      storageEstimate: '0KB'
    };
  }
}

/**
 * Cleanup old conversations to prevent storage bloat
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of conversations cleaned up
 */
export async function cleanupOldAIConversations(userId) {
  try {
    const metadata = await getConversationMetadata();
    const userConversations = metadata.conversations?.filter(conv => conv.userId === userId) || [];
    
    let cleanedCount = 0;
    const now = Date.now();
    
    for (const conv of userConversations) {
      const daysSinceActivity = (now - new Date(conv.lastActivity).getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceActivity > CONVERSATION_EXPIRY_DAYS) {
        await deleteAIConversation(conv.chatId, userId);
        cleanedCount++;
      }
    }
    
    // Also enforce max chat limit
    if (userConversations.length > MAX_CACHED_CHATS) {
      // Sort by last activity and remove oldest
      const sortedConversations = userConversations
        .sort((a, b) => new Date(a.lastActivity) - new Date(b.lastActivity));
      
      const conversationsToDelete = sortedConversations.slice(0, userConversations.length - MAX_CACHED_CHATS);
      
      for (const conv of conversationsToDelete) {
        await deleteAIConversation(conv.chatId, userId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log('📱 Cleaned up', cleanedCount, 'old AI conversations for user:', userId);
    }
    
    return cleanedCount;
    
  } catch (error) {
    console.error('❌ Error cleaning up old AI conversations:', error);
    return 0;
  }
}

// Private helper functions

/**
 * Generate storage key for a conversation
 * @private
 */
function getConversationKey(chatId, userId) {
  return `${AI_CONVERSATION_PREFIX}${chatId}_${userId}`;
}

/**
 * Update conversation metadata for cleanup management
 * @private
 */
async function updateConversationMetadata(chatId, userId) {
  try {
    const metadata = await getConversationMetadata();
    
    // Remove existing entry for this chat/user
    const filteredConversations = (metadata.conversations || [])
      .filter(conv => !(conv.chatId === chatId && conv.userId === userId));
    
    // Add updated entry
    filteredConversations.push({
      chatId,
      userId,
      lastActivity: new Date().toISOString(),
      messageCount: 0 // This will be updated when we have the actual count
    });
    
    const updatedMetadata = {
      ...metadata,
      conversations: filteredConversations,
      lastUpdated: new Date().toISOString()
    };
    
    await AsyncStorage.setItem(AI_CONVERSATION_METADATA_KEY, JSON.stringify(updatedMetadata));
    
  } catch (error) {
    console.warn('⚠️ Error updating conversation metadata:', error);
  }
}

/**
 * Remove conversation from metadata
 * @private
 */
async function removeConversationMetadata(chatId, userId) {
  try {
    const metadata = await getConversationMetadata();
    
    const filteredConversations = (metadata.conversations || [])
      .filter(conv => !(conv.chatId === chatId && conv.userId === userId));
    
    const updatedMetadata = {
      ...metadata,
      conversations: filteredConversations,
      lastUpdated: new Date().toISOString()
    };
    
    await AsyncStorage.setItem(AI_CONVERSATION_METADATA_KEY, JSON.stringify(updatedMetadata));
    
  } catch (error) {
    console.warn('⚠️ Error removing conversation metadata:', error);
  }
}

/**
 * Get conversation metadata
 * @private
 */
async function getConversationMetadata() {
  try {
    const stored = await AsyncStorage.getItem(AI_CONVERSATION_METADATA_KEY);
    return stored ? JSON.parse(stored) : { conversations: [] };
  } catch (error) {
    console.warn('⚠️ Error getting conversation metadata:', error);
    return { conversations: [] };
  }
}
