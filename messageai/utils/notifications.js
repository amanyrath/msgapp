import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';

// Configure how notifications should be displayed when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request notification permissions from the user
 * @returns {Promise<boolean>} Whether permissions were granted
 */
export async function registerForPushNotifications() {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Ask for permission if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Notification permissions not granted');
      return false;
    }

    // For Android, configure notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#CD853F',
        sound: 'default',
      });
    }

    console.log('Notification permissions granted');
    return true;
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
}

/**
 * Show a local notification for a new message
 * @param {Object} params - Notification parameters
 * @param {string} params.title - Notification title (sender name or chat name)
 * @param {string} params.body - Notification body (message text)
 * @param {string} params.chatId - Chat ID to navigate to when tapped
 * @param {Object} params.chatData - Full chat data for navigation
 */
export async function showMessageNotification({ title, body, chatId, chatData }) {
  try {
    // PERFORMANCE OPTIMIZATION: Pre-validate and optimize notification display
    const safeTitle = title || 'New Message';
    const safeBody = body || 'New message';
    
    // Use non-blocking notification scheduling for instant display
    Notifications.scheduleNotificationAsync({
      content: {
        title: safeTitle,
        body: safeBody,
        sound: 'default',
        data: { chatId, chatData },
        priority: Notifications.AndroidNotificationPriority.HIGH, // High priority for instant display
      },
      trigger: null, // Show immediately
    }).catch(error => {
      // Non-blocking error handling - don't await to prevent delays
      console.error('Error showing notification:', error);
    });
  } catch (error) {
    console.error('Error in notification setup:', error);
  }
}

/**
 * Cancel all pending notifications
 */
export async function cancelAllNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Error canceling notifications:', error);
  }
}

/**
 * Get the number of unread notifications (badge count)
 */
export async function getBadgeCount() {
  try {
    return await Notifications.getBadgeCountAsync();
  } catch (error) {
    console.error('Error getting badge count:', error);
    return 0;
  }
}

/**
 * Set the app icon badge count
 * @param {number} count - Badge count
 */
export async function setBadgeCount(count) {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    console.error('Error setting badge count:', error);
  }
}

/**
 * Register for push notifications and get push token
 * @param {string} userId - User ID to store push token for
 * @returns {Promise<string|null>} Push token or null if failed
 */
export async function registerForPushTokenAsync(userId) {
  let token;
  
  try {
    // Skip device check for now - will work on physical devices and simulators
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Push notification permissions not granted');
      return null;
    }
    
    // Get Expo push token for real push notifications
    const pushTokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '9a4e5f8e-5788-49cf-babe-ff1d1bf98ae6' // Your EAS project ID
    });
    
    token = pushTokenData.data;
    console.log('📱 Push token obtained:', token);
    
    // Store push token in user's Firestore document
    if (userId && token) {
      await updateDoc(doc(db, 'users', userId), {
        pushToken: token,
        pushTokenUpdated: new Date()
      });
      console.log('✅ Push token stored in Firestore for user:', userId);
    }
      
  } catch (error) {
    console.error('Error registering for push notifications:', error);
  }
  
  return token;
}

/**
 * Clear push token for user (call on logout)
 * @param {string} userId - User ID to clear push token for
 */
export async function clearPushToken(userId) {
  try {
    if (userId) {
      await updateDoc(doc(db, 'users', userId), {
        pushToken: null,
        pushTokenUpdated: new Date()
      });
      console.log('🗑️ Push token cleared for user:', userId);
    }
  } catch (error) {
    console.error('Error clearing push token:', error);
  }
}

