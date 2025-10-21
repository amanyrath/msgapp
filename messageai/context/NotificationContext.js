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
  const chatsRef = useRef([]);

  // Track the currently active chat so we don't show notifications for it
  const setActiveChatId = (chatId) => {
    setActiveChat(chatId);
  };

  // Subscribe to all user's chats and listen for new messages
  useEffect(() => {
    if (!user?.uid) {
      return;
    }

    // Subscribe to user's chats
    const unsubscribeChats = subscribeToUserChats(user.uid, (chats) => {
      chatsRef.current = chats;

      // For each chat, subscribe to its most recent message
      chats.forEach((chat) => {
        const messagesRef = collection(db, 'chats', chat.id, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(1));

        onSnapshot(q, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const message = { id: change.doc.id, ...change.doc.data() };

              // Don't show notification if:
              // 1. Message is from current user
              // 2. Chat is currently active
              // 3. Message was already processed (initial load)
              const messageKey = `${chat.id}-${message.id}`;
              
              if (
                message.senderId !== user.uid &&
                chat.id !== activeChat &&
                !processedMessages.current.has(messageKey)
              ) {
                processedMessages.current.add(messageKey);

                // Determine notification title
                let title = 'New Message';
                if (chat.type === 'group' || chat.members?.length > 2) {
                  // Group chat: show sender name + chat name
                  title = message.senderName || 'Someone';
                } else {
                  // Direct chat: show sender name
                  title = message.senderName || 'Someone';
                }

                // Show notification
                showMessageNotification({
                  title,
                  body: message.text,
                  chatId: chat.id,
                  chatData: chat,
                });

                console.log(`📬 Notification shown for message from ${message.senderName}`);
              } else {
                // Mark as processed even if we don't show notification
                // (to avoid showing it when chat becomes inactive)
                processedMessages.current.add(messageKey);
              }
            }
          });
        });
      });
    });

    return () => {
      unsubscribeChats();
    };
  }, [user, activeChat]);

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

