import { ref, set, onValue, onDisconnect, serverTimestamp } from 'firebase/database';
import { rtdb } from '../config/firebase';
import NetInfo from '@react-native-community/netinfo';

// Network connectivity cache to avoid repeated network checks
let networkState = { isConnected: true, lastCheck: 0 };
const NETWORK_CHECK_CACHE_DURATION = 1000; // Cache network state for 1 second

// Retry queue for operations that failed due to network issues
let retryQueue = [];
let retryTimeoutId = null;

/**
 * Check network connectivity with caching
 * @returns {Promise<boolean>} - Whether device is connected to internet
 */
const checkNetworkConnectivity = async () => {
  const now = Date.now();
  
  // Use cached result if recent
  if (now - networkState.lastCheck < NETWORK_CHECK_CACHE_DURATION) {
    return networkState.isConnected;
  }
  
  try {
    const state = await NetInfo.fetch();
    networkState = {
      isConnected: state.isConnected ?? false,
      lastCheck: now
    };
    return networkState.isConnected;
  } catch (error) {
    console.warn('Failed to check network state:', error.message);
    // Assume offline if check fails
    return false;
  }
};

/**
 * Add operation to retry queue
 * @param {Function} operation - The operation to retry
 * @param {string} operationName - Name for logging
 */
const addToRetryQueue = (operation, operationName) => {
  retryQueue.push({ operation, operationName, timestamp: Date.now() });
  
  // Start retry process if not already running
  if (!retryTimeoutId) {
    scheduleRetry();
  }
};

/**
 * Schedule retry of queued operations
 */
const scheduleRetry = () => {
  retryTimeoutId = setTimeout(async () => {
    retryTimeoutId = null;
    
    if (retryQueue.length === 0) return;
    
    const isOnline = await checkNetworkConnectivity();
    if (!isOnline) {
      // Still offline, schedule another retry
      scheduleRetry();
      return;
    }
    
    // Process retry queue
    const currentQueue = [...retryQueue];
    retryQueue = [];
    
    console.log(`📶 Network restored, processing ${currentQueue.length} queued operations`);
    
    for (const { operation, operationName } of currentQueue) {
      try {
        await operation();
        console.log(`✅ Retry successful: ${operationName}`);
      } catch (error) {
        console.error(`❌ Retry failed: ${operationName}`, error.message);
        // Don't re-queue failed retries to avoid infinite loops
      }
    }
  }, 5000); // Retry every 5 seconds
};

/**
 * Clear retry queue (e.g., on user logout)
 */
const clearRetryQueue = () => {
  retryQueue = [];
  if (retryTimeoutId) {
    clearTimeout(retryTimeoutId);
    retryTimeoutId = null;
  }
};

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
  
  // Check network connectivity first
  const isOnline = await checkNetworkConnectivity();
  if (!isOnline) {
    console.log('📵 Offline: Queuing setUserOnline operation');
    const operation = () => setUserOnline(userId, userData);
    addToRetryQueue(operation, `setUserOnline(${userId})`);
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
    
    // Check if this is a network-related error
    if (error.code === 'permission-denied' || 
        error.code === 'network-request-failed' ||
        error.message?.includes('network') ||
        error.message?.includes('offline')) {
      console.log('📵 Network error detected, queuing operation for retry');
      const operation = () => setUserOnline(userId, userData);
      addToRetryQueue(operation, `setUserOnline(${userId})`);
    }
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
  
  // Clear any pending retry operations for this user
  clearRetryQueue();
  
  // Check network connectivity first
  const isOnline = await checkNetworkConnectivity();
  if (!isOnline) {
    console.log('📵 Offline: Cannot set user offline, will be handled by onDisconnect');
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
    // For offline operations, we don't retry since the user is intentionally going offline
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
  
  let unsubscribeFunc = null;
  let isSubscribed = false;
  
  const setupSubscription = async () => {
    const isOnline = await checkNetworkConnectivity();
    if (!isOnline) {
      console.log(`📵 Offline: Cannot subscribe to presence for ${userId}, will retry when online`);
      // Call callback with null to indicate no data available
      callback(null);
      return;
    }
    
    try {
      const userStatusRef = ref(rtdb, `status/${userId}`);
      
      unsubscribeFunc = onValue(userStatusRef, (snapshot) => {
        const data = snapshot.val();
        callback(data);
      }, (error) => {
        console.error('Error in presence listener:', error);
        
        // If network error, call callback with null and retry
        if (error.code === 'permission-denied' || 
            error.code === 'network-request-failed' ||
            error.message?.includes('network') ||
            error.message?.includes('offline')) {
          callback(null);
          // Don't add to retry queue for subscriptions, handle reconnection via network listener
        }
      });
      
      isSubscribed = true;
    } catch (error) {
      console.error('Error subscribing to presence:', error);
      callback(null);
    }
  };
  
  // Initial setup
  setupSubscription();
  
  // Listen for network state changes to re-establish subscription
  const networkUnsubscribe = NetInfo.addEventListener(async (state) => {
    if (state.isConnected && !isSubscribed) {
      console.log(`📶 Network restored, re-subscribing to presence for ${userId}`);
      setupSubscription();
    }
  });
  
  // Return combined unsubscribe function
  return () => {
    if (unsubscribeFunc) {
      unsubscribeFunc();
    }
    if (networkUnsubscribe) {
      networkUnsubscribe();
    }
    isSubscribed = false;
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
  
  let unsubscribers = [];
  let presenceMap = {};
  let isSubscribed = false;
  
  const setupSubscriptions = async () => {
    const isOnline = await checkNetworkConnectivity();
    if (!isOnline) {
      console.log(`📵 Offline: Cannot subscribe to multiple presence, will retry when online`);
      // Call callback with empty object to indicate no data available
      callback({});
      return;
    }
    
    try {
      unsubscribers = [];
      presenceMap = {};
      
      userIds.forEach((userId) => {
        const userStatusRef = ref(rtdb, `status/${userId}`);
        
        const unsubscribe = onValue(userStatusRef, (snapshot) => {
          presenceMap[userId] = snapshot.val();
          callback({ ...presenceMap });
        }, (error) => {
          console.error(`Error in presence listener for ${userId}:`, error);
          
          // If network error, remove this user from presence map
          if (error.code === 'permission-denied' || 
              error.code === 'network-request-failed' ||
              error.message?.includes('network') ||
              error.message?.includes('offline')) {
            delete presenceMap[userId];
            callback({ ...presenceMap });
          }
        });
        
        unsubscribers.push(unsubscribe);
      });
      
      isSubscribed = true;
    } catch (error) {
      console.error('Error subscribing to multiple presence:', error);
      callback({});
    }
  };
  
  // Initial setup
  setupSubscriptions();
  
  // Listen for network state changes to re-establish subscriptions
  const networkUnsubscribe = NetInfo.addEventListener(async (state) => {
    if (state.isConnected && !isSubscribed) {
      console.log(`📶 Network restored, re-subscribing to multiple presence`);
      setupSubscriptions();
    } else if (!state.isConnected && isSubscribed) {
      // Clean up subscriptions when going offline
      unsubscribers.forEach((unsub) => unsub());
      unsubscribers = [];
      isSubscribed = false;
      callback({}); // Clear presence data
    }
  });
  
  // Return combined unsubscribe function
  return () => {
    unsubscribers.forEach((unsub) => unsub());
    if (networkUnsubscribe) {
      networkUnsubscribe();
    }
    isSubscribed = false;
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
  
  // Check network connectivity first
  const isOnline = await checkNetworkConnectivity();
  if (!isOnline) {
    console.log('📵 Offline: Cannot set typing status');
    return; // Don't queue typing indicators, they're ephemeral
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
    // Don't retry typing indicators as they're ephemeral
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
  
  // Check network connectivity first
  const isOnline = await checkNetworkConnectivity();
  if (!isOnline) {
    console.log('📵 Offline: Cannot clear typing status');
    return; // Don't queue typing indicators, they're ephemeral
  }
  
  try {
    const typingRef = ref(rtdb, `typing/${chatId}/${userId}`);
    console.log('🧹 Clearing typing status in RTDB:', `typing/${chatId}/${userId}`);
    await set(typingRef, null); // Remove the entry
    console.log('✅ Successfully cleared typing status for user:', userId);
  } catch (error) {
    console.error('❌ Error clearing typing status:', error);
    // Don't retry typing indicators as they're ephemeral
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
  
  let unsubscribeFunc = null;
  let isSubscribed = false;
  
  const setupSubscription = async () => {
    const isOnline = await checkNetworkConnectivity();
    if (!isOnline) {
      console.log(`📵 Offline: Cannot subscribe to typing indicators for ${chatId}`);
      callback([]); // No typing indicators when offline
      return;
    }
    
    try {
      const typingRef = ref(rtdb, `typing/${chatId}`);
      console.log('🔍 Subscribing to typing indicators at:', `typing/${chatId}`);
      
      unsubscribeFunc = onValue(typingRef, (snapshot) => {
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
        
        // If network error, clear typing indicators
        if (error.code === 'permission-denied' || 
            error.code === 'network-request-failed' ||
            error.message?.includes('network') ||
            error.message?.includes('offline')) {
          callback([]);
        }
      });
      
      isSubscribed = true;
    } catch (error) {
      console.error('Error subscribing to typing status:', error);
      callback([]);
    }
  };
  
  // Initial setup
  setupSubscription();
  
  // Listen for network state changes
  const networkUnsubscribe = NetInfo.addEventListener(async (state) => {
    if (state.isConnected && !isSubscribed) {
      console.log(`📶 Network restored, re-subscribing to typing indicators for ${chatId}`);
      setupSubscription();
    } else if (!state.isConnected && isSubscribed) {
      // Clear typing indicators when going offline
      if (unsubscribeFunc) {
        unsubscribeFunc();
        unsubscribeFunc = null;
      }
      isSubscribed = false;
      callback([]);
    }
  });
  
  // Return combined unsubscribe function
  return () => {
    if (unsubscribeFunc) {
      unsubscribeFunc();
    }
    if (networkUnsubscribe) {
      networkUnsubscribe();
    }
    isSubscribed = false;
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

// ========== UTILITY FUNCTIONS ==========

/**
 * Clear all pending retry operations (useful on logout)
 */
export const clearPresenceRetryQueue = () => {
  clearRetryQueue();
};

/**
 * Get current network connectivity status
 * @returns {Promise<boolean>} - Whether device is connected
 */
export const checkPresenceNetworkStatus = async () => {
  return await checkNetworkConnectivity();
};

/**
 * Get retry queue status (for debugging)
 * @returns {Object} - Queue status info
 */
export const getRetryQueueStatus = () => {
  return {
    queueLength: retryQueue.length,
    hasActiveRetry: !!retryTimeoutId,
    networkState: { ...networkState }
  };
};

