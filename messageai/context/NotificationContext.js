import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext';
import { subscribeToUserChats } from '../utils/firestore';
import { showMessageNotification } from '../utils/notifications';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import subscriptionManager from '../utils/subscriptionManager';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [activeChat, setActiveChat] = useState(null);
  const processedMessages = useRef(new Set());
  const messageSubscriptions = useRef(new Map()); // Track subscriptions to clean them up
  const notificationTimeout = useRef(null);
  const startupTime = useRef(Date.now()); // Track when notifications started to prevent startup notifications

  // Track the currently active chat so we don't show notifications for it
  const setActiveChatId = (chatId) => {
    console.log('🔔 Active chat changed:', chatId);
    setActiveChat(chatId);
  };

  // OPTIMIZED: Use cached chat data from subscription manager (no redundant subscription)
  useEffect(() => {
    if (!user?.uid) {
      // Clean up existing subscriptions
      messageSubscriptions.current.forEach((unsubscribe) => unsubscribe());
      messageSubscriptions.current.clear();
      return;
    }

    // Reset startup time for new user session to prevent notifications from existing messages
    startupTime.current = Date.now();
    console.log('🔔 Setting up OPTIMIZED notification system for user:', user.uid);

    // OPTIMIZED: Subscribe to chat updates using shared cached data
    const unsubscribeChats = subscriptionManager.subscribe(
      `user-chats-${user.uid}`, // Same key as ChatListScreen - shares the subscription!
      (callback) => subscribeToUserChats(user.uid, callback),
      (chats) => {
        console.log('🔔 Processing chats for notifications:', chats.length, 'chats');
        
        // Process chat updates for notifications (much more efficient)
        chats.forEach((chat) => {
          // Check if this chat has a newer message than we've seen
          const lastMessage = chat.lastMessage;
          const lastMessageTime = chat.lastMessageTime;
          const lastMessageSenderId = chat.lastMessageSenderId;
          
          if (!lastMessage || !lastMessageTime) return;
          
          // Skip notifications for own messages (includes Personal Notes)
          if (lastMessageSenderId === user?.uid) {
            console.log('🔕 Notification skipped: own message');
            return;
          }
          
          // Skip notifications for messages that existed before app startup (5 second grace period)
          const messageTime = lastMessageTime?.toMillis?.() || 0;
          const gracePeriod = 5000; // 5 seconds
          if (messageTime < startupTime.current + gracePeriod) {
            console.log('🔕 Notification skipped: pre-existing message from startup');
            return;
          }
          
          const messageKey = `${chat.id}-${lastMessageTime?.toMillis?.() || Date.now()}`;
          
          // Skip if already processed
          if (processedMessages.current.has(messageKey)) {
            return;
          }
          processedMessages.current.add(messageKey);

          // Use the message text directly (no need to parse sender info)
          const messageText = lastMessage;
          const senderName = 'New Message'; // We'll improve this with user profiles later
          
          // Don't show notification if chat is currently active
          if (chat.id !== activeChat) {
            // Add small delay to prevent rapid-fire notifications
            if (notificationTimeout.current) {
              clearTimeout(notificationTimeout.current);
            }
            
            notificationTimeout.current = setTimeout(() => {
              // Double-check conditions after delay
              if (chat.id !== activeChat) {
                // Show notification
                showMessageNotification({
                  title: senderName || 'New Message',
                  body: messageText || 'New message',
                  chatId: chat.id,
                  chatData: chat,
                });

                console.log(`📬 Notification shown: "${senderName}: ${messageText}"`);
              } else {
                console.log('🔕 Notification skipped (active chat)');
              }
            }, 100);
          } else {
            console.log('🔕 Notification skipped: active chat');
          }
        });
      },
      {
        cache: true,
        shared: true, // CRITICAL: Share with ChatListScreen to avoid duplicate subscription
        priority: 'high' // High priority for notifications
      }
    );

    return () => {
      console.log('🔔 Cleaning up notification subscriptions');
      unsubscribeChats();
      messageSubscriptions.current.forEach((unsubscribe) => unsubscribe());
      messageSubscriptions.current.clear();
      if (notificationTimeout.current) {
        clearTimeout(notificationTimeout.current);
      }
    };
  }, [user?.uid]); // Removed activeChat from dependencies

  // Separate effect to handle active chat changes without restarting subscriptions
  useEffect(() => {
    console.log('🔔 Active chat updated:', activeChat);
  }, [activeChat]);

  // Clean up processed messages periodically to prevent memory leak
  useEffect(() => {
    const interval = setInterval(() => {
      // Keep only last 1000 message IDs
      if (processedMessages.current.size > 1000) {
        const entries = Array.from(processedMessages.current);
        processedMessages.current = new Set(entries.slice(-1000));
      }
    }, 60000); // Every minute

    return () => clearInterval(interval);
  }, []);

  return (
    <NotificationContext.Provider value={{ setActiveChatId }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}

