import {
  collection,
  addDoc,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
  arrayUnion,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Firestore Schema:
 * 
 * /chats/{chatId}
 *   - name: string - Static chat name (e.g., "John & Jane" or "Team Chat")
 *   - icon: string - Chat icon emoji (e.g., "💬" or "🎮")
 *   - notes: string - Private notes about the chat (optional)
 *   - members: [userId1, userId2, ...]
 *   - createdAt: timestamp
 *   - lastMessage: string
 *   - lastMessageTime: timestamp
 *   - lastMessageSenderId: string - User ID of who sent the last message
 *   - type: 'direct' | 'group' - Chat type
 * 
 * /chats/{chatId}/autoTranslationSettings/{userId}
 *   - enabled: boolean - Auto translation enabled for this user in this chat
 *   - targetLanguage: string - Target language for translations (e.g., "English", "Spanish")
 *   - formality: string - Translation formality ("casual" | "formal")
 *   - lastUpdated: timestamp - When settings were last modified
 *   - userId: string - User ID these settings belong to
 *   - chatId: string - Chat ID these settings apply to
 * 
 * /chats/{chatId}/messages/{messageId}
 *   - senderId: string
 *   - senderEmail: string
 *   - text: string (for text messages)
 *   - photo: object (for photo messages)
 *     - url: string - Firebase Storage download URL
 *     - width: number - Image width
 *     - height: number - Image height
 *   - audio: object (for audio messages)
 *     - url: string - Firebase Storage download URL
 *     - duration: number - Duration in seconds
 *     - fileName: string - Original filename
 *     - size: number - File size in bytes
 *   - type: 'text' | 'photo' | 'audio' | 'ai' - Message type
 *   - timestamp: serverTimestamp
 *   - readBy: [userId1, userId2, ...] - array of users who read the message
 *   - senderName: string - Sender's display name/nickname (optional)
 *   - aiMetadata: object (for AI messages)
 *     - operation: 'translation' | 'explanation' | 'suggestion' | 'analysis'
 *     - originalMessageId: string - Reference to original message being translated/explained
 *     - sourceLanguage: string - Original language
 *     - targetLanguage: string - Translation target language
 *     - confidence: number - AI confidence score
 *     - culturalNotes: array - Cultural context notes
 */

/**
 * Retry helper for Firestore operations
 * @param {Function} operation - The async operation to retry
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} delay - Delay between retries in ms
 * @returns {Promise} - Result of the operation
 */
const retryOperation = async (operation, maxRetries = 3, delay = 1000) => {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry on permission errors or invalid arguments
      if (error.code === 'permission-denied' || 
          error.code === 'invalid-argument' ||
          error.code === 'not-found') {
        throw error;
      }
      
      // If it's the last attempt, throw the error
      if (attempt === maxRetries) {
        console.error(`Operation failed after ${maxRetries + 1} attempts:`, error);
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      const waitTime = delay * Math.pow(2, attempt);
      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError;
};

/**
 * Create or get a chat between users
 * @param {Array<string>} memberIds - Array of user IDs
 * @param {Object} metadata - Additional fields to set when creating a chat
 * @returns {Promise<string>} - Chat ID
 */
export const createOrGetChat = async (memberIds, metadata = {}) => {
  try {
    // Sort member IDs for consistent chat lookup
    const sortedMembers = [...memberIds].sort();
    
    // Check if chat already exists
    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('members', '==', sortedMembers));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      // Chat exists, return the ID
      const existingChatId = querySnapshot.docs[0].id;
      if (metadata && Object.keys(metadata).length > 0) {
        const chatRef = doc(db, 'chats', existingChatId);
        await setDoc(chatRef, metadata, { merge: true });
      }
      return querySnapshot.docs[0].id;
    }
    
    // Create new chat
    const chatData = {
      members: sortedMembers,
      createdAt: serverTimestamp(),
      lastMessage: '',
      lastMessageTime: serverTimestamp(),
      ...metadata,
    };
    
    const chatRef = await addDoc(chatsRef, chatData);
    console.log('Created new chat:', chatRef.id);
    return chatRef.id;
  } catch (error) {
    console.error('Error creating/getting chat:', error);
    throw error;
  }
};

/**
 * Send a text message in a chat
 * @param {string} chatId - Chat ID
 * @param {string} senderId - Sender's user ID
 * @param {string} senderEmail - Sender's email
 * @param {string} text - Message text
 * @param {string} senderName - Sender's display name/nickname (optional)
 * @param {object} metadata - Additional metadata (e.g. sentWithAI flag)
 * @returns {Promise<string>} - Message ID
 */
export const sendMessage = async (chatId, senderId, senderEmail, text, senderName = null, metadata = {}) => {
  return retryOperation(async () => {
    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      
      // Filter out undefined values from metadata (Firestore doesn't support undefined)
      const cleanMetadata = {};
      for (const [key, value] of Object.entries(metadata)) {
        if (value !== undefined) {
          cleanMetadata[key] = value;
        }
      }
      
      const messageData = {
        senderId,
        senderEmail,
        text,
        type: 'text',
        timestamp: serverTimestamp(),
        readBy: [senderId], // Sender has "read" their own message
        ...cleanMetadata, // Spread only defined metadata values
      };

      // Add sender name if provided
      if (senderName) {
        messageData.senderName = senderName;
      }
      
      const messageRef = await addDoc(messagesRef, messageData);
      
      // Update chat's last message
      const chatRef = doc(db, 'chats', chatId);
      await setDoc(
        chatRef,
        {
          lastMessage: text,
          lastMessageTime: serverTimestamp(),
          lastMessageSenderId: senderId, // Track who sent the last message
        },
        { merge: true }
      );
      
      console.log('Message sent:', messageRef.id);
      return messageRef.id;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  });
};

/**
 * Send a photo message in a chat
 * @param {string} chatId - Chat ID
 * @param {string} senderId - Sender's user ID
 * @param {string} senderEmail - Sender's email
 * @param {Object} photo - Photo data
 * @param {string} photo.url - Firebase Storage download URL
 * @param {number} photo.width - Image width
 * @param {number} photo.height - Image height
 * @param {string} senderName - Sender's display name/nickname (optional)
 * @returns {Promise<string>} - Message ID
 */
export const sendPhotoMessage = async (chatId, senderId, senderEmail, photo, senderName = null) => {
  return retryOperation(async () => {
    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      
      const messageData = {
        senderId,
        senderEmail,
        photo,
        type: 'photo',
        timestamp: serverTimestamp(),
        readBy: [senderId], // Sender has "read" their own message
      };

      // Add sender name if provided
      if (senderName) {
        messageData.senderName = senderName;
      }
      
      const messageRef = await addDoc(messagesRef, messageData);
      
      // Update chat's last message (show "📷 Photo" as preview)
      const chatRef = doc(db, 'chats', chatId);
      await setDoc(
        chatRef,
        {
          lastMessage: '📷 Photo',
          lastMessageTime: serverTimestamp(),
          lastMessageSenderId: senderId, // Track who sent the last message
        },
        { merge: true }
      );
      
      console.log('Photo message sent:', messageRef.id);
      return messageRef.id;
    } catch (error) {
      console.error('Error sending photo message:', error);
      throw error;
    }
  });
};

/**
 * Send an audio message in a chat
 * @param {string} chatId - Chat ID
 * @param {string} senderId - Sender's user ID
 * @param {string} senderEmail - Sender's email
 * @param {Object} audio - Audio data
 * @param {string} audio.url - Firebase Storage download URL
 * @param {number} audio.duration - Duration in seconds
 * @param {string} audio.fileName - Original filename
 * @param {number} audio.size - File size in bytes
 * @param {string} senderName - Sender's display name/nickname (optional)
 * @returns {Promise<string>} - Message ID
 */
export const sendAudioMessage = async (chatId, senderId, senderEmail, audio, senderName = null) => {
  return retryOperation(async () => {
    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      
      const messageData = {
        senderId,
        senderEmail,
        audio,
        type: 'audio',
        timestamp: serverTimestamp(),
        readBy: [senderId], // Sender has "read" their own message
      };

      // Add sender name if provided
      if (senderName) {
        messageData.senderName = senderName;
      }
      
      const messageRef = await addDoc(messagesRef, messageData);
      
      // Update chat's last message (show "🎵 Voice message" as preview)
      const chatRef = doc(db, 'chats', chatId);
      await setDoc(
        chatRef,
        {
          lastMessage: `🎵 Voice message (${Math.floor(audio.duration)}s)`,
          lastMessageTime: serverTimestamp(),
          lastMessageSenderId: senderId, // Track who sent the last message
        },
        { merge: true }
      );
      
      console.log('Audio message sent:', messageRef.id);
      return messageRef.id;
    } catch (error) {
      console.error('Error sending audio message:', error);
      throw error;
    }
  });
};

/**
 * Subscribe to messages in a chat (real-time) with optional pagination
 * @param {string} chatId - Chat ID
 * @param {Function} callback - Callback function to receive messages
 * @param {number} maxMessages - Maximum number of messages to load (default: all)
 * @returns {Function} - Unsubscribe function
 */
export const subscribeToMessages = (chatId, callback, maxMessages = null) => {
  try {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    
    // Build query with optional limit for performance
    let q;
    if (maxMessages) {
      // For pagination: get most recent N messages, then reverse to display oldest first
      q = query(messagesRef, orderBy('timestamp', 'desc'), limit(maxMessages));
    } else {
      // Load all messages (original behavior)
      q = query(messagesRef, orderBy('timestamp', 'asc'));
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = [];
      snapshot.forEach((doc) => {
        messages.push({
          id: doc.id,
          ...doc.data(),
        });
      });
      
      // If limited, reverse to show oldest first (chronological order)
      if (maxMessages) {
        messages.reverse();
      }
      
      callback(messages);
    });
    
    return unsubscribe;
  } catch (error) {
    console.error('Error subscribing to messages:', error);
    throw error;
  }
};

/**
 * Get all chats for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of chats
 */
export const getUserChats = async (userId) => {
  try {
    const chatsRef = collection(db, 'chats');
    const q = query(
      chatsRef,
      where('members', 'array-contains', userId),
      orderBy('lastMessageTime', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const chats = [];
    
    querySnapshot.forEach((doc) => {
      chats.push({
        id: doc.id,
        ...doc.data(),
      });
    });
    
    return chats;
  } catch (error) {
    console.error('Error getting user chats:', error);
    throw error;
  }
};

/**
 * Subscribe to all chats for a user (real-time)
 * @param {string} userId - User ID
 * @param {Function} callback - Receives updated chat array
 * @returns {Function} - Unsubscribe handler
 */
export const subscribeToUserChats = (userId, callback) => {
  try {
    const chatsRef = collection(db, 'chats');
    const q = query(
      chatsRef,
      where('members', 'array-contains', userId),
      orderBy('lastMessageTime', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chats = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback(chats);
    });

    return unsubscribe;
  } catch (error) {
    console.error('Error subscribing to user chats:', error);
    throw error;
  }
};

/**
 * Create or update a user profile document.
 * @param {string} userId - User ID
 * @param {Object} profile - Profile fields (email, displayName, photoURL, etc.)
 * @param {Object} options - Additional options
 * @param {boolean} [options.setCreatedAt=false] - Whether to set createdAt timestamp
 */
export const createUserProfile = async (userId, profile, options = {}) => {
  try {
    const { setCreatedAt = false } = options;
    const userRef = doc(db, 'users', userId);

    const payload = {
      ...profile,
      updatedAt: serverTimestamp(),
    };

    if (setCreatedAt) {
      payload.createdAt = serverTimestamp();
    }

    await setDoc(userRef, payload, { merge: true });
  } catch (error) {
    console.error('Error creating/updating user profile:', error);
    throw error;
  }
};

/**
 * Get user's language preference from their profile
 * @param {string} userId - User ID
 * @returns {Promise<string>} - User's preferred language (e.g., 'Spanish', 'French', 'English')
 */
export const getUserLanguagePreference = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const userData = userSnap.data();
      return userData.languagePreference || 'English'; // Default to English if not set
    } else {
      console.log('User profile not found, defaulting to English');
      return 'English';
    }
  } catch (error) {
    console.error('Error getting user language preference:', error);
    return 'English'; // Fallback to English on error
  }
};

/**
 * Update user's language preference
 * @param {string} userId - User ID
 * @param {string} languagePreference - New language preference (e.g., 'Spanish', 'French', 'English')
 * @returns {Promise<boolean>} - Success status
 */
export const updateUserLanguagePreference = async (userId, languagePreference) => {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      languagePreference,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    
    console.log(`Updated language preference for user ${userId}: ${languagePreference}`);
    return true;
  } catch (error) {
    console.error('Error updating user language preference:', error);
    return false;
  }
};

/**
 * Get user profile with language preference
 * @param {string} userId - User ID  
 * @returns {Promise<object>} - User profile data including language preference
 */
export const getUserProfileWithLanguage = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const userData = userSnap.data();
      return {
        ...userData,
        languagePreference: userData.languagePreference || 'English'
      };
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error getting user profile with language:', error);
    return null;
  }
};

/**
 * Subscribe to all user profiles.
 * @param {Function} callback - Receives array of user profiles
 * @returns {Function} - Unsubscribe handler
 */
export const subscribeToUsers = (callback) => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('displayName'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback(users);
    });

    return unsubscribe;
  } catch (error) {
    console.error('Error subscribing to users:', error);
    throw error;
  }
};

/**
 * Get chat details
 * @param {string} chatId - Chat ID
 * @returns {Promise<Object>} - Chat data
 */
export const getChat = async (chatId) => {
  try {
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);
    
    if (chatSnap.exists()) {
      return {
        id: chatSnap.id,
        ...chatSnap.data(),
      };
    } else {
      throw new Error('Chat not found');
    }
  } catch (error) {
    console.error('Error getting chat:', error);
    throw error;
  }
};

/**
 * Mark messages as read by a user
 * @param {string} chatId - Chat ID
 * @param {Array<string>} messageIds - Array of message IDs to mark as read
 * @param {string} userId - User ID marking messages as read
 */
export const markMessagesAsRead = async (chatId, messageIds, userId) => {
  if (!messageIds || messageIds.length === 0) return;
  
  try {
    const batch = [];
    
    for (const messageId of messageIds) {
      const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
      
      // Use arrayUnion to add userId to readBy array (avoids duplicates)
      const updatePromise = setDoc(
        messageRef,
        {
          readBy: arrayUnion(userId),
        },
        { merge: true }
      );
      
      batch.push(updatePromise);
    }
    
    await Promise.all(batch);
    console.log(`Marked ${messageIds.length} messages as read`);
  } catch (error) {
    console.error('Error marking messages as read:', error);
    // Don't throw - read receipts are not critical
  }
};

/**
 * Update chat metadata (name, icon, notes) for group chats
 * @param {string} chatId - Chat ID
 * @param {Object} metadata - Metadata to update
 * @param {string} [metadata.name] - Group chat name
 * @param {string} [metadata.icon] - Group chat icon (emoji)
 * @param {string} [metadata.notes] - Private notes about the group
 * @returns {Promise<void>}
 */
export const updateChatMetadata = async (chatId, metadata) => {
  return retryOperation(async () => {
    try {
      const chatRef = doc(db, 'chats', chatId);
      
      // Only update provided fields
      const updateData = {
        updatedAt: serverTimestamp(),
      };
      
      if (metadata.name !== undefined) {
        updateData.name = metadata.name;
      }
      
      if (metadata.icon !== undefined) {
        updateData.icon = metadata.icon;
      }
      
      if (metadata.notes !== undefined) {
        updateData.notes = metadata.notes;
      }
      
      await setDoc(chatRef, updateData, { merge: true });
      console.log('Chat metadata updated:', chatId, updateData);
    } catch (error) {
      console.error('Error updating chat metadata:', error);
      throw error;
    }
  });
};

/**
 * Delete a chat and all its messages
 * @param {string} chatId - The chat ID to delete
 * @param {string} userId - The user requesting the deletion (for permissions)
 * @returns {Promise<boolean>} - True if successful
 */
export const deleteChat = async (chatId, userId) => {
  return retryOperation(async () => {
    try {
      console.log('Deleting chat:', chatId, 'by user:', userId);
      
      // First verify the user is a member of this chat
      const chatRef = doc(db, 'chats', chatId);
      const chatDoc = await getDoc(chatRef);
      
      if (!chatDoc.exists()) {
        throw new Error('Chat not found');
      }
      
      const chatData = chatDoc.data();
      if (!chatData.members || !chatData.members.includes(userId)) {
        throw new Error('You are not a member of this chat');
      }
      
      // Use a batch to delete everything atomically
      const batch = writeBatch(db);
      
      // Delete all messages in the chat
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      const messagesSnapshot = await getDocs(messagesRef);
      
      console.log(`Deleting ${messagesSnapshot.size} messages from chat ${chatId}`);
      
      messagesSnapshot.forEach((messageDoc) => {
        batch.delete(messageDoc.ref);
      });
      
      // Delete the chat document itself
      batch.delete(chatRef);
      
      // Commit the batch
      await batch.commit();
      
      console.log('Chat deleted successfully:', chatId);
      return true;
      
    } catch (error) {
      console.error('Error deleting chat:', error);
      throw error;
    }
  });
};

/**
 * Conversation Insights Storage
 * Stores and retrieves structured data extracted from messages
 */

/**
 * Store conversation insights extracted from a message
 * @param {string} chatId - Chat ID
 * @param {string} messageId - Message ID that generated these insights
 * @param {Array} extractions - Structured data extractions from AI
 * @param {object} metadata - Additional metadata (sender, timestamp, etc.)
 * @returns {Promise<string>} - Insight document ID
 */
export const storeConversationInsights = async (chatId, messageId, extractions, metadata = {}) => {
  return retryOperation(async () => {
    if (!extractions || extractions.length === 0) {
      return null; // No insights to store
    }

    const insightData = {
      chatId,
      messageId,
      extractions,
      createdAt: serverTimestamp(),
      processedAt: new Date().toISOString(),
      ...metadata
    };

    const insightsRef = collection(db, 'chats', chatId, 'insights');
    const docRef = await addDoc(insightsRef, insightData);
    
    console.log('📊 Stored conversation insights:', docRef.id, 'extractions:', extractions.length);
    return docRef.id;
  });
};

/**
 * Get all conversation insights for a chat
 * @param {string} chatId - Chat ID
 * @param {number} limitCount - Maximum number of insights to return (default: 50)
 * @returns {Promise<Array>} - Array of insight objects
 */
export const getChatInsights = async (chatId, limitCount = 50) => {
  return retryOperation(async () => {
    const insightsRef = collection(db, 'chats', chatId, 'insights');
    const q = query(
      insightsRef,
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  });
};

/**
 * Subscribe to real-time conversation insights for a chat
 * @param {string} chatId - Chat ID  
 * @param {function} callback - Callback function called with insights array
 * @param {number} limitCount - Maximum number of insights (default: 50)
 * @returns {function} - Unsubscribe function
 */
export const subscribeToConversationInsights = (chatId, callback, limitCount = 50) => {
  const insightsRef = collection(db, 'chats', chatId, 'insights');
  const q = query(
    insightsRef,
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  return onSnapshot(q, (snapshot) => {
    const insights = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log('📊 Insights updated:', insights.length, 'items');
    callback(insights);
  }, (error) => {
    console.error('❌ Error subscribing to insights:', error);
    callback([]);
  });
};

/**
 * Check if a message has already been processed for insights
 * @param {string} chatId - Chat ID
 * @param {string} messageId - Message ID
 * @returns {Promise<boolean>} - True if already processed
 */
export const isMessageProcessedForInsights = async (chatId, messageId) => {
  return retryOperation(async () => {
    const insightsRef = collection(db, 'chats', chatId, 'insights');
    const q = query(insightsRef, where('messageId', '==', messageId));
    
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  });
};

/**
 * Delete insights for a specific message (when message is deleted)
 * @param {string} chatId - Chat ID
 * @param {string} messageId - Message ID
 * @returns {Promise<void>}
 */
export const deleteMessageInsights = async (chatId, messageId) => {
  return retryOperation(async () => {
    const insightsRef = collection(db, 'chats', chatId, 'insights');
    const q = query(insightsRef, where('messageId', '==', messageId));
    
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    if (!snapshot.empty) {
      await batch.commit();
      console.log('📊 Deleted insights for message:', messageId);
    }
  });
};
