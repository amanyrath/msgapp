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
    // PHASE 1: Removed logging for performance
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

    // OPTIMIZED: Subscribe to chat updates using shared cached data
    const unsubscribeChats = subscriptionManager.subscribe(
      `user-chats-${user.uid}`, // Same key as ChatListScreen - shares the subscription!
      (callback) => subscribeToUserChats(user.uid, callback),
      (chats) => {
        // PHASE 1 OPTIMIZATION: Reduced logging, early exit, optimized operations
        let processedNotification = false;
        
        // Process chat updates for notifications - optimized with early exit
        for (const chat of chats) {
          // PHASE 1: Early validation without logging
          if (!chat.lastMessage || !chat.lastMessageTime || chat.lastMessageSenderId === user?.uid) {
            continue;
          }
          
          // PHASE 1: Optimized timestamp operations
          const messageTimeMs = chat.lastMessageTime?.toMillis?.();
          if (!messageTimeMs || messageTimeMs < startupTime.current + 5000) {
            continue;
          }
          
          // PHASE 1: Optimized message key generation (single operation)
          const messageKey = `${chat.id}-${messageTimeMs}`;
          
          // PHASE 1: Optimized Set operations
          if (processedMessages.current.has(messageKey)) {
            continue;
          }
          
          // PHASE 1: Only add to Set if we're going to show notification
          if (chat.id !== activeChat) {
            processedMessages.current.add(messageKey);
            
            // Cancel any pending notification to prevent duplicates
            if (notificationTimeout.current) {
              clearTimeout(notificationTimeout.current);
            }
            
            // Show notification immediately without delay
                showMessageNotification({
              title: 'New Message',
              body: chat.lastMessage || 'New message',
                  chatId: chat.id,
                  chatData: chat,
                });

            processedNotification = true;
            // PHASE 1: Early exit - stop processing after first notification
            break;
          }
        }
      },
      {
        cache: true,
        shared: true, // CRITICAL: Share with ChatListScreen to avoid duplicate subscription
        priority: 'high' // High priority for notifications
      }
    );

    return () => {
      // PHASE 1: Optimized cleanup without logging
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
    // PHASE 1: Removed logging for performance
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

