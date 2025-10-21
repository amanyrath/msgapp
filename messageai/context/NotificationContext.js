import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext';
import { subscribeToUserChats } from '../utils/firestore';
import { showMessageNotification } from '../utils/notifications';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [activeChat, setActiveChat] = useState(null);
  const processedMessages = useRef(new Set());
  const messageSubscriptions = useRef(new Map()); // Track subscriptions to clean them up
  const notificationTimeout = useRef(null);

  // Track the currently active chat so we don't show notifications for it
  const setActiveChatId = (chatId) => {
    console.log('🔔 Active chat changed:', chatId);
    setActiveChat(chatId);
  };

  // Subscribe to all user's chats with SINGLE optimized subscription
  useEffect(() => {
    if (!user?.uid) {
      // Clean up existing subscriptions
      messageSubscriptions.current.forEach((unsubscribe) => unsubscribe());
      messageSubscriptions.current.clear();
      return;
    }

    console.log('🔔 Setting up OPTIMIZED notification subscription for user:', user.uid);

    // OPTIMIZED: Single subscription to all user chats with lastMessage data
    const unsubscribeChats = subscribeToUserChats(user.uid, (chats) => {
      console.log('🔔 Chats updated:', chats.length, 'chats');
      
      // Process chat updates for notifications (much more efficient)
      chats.forEach((chat) => {
        // Check if this chat has a newer message than we've seen
        const lastMessage = chat.lastMessage;
        const lastMessageTime = chat.lastMessageTime;
        
        if (!lastMessage || !lastMessageTime) return;
        
        const messageKey = `${chat.id}-${lastMessageTime?.toMillis?.() || Date.now()}`;
        
        // Skip if already processed
        if (processedMessages.current.has(messageKey)) {
          return;
        }
        processedMessages.current.add(messageKey);

        // Parse sender info from lastMessage (format: "SenderName: message text")
        const messageParts = lastMessage.split(': ');
        const senderName = messageParts[0];
        const messageText = messageParts.slice(1).join(': ');
        
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
    });

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

