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
  serverTimestamp,
  onSnapshot,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Firestore Schema:
 * 
 * /chats/{chatId}
 *   - name: string - Static chat name (e.g., "John & Jane" or "Team Chat")
 *   - members: [userId1, userId2, ...]
 *   - createdAt: timestamp
 *   - lastMessage: string
 *   - lastMessageTime: timestamp
 *   - type: 'direct' | 'group' - Chat type
 * 
 * /chats/{chatId}/messages/{messageId}
 *   - senderId: string
 *   - senderEmail: string
 *   - text: string
 *   - timestamp: serverTimestamp
 *   - readBy: [userId1, userId2, ...] - array of users who read the message
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
 * Send a message in a chat
 * @param {string} chatId - Chat ID
 * @param {string} senderId - Sender's user ID
 * @param {string} senderEmail - Sender's email
 * @param {string} text - Message text
 * @param {string} senderName - Sender's display name/nickname (optional)
 * @returns {Promise<string>} - Message ID
 */
export const sendMessage = async (chatId, senderId, senderEmail, text, senderName = null) => {
  return retryOperation(async () => {
    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      
      const messageData = {
        senderId,
        senderEmail,
        text,
        timestamp: serverTimestamp(),
        readBy: [senderId], // Sender has "read" their own message
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
 * Subscribe to messages in a chat (real-time)
 * @param {string} chatId - Chat ID
 * @param {Function} callback - Callback function to receive messages
 * @returns {Function} - Unsubscribe function
 */
export const subscribeToMessages = (chatId, callback) => {
  try {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = [];
      snapshot.forEach((doc) => {
        messages.push({
          id: doc.id,
          ...doc.data(),
        });
      });
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
