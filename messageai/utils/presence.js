import { ref, set, onValue, onDisconnect, serverTimestamp } from 'firebase/database';
import { rtdb } from '../config/firebase';

/**
 * Set user as online and configure automatic offline detection
 * @param {string} userId - User ID
 * @param {Object} userData - Additional user data (email, displayName)
 */
export const setUserOnline = async (userId, userData = {}) => {
  if (!rtdb) {
    console.error('RTDB not initialized');
    return;
  }
  
  try {
    const userStatusRef = ref(rtdb, `status/${userId}`);
    
    // Create presence object
    const onlineStatus = {
      state: 'online',
      lastChanged: serverTimestamp(),
      ...userData,
    };
    
    const offlineStatus = {
      state: 'offline',
      lastChanged: serverTimestamp(),
      ...userData,
    };
    
    // Set user as online
    await set(userStatusRef, onlineStatus);
    
    // Configure automatic offline on disconnect
    onDisconnect(userStatusRef).set(offlineStatus);
    
    console.log('✅ User presence set to online:', userId);
  } catch (error) {
    console.error('Error setting user online:', error);
  }
};

/**
 * Manually set user as offline (e.g., on logout)
 * @param {string} userId - User ID
 */
export const setUserOffline = async (userId) => {
  if (!rtdb) {
    console.error('RTDB not initialized');
    return;
  }
  
  try {
    const userStatusRef = ref(rtdb, `status/${userId}`);
    
    await set(userStatusRef, {
      state: 'offline',
      lastChanged: serverTimestamp(),
    });
    
    // Cancel the onDisconnect
    onDisconnect(userStatusRef).cancel();
    
    console.log('✅ User presence set to offline:', userId);
  } catch (error) {
    console.error('Error setting user offline:', error);
  }
};

/**
 * Subscribe to a user's presence status
 * @param {string} userId - User ID to monitor
 * @param {Function} callback - Callback with presence data
 * @returns {Function} - Unsubscribe function
 */
export const subscribeToUserPresence = (userId, callback) => {
  if (!rtdb) {
    console.error('RTDB not initialized');
    return () => {};
  }
  
  try {
    const userStatusRef = ref(rtdb, `status/${userId}`);
    
    const unsubscribe = onValue(userStatusRef, (snapshot) => {
      const data = snapshot.val();
      callback(data);
    }, (error) => {
      console.error('Error in presence listener:', error);
    });
    
    return unsubscribe;
  } catch (error) {
    console.error('Error subscribing to presence:', error);
    return () => {};
  }
};

/**
 * Subscribe to multiple users' presence
 * @param {Array<string>} userIds - Array of user IDs
 * @param {Function} callback - Callback with { userId: presenceData }
 * @returns {Function} - Unsubscribe function
 */
export const subscribeToMultiplePresence = (userIds, callback) => {
  if (!rtdb) {
    console.error('RTDB not initialized');
    return () => {};
  }
  
  if (!userIds || userIds.length === 0) {
    return () => {};
  }
  
  const unsubscribers = [];
  const presenceMap = {};
  
  try {
    userIds.forEach((userId) => {
      const userStatusRef = ref(rtdb, `status/${userId}`);
      
      const unsubscribe = onValue(userStatusRef, (snapshot) => {
        presenceMap[userId] = snapshot.val();
        callback({ ...presenceMap });
      }, (error) => {
        console.error(`Error in presence listener for ${userId}:`, error);
      });
      
      unsubscribers.push(unsubscribe);
    });
    
    // Return combined unsubscribe function
    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  } catch (error) {
    console.error('Error subscribing to multiple presence:', error);
    return () => {};
  }
};

/**
 * Get human-readable presence status
 * @param {Object} presence - Presence data from RTDB
 * @param {Function} t - Translation function (optional, defaults to English)
 * @returns {string} - Human-readable status
 */
export const getPresenceText = (presence, t = (key, params) => {
  // Fallback translations if no translation function provided
  const fallbacks = {
    activeNow: 'Active now',
    active1mAgo: 'Active 1m ago',
    activeMinsAgo: 'Active {mins}m ago',
    activeHoursAgo: 'Active {hours}h ago',
    activeDaysAgo: 'Active {days}d ago',
    lastSeenWeekAgo: 'Last seen over a week ago'
  };
  return params ? fallbacks[key]?.replace(`{${Object.keys(params)[0]}}`, Object.values(params)[0]) || key : fallbacks[key] || key;
}) => {
  if (!presence) return '';
  
  // Only show "Active now" if user is actually online
  if (presence.state === 'online') {
    return t('activeNow');
  }
  
  // For offline users, show last activity time
  if (presence.lastChanged) {
    const lastChanged = new Date(presence.lastChanged);
    const now = new Date();
    const diffMs = now - lastChanged;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return t('active1mAgo');
    if (diffMins < 60) return t('activeMinsAgo', { mins: diffMins });
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return t('activeHoursAgo', { hours: diffHours });
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return t('activeDaysAgo', { days: diffDays });
    
    return t('lastSeenWeekAgo');
  }
  
  return '';
};

/**
 * Check if user is currently online
 * @param {Object} presence - Presence data from RTDB
 * @returns {boolean}
 */
export const isUserOnline = (presence) => {
  return presence && presence.state === 'online';
};

// ========== TYPING INDICATORS ==========

/**
 * Set user as typing in a specific chat
 * @param {string} userId - User ID
 * @param {string} chatId - Chat ID
 */
export const setUserTyping = async (userId, chatId) => {
  if (!rtdb) {
    console.error('RTDB not initialized');
    return;
  }
  
  try {
    const typingRef = ref(rtdb, `typing/${chatId}/${userId}`);
    console.log('🔥 Setting typing status in RTDB:', `typing/${chatId}/${userId}`);
    await set(typingRef, {
      timestamp: serverTimestamp(),
      userId: userId,
    });
    console.log('✅ Successfully set typing status for user:', userId);
  } catch (error) {
    console.error('❌ Error setting typing status:', error);
  }
};

/**
 * Clear user typing status for a specific chat
 * @param {string} userId - User ID
 * @param {string} chatId - Chat ID
 */
export const clearUserTyping = async (userId, chatId) => {
  if (!rtdb) {
    console.error('RTDB not initialized');
    return;
  }
  
  try {
    const typingRef = ref(rtdb, `typing/${chatId}/${userId}`);
    console.log('🧹 Clearing typing status in RTDB:', `typing/${chatId}/${userId}`);
    await set(typingRef, null); // Remove the entry
    console.log('✅ Successfully cleared typing status for user:', userId);
  } catch (error) {
    console.error('❌ Error clearing typing status:', error);
  }
};

/**
 * Subscribe to typing users in a specific chat
 * @param {string} chatId - Chat ID
 * @param {Function} callback - Callback with array of typing userIds
 * @returns {Function} - Unsubscribe function
 */
export const subscribeToTypingUsers = (chatId, callback) => {
  if (!rtdb) {
    console.error('RTDB not initialized');
    return () => {};
  }
  
  if (!chatId) {
    return () => {};
  }
  
  try {
    const typingRef = ref(rtdb, `typing/${chatId}`);
    console.log('🔍 Subscribing to typing indicators at:', `typing/${chatId}`);
    
    const unsubscribe = onValue(typingRef, (snapshot) => {
      const data = snapshot.val();
      const now = Date.now();
      const TYPING_TIMEOUT = 3000; // 3 seconds
      
      console.log('📥 Typing data received:', data, 'for chat:', chatId);
      
      if (!data) {
        console.log('📭 No typing data, calling callback with empty array');
        callback([]);
        return;
      }
      
      // Filter out expired typing indicators (older than 3 seconds)
      const activeTypers = Object.keys(data).filter(userId => {
        const typingData = data[userId];
        if (!typingData || !typingData.timestamp) return false;
        
        const typingTime = new Date(typingData.timestamp).getTime();
        const isActive = (now - typingTime) < TYPING_TIMEOUT;
        console.log(`⏱️ User ${userId} typing data:`, typingData, 'isActive:', isActive);
        return isActive;
      });
      
      console.log('✨ Active typers:', activeTypers);
      callback(activeTypers);
    }, (error) => {
      console.error('❌ Error in typing listener:', error);
    });
    
    return unsubscribe;
  } catch (error) {
    console.error('Error subscribing to typing status:', error);
    return () => {};
  }
};

/**
 * Get typing indicator text for display
 * @param {Array<string>} typingUserIds - Array of typing user IDs (already filtered)
 * @param {Object} userProfiles - User profiles object
 * @param {string} currentUserId - Current user ID (for reference, not used for filtering)
 * @returns {string} - Human-readable typing text
 */
export const getTypingText = (typingUserIds, userProfiles, currentUserId) => {
  if (!typingUserIds || typingUserIds.length === 0) return '';
  
  // Get names of typing users (no need to filter, already done by caller)
  const typingNames = typingUserIds.map(userId => {
    const profile = userProfiles.find(p => p.uid === userId);
    return profile?.nickname || profile?.displayName || profile?.email || 'Someone';
  });
  
  if (typingNames.length === 1) {
    return `${typingNames[0]} is typing...`;
  } else if (typingNames.length === 2) {
    return `${typingNames[0]} and ${typingNames[1]} are typing...`;
  } else {
    return `${typingNames[0]} and ${typingNames.length - 1} others are typing...`;
  }
};

