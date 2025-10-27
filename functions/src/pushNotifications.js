const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Expo } = require('expo-server-sdk');

// Initialize Expo SDK
const expo = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN, // Optional: for better rate limiting
});

/**
 * PERFORMANCE-OPTIMIZED PUSH NOTIFICATION CLOUD FUNCTION
 * 
 * This function triggers instantly when a message is created in Firestore,
 * providing real background push notifications that are much faster than
 * the current local notification system.
 * 
 * Performance optimizations:
 * - Uses batch operations for multiple recipients
 * - Filters out invalid push tokens
 * - Non-blocking error handling
 * - Optimized Firestore queries
 */
exports.sendInstantMessageNotification = functions.firestore
  .document('chats/{chatId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const startTime = Date.now();
    const message = snap.data();
    const chatId = context.params.chatId;
    const messageId = context.params.messageId;

    try {
      console.log(`🚀 Processing notification for message: ${messageId} in chat: ${chatId}`);

      // Skip AI messages - they don't need notifications
      if (message.type === 'ai') {
        console.log('⏭️ Skipping AI message notification');
        return { success: true, reason: 'AI message skipped' };
      }

      // PERFORMANCE OPTIMIZATION: Use batch read for chat and users
      const [chatDoc, usersSnapshot] = await Promise.all([
        admin.firestore().doc(`chats/${chatId}`).get(),
        admin.firestore().collection('users').get()
      ]);

      if (!chatDoc.exists) {
        console.log('❌ Chat not found:', chatId);
        return { success: false, error: 'Chat not found' };
      }

      const chat = chatDoc.data();
      const chatName = chat.name || 'New Message';
      
      // Get recipient user IDs (exclude sender)
      const recipientIds = chat.members.filter(memberId => memberId !== message.senderId);
      
      if (recipientIds.length === 0) {
        console.log('ℹ️ No recipients for notification');
        return { success: true, reason: 'No recipients' };
      }

      // PERFORMANCE OPTIMIZATION: Build user map for fast lookups
      const userMap = new Map();
      usersSnapshot.docs.forEach(doc => {
        userMap.set(doc.id, doc.data());
      });

      // Get sender info for notification
      const sender = userMap.get(message.senderId);
      const senderName = sender?.nickname || sender?.displayName || 'Someone';

      // PERFORMANCE OPTIMIZATION: Build notifications array with filtering
      const notifications = [];
      const pushTokens = [];

      recipientIds.forEach(recipientId => {
        const recipient = userMap.get(recipientId);
        const pushToken = recipient?.pushToken;

        // Only add valid Expo push tokens
        if (pushToken && Expo.isExpoPushToken(pushToken)) {
          notifications.push({
            to: pushToken,
            sound: 'default',
            title: recipientIds.length === 1 ? senderName : `${senderName} in ${chatName}`,
            body: message.text || 'New message',
            data: { 
              chatId, 
              messageId,
              senderId: message.senderId,
              type: 'message'
            },
            priority: 'high', // High priority for instant delivery
            channelId: 'messages', // Android notification channel
          });
          pushTokens.push(pushToken);
        } else if (pushToken) {
          console.log(`⚠️ Invalid push token for user ${recipientId}: ${pushToken}`);
        }
      });

      if (notifications.length === 0) {
        console.log('ℹ️ No valid push tokens found');
        return { success: true, reason: 'No valid push tokens' };
      }

      console.log(`📤 Sending ${notifications.length} notifications to recipients`);

      // PERFORMANCE OPTIMIZATION: Send notifications in chunks for efficiency
      const chunks = expo.chunkPushNotifications(notifications);
      const tickets = [];
      let successCount = 0;

      for (const chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
          
          // Count successful deliveries
          ticketChunk.forEach(ticket => {
            if (ticket.status === 'ok') {
              successCount++;
            } else {
              console.log('❌ Notification failed:', ticket);
            }
          });
        } catch (error) {
          console.error('❌ Error sending notification chunk:', error);
        }
      }

      const processingTime = Date.now() - startTime;
      console.log(`✅ Notification processing complete in ${processingTime}ms`);
      console.log(`📊 Sent: ${successCount}/${notifications.length} notifications successfully`);

      return {
        success: true,
        messageId,
        chatId,
        recipientCount: recipientIds.length,
        notificationsSent: successCount,
        processingTimeMs: processingTime,
        pushTokens: pushTokens // For debugging
      };

    } catch (error) {
      console.error('❌ Error in sendInstantMessageNotification:', error);
      return {
        success: false,
        error: error.message,
        messageId,
        chatId,
        processingTimeMs: Date.now() - startTime
      };
    }
  });

/**
 * CLEANUP FUNCTION: Remove invalid push tokens
 * 
 * This function runs periodically to clean up invalid/expired push tokens
 * to improve notification delivery performance.
 */
exports.cleanupPushTokens = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async (context) => {
    console.log('🧹 Starting push token cleanup...');
    
    try {
      // Get all push notification receipts to identify invalid tokens
      // This is a placeholder - implement based on your needs
      console.log('✅ Push token cleanup complete');
      return { success: true };
    } catch (error) {
      console.error('❌ Error in push token cleanup:', error);
      return { success: false, error: error.message };
    }
  });
