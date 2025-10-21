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

  // Subscribe to all user's chats and listen for new messages
  useEffect(() => {
    if (!user?.uid) {
      // Clean up existing subscriptions
      messageSubscriptions.current.forEach((unsubscribe) => unsubscribe());
      messageSubscriptions.current.clear();
      return;
    }

    console.log('🔔 Setting up notification subscriptions for user:', user.uid);

    // Subscribe to user's chats
    const unsubscribeChats = subscribeToUserChats(user.uid, (chats) => {
      console.log('🔔 Chats updated, setting up message listeners for', chats.length, 'chats');
      
      // Clean up old message subscriptions
      messageSubscriptions.current.forEach((unsubscribe) => unsubscribe());
      messageSubscriptions.current.clear();

      // For each chat, subscribe to its most recent message
      chats.forEach((chat) => {
        const messagesRef = collection(db, 'chats', chat.id, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(1));

        const unsubscribeMessages = onSnapshot(q, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const message = { id: change.doc.id, ...change.doc.data() };
              const messageKey = `${chat.id}-${message.id}`;

              // Always mark as processed first to prevent duplicates
              if (processedMessages.current.has(messageKey)) {
                return; // Already processed this message
              }
              processedMessages.current.add(messageKey);

              console.log('🔔 New message detected:', {
                chatId: chat.id,
                messageId: message.id,
                senderId: message.senderId,
                activeChat: activeChat,
                isFromCurrentUser: message.senderId === user.uid,
                isActiveChat: chat.id === activeChat
              });

              // Don't show notification if:
              // 1. Message is from current user
              // 2. Chat is currently active
              if (message.senderId !== user.uid && chat.id !== activeChat) {
                // Add small delay to prevent rapid-fire notifications
                if (notificationTimeout.current) {
                  clearTimeout(notificationTimeout.current);
                }
                
                notificationTimeout.current = setTimeout(() => {
                  // Double-check conditions after delay
                  if (message.senderId !== user.uid && chat.id !== activeChat) {
                    // Determine notification title
                    let title = 'New Message';
                    if (chat.type === 'group' || chat.members?.length > 2) {
                      title = message.senderName || 'Someone';
                    } else {
                      title = message.senderName || 'Someone';
                    }

                    // Determine notification body based on message type
                    let body = 'New message';
                    if (message.type === 'photo' && message.photo) {
                      body = '📷 Photo';
                    } else if (message.text) {
                      body = message.text;
                    }

                    // Show notification
                    showMessageNotification({
                      title,
                      body,
                      chatId: chat.id,
                      chatData: chat,
                    });

                    console.log(`📬 Notification shown: "${title}: ${body}"`);
                  } else {
                    console.log('🔕 Notification skipped (conditions changed during delay)');
                  }
                }, 100); // 100ms delay to prevent duplicates
              } else {
                console.log('🔕 Notification skipped:', {
                  reason: message.senderId === user.uid ? 'own message' : 'active chat'
                });
              }
            }
          });
        });

        // Store the unsubscribe function
        messageSubscriptions.current.set(chat.id, unsubscribeMessages);
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

