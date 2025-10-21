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
 * @returns {string} - Human-readable status
 */
export const getPresenceText = (presence) => {
  if (!presence) return 'Offline';
  
  if (presence.state === 'online') {
    return 'Active now';
  }
  
  if (presence.lastChanged) {
    const lastChanged = new Date(presence.lastChanged);
    const now = new Date();
    const diffMs = now - lastChanged;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Active now';
    if (diffMins < 60) return `Active ${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Active ${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `Active ${diffDays}d ago`;
  }
  
  return 'Offline';
};

/**
 * Check if user is currently online
 * @param {Object} presence - Presence data from RTDB
 * @returns {boolean}
 */
export const isUserOnline = (presence) => {
  return presence && presence.state === 'online';
};

