import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { useNotifications } from '../context/NotificationContext';
import { useTranslation } from '../context/LocalizationContext';
import {
  createOrGetChat,
  sendMessage,
  sendPhotoMessage,
  subscribeToMessages,
  subscribeToUsers,
  markMessagesAsRead,
} from '../utils/firestore';
import { 
  subscribeToMultiplePresence, 
  getPresenceText, 
  isUserOnline,
  setUserTyping,
  clearUserTyping,
  subscribeToTypingUsers,
  getTypingText
} from '../utils/presence';
import { processPhoto } from '../utils/photos';
import PhotoMessage from '../components/PhotoMessage';
import TranslationMessage from '../components/TranslationMessage';
import AIMenuButton from '../components/AIMenuButton';
import TypingIndicator from '../components/TypingIndicator';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
// AI imports moved to dynamic imports for better bundle splitting
import subscriptionManager from '../utils/subscriptionManager';
import { printSubscriptionAnalysis } from '../utils/subscriptionDebugger';

export default function ChatScreen({ route, navigation }) {
  const { user } = useAuth();
  const { isOffline } = useNetwork();
  const { setActiveChatId } = useNotifications();
  const t = useTranslation();
  const [chatId, setChatId] = useState(route?.params?.chatId ?? null);
  const [chatMembers, setChatMembers] = useState(route?.params?.members ?? []);
  const [chatMetadata, setChatMetadata] = useState(route?.params?.metadata ?? {});
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(!route?.params?.chatId);
  const [sendingPhoto, setSendingPhoto] = useState(false);
  const flatListRef = useRef(null);
  const [userProfiles, setUserProfiles] = useState([]);
  const [presenceData, setPresenceData] = useState({});
  
  // Typing indicators
  const [typingUsers, setTypingUsers] = useState([]);
  const typingTimeoutRef = useRef(null);
  
  // Auto-translation state
  const [autoTranslateSettings, setAutoTranslateSettings] = useState({
    enabled: false,
    targetLanguage: 'English',
    formality: 'casual'
  });
  
  // Track processed messages to avoid re-translating
  const processedMessageIds = useRef(new Set());
  
  // Clear processed message IDs when chat changes
  useEffect(() => {
    processedMessageIds.current.clear();
  }, [chatId]);

  // DEVELOPMENT: Log subscription analysis (remove in production)
  useEffect(() => {
    if (__DEV__ && chatId) {
      // Log subscription analysis after component settles
      const timer = setTimeout(() => {
        console.log('📊 ChatScreen Subscription Analysis for chat:', chatId);
        printSubscriptionAnalysis();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [chatId]);
  
  // Callback for auto-translate settings changes - memoized to prevent re-renders
  const handleAutoTranslateChange = useCallback((settings) => {
    setAutoTranslateSettings(settings);
    console.log('🔄 Auto-translate settings updated:', settings);
  }, []);

  // Auto-translate new messages when enabled - memoized to prevent re-renders
  const handleAutoTranslateMessage = useCallback(async (message) => {
    // Skip if auto-translate is disabled
    if (!autoTranslateSettings.enabled) return;
    
    // Skip if message is from current user, AI, or already processed
    if (message.senderId === user?.uid || 
        message.type === 'ai' || 
        processedMessageIds.current.has(message.id)) {
      return;
    }
    
    // Skip if message doesn't have text
    if (!message.text || message.text.trim() === '') return;
    
    try {
      console.log('🔄 Auto-translating message:', message.text);
      
      // Mark as processed to avoid duplicate translations
      processedMessageIds.current.add(message.id);
      
      // Dynamic import for better bundle splitting
      const { translateText } = await import('../utils/aiService');
      const translationResult = await translateText({
        text: message.text,
        targetLanguage: autoTranslateSettings.targetLanguage,
        formality: autoTranslateSettings.formality,
        culturalContext: {
          chatContext: 'auto-translation',
          userLocation: user?.location
        }
      });
      
      if (translationResult.success) {
        // Create auto-translation message display
        let translationDisplay = `🔄 **Auto-Translation** (${translationResult.detectedLanguage || 'Auto'} → ${autoTranslateSettings.targetLanguage}):\n\n${translationResult.translation}`;
        
        // Add quality indicators
        if (translationResult.qualityMetrics) {
          const metrics = translationResult.qualityMetrics;
          translationDisplay += `\n\n📊 **Quality**: ${Math.round(metrics.overallScore * 100)}%`;
        }
        
        if (translationResult.culturalNotes && translationResult.culturalNotes.length > 0) {
          translationDisplay += `\n\n🏛️ **Cultural Context**:\n${translationResult.culturalNotes.map(note => `• ${note}`).join('\n')}`;
        }
        
        // Send auto-translation as AI message
        const { sendAIMessage } = await import('../utils/aiFirestore');
        await sendAIMessage({
          chatId,
          content: translationDisplay,
          aiType: 'auto_translation',
          parentMessageId: message.id,
          metadata: {
            originalText: message.text,
            sourceLanguage: translationResult.detectedLanguage,
            targetLanguage: autoTranslateSettings.targetLanguage,
            formality: autoTranslateSettings.formality,
            confidence: translationResult.confidence,
            isAutomatic: true
          },
          senderInfo: {
            uid: user.uid,
            email: user.email,
            name: user.displayName || user.email
          }
        });
        
        console.log('✅ Auto-translation completed for message:', message.id);
      }
    } catch (error) {
      console.error('❌ Auto-translation failed:', error);
      // Don't show error to user for auto-translations, just log it
    }
  }, [autoTranslateSettings, user, chatId]); // Dependencies: only re-create when these values change
  
  // Filter out current user from typing users
  const othersTypingUsers = useMemo(() => {
    return typingUsers.filter(userId => userId !== user?.uid);
  }, [typingUsers, user?.uid]);

  // Initialize chat based on navigation params or fallback to personal chat
  useEffect(() => {
    if (!user) return;

    if (route?.params?.chatId) {
      setChatId(route.params.chatId);
      setChatMembers(route.params?.members ?? []);
      if (route?.params?.metadata) {
        setChatMetadata(route.params.metadata);
      }
      setLoading(false);
      return;
    }

    initializeChat();
  }, [route?.params?.chatId, route?.params?.members, user]);

  useEffect(() => {
    if (route?.params?.metadata) {
      setChatMetadata(route.params.metadata);
    }
  }, [route?.params?.metadata]);

  // Set this chat as active to prevent notifications
  useEffect(() => {
    if (chatId) {
      setActiveChatId(chatId);
      console.log('📵 Notifications disabled for chat:', chatId);
    }
    
    // Clear active chat when leaving
    return () => {
      setActiveChatId(null);
      console.log('🔔 Notifications re-enabled');
    };
  }, [chatId, setActiveChatId]);

  // OPTIMIZED: Subscribe to messages using subscription manager (ONLY when chat is active)
  useEffect(() => {
    if (!chatId) return;

    console.log('📡 Subscribing to messages for chat:', chatId);
    
    const unsubscribe = subscriptionManager.subscribe(
      `messages-${chatId}`,
      (callback) => subscribeToMessages(chatId, callback, 50), // Limit to 50 messages
      (msgs) => {
        console.log('📨 Received messages:', msgs.length);
        
        setMessages(msgs);
        setLoading(false);
        setTimeout(() => scrollToBottom(), 100);
        
        // Mark unread messages as read (batch operation)
        if (user?.uid) {
          const unreadMessages = msgs.filter(
            msg => msg.senderId !== user.uid && !(msg.readBy || []).includes(user.uid)
          );
          
          if (unreadMessages.length > 0) {
            const unreadIds = unreadMessages.map(msg => msg.id);
            markMessagesAsRead(chatId, unreadIds, user.uid);
          }
        }
      },
      { 
        cache: true, 
        shared: true, 
        priority: 'high' // Messages are high priority for active chat
      }
    );

    return () => unsubscribe();
  }, [chatId, user?.uid]);

  // Separate effect for auto-translation to avoid subscription loops
  useEffect(() => {
    if (!autoTranslateSettings.enabled || !messages.length) return;
    
    // Find new messages that haven't been processed for auto-translation
    const currentMessageIds = new Set(processedMessageIds.current);
    const newMessages = messages.filter(msg => 
      !currentMessageIds.has(msg.id) && 
      msg.senderId !== user?.uid &&
      msg.type !== 'ai' &&
      msg.text && 
      msg.text.trim() !== ''
    );
    
    // Process each new message for auto-translation with debounce
    if (newMessages.length > 0) {
      console.log(`🔄 Processing ${newMessages.length} new messages for auto-translation`);
      newMessages.forEach(message => {
        processedMessageIds.current.add(message.id);
        // Use delay to ensure the message is saved first and avoid rapid-fire translations
        setTimeout(() => handleAutoTranslateMessage(message), 1500);
      });
    }
  }, [messages, autoTranslateSettings.enabled, handleAutoTranslateMessage, user?.uid]);

  // OPTIMIZED: Get user profiles from shared cache (no redundant subscription)
  useEffect(() => {
    if (!chatMembers || chatMembers.length === 0) return;

    // Try to get cached user profiles first
    const cachedProfiles = subscriptionManager.getCachedData('user-profiles');
    if (cachedProfiles) {
      const relevantProfiles = cachedProfiles.filter(profile => 
        chatMembers.includes(profile.id)
      );
      setUserProfiles(relevantProfiles);
    }

    // Subscribe with very low priority since ChatListScreen will handle this
    const unsubscribe = subscriptionManager.subscribe(
      'user-profiles',
      (callback) => subscribeToUsers(callback),
      (profiles) => {
        // Filter to only chat members
        const relevantProfiles = profiles.filter(profile => 
          chatMembers.includes(profile.id)
        );
        setUserProfiles(relevantProfiles);
      },
      { 
        cache: true, 
        shared: true, 
        priority: 'low' // Low priority since ChatListScreen handles this
      }
    );

    return () => unsubscribe();
  }, [chatMembers]);

  // Memoize other members calculation to avoid recalculating on every render
  const otherMembers = useMemo(() => {
    if (!chatMembers || chatMembers.length === 0) return [];
    return chatMembers.filter((id) => id !== user?.uid);
  }, [chatMembers, user?.uid]);

  // Subscribe to presence for chat members
  useEffect(() => {
    if (otherMembers.length === 0) return;

    const unsubscribe = subscribeToMultiplePresence(otherMembers, (data) => {
      setPresenceData(data);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [chatMembers, user?.uid]);

  // OPTIMIZED: Subscribe to typing indicators only for group chats (3+ members)
  useEffect(() => {
    if (!chatId || !chatMembers || chatMembers.length < 3) {
      // Clear typing users if not a group chat
      setTypingUsers([]);
      return;
    }

    const unsubscribe = subscriptionManager.subscribe(
      `typing-${chatId}`,
      (callback) => subscribeToTypingUsers(chatId, callback),
      (typingUserIds) => {
        setTypingUsers(typingUserIds);
      },
      { 
        cache: false, // Don't cache typing indicators (too ephemeral)
        shared: false, // Don't share (each chat screen needs its own)
        priority: 'low' // Low priority - nice to have feature
      }
    );

    return () => unsubscribe();
  }, [chatId, chatMembers]);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      // Clear typing status on unmount
      if (user && chatId) {
        clearUserTyping(user.uid, chatId);
      }
    };
  }, [user, chatId]);

  // OPTIMIZED: Subscribe to chat metadata changes with deduplication
  useEffect(() => {
    if (!chatId) return;

    const unsubscribe = subscriptionManager.subscribe(
      `chat-metadata-${chatId}`,
      (callback) => {
        const chatRef = doc(db, 'chats', chatId);
        return onSnapshot(chatRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            callback({
              name: data.name,
              icon: data.icon,
              notes: data.notes,
            });
          }
        });
      },
      (metadataUpdate) => {
        setChatMetadata((prev) => ({
          ...prev,
          ...metadataUpdate,
        }));
      },
      { 
        cache: true, 
        shared: true, 
        priority: 'low' // Low priority - metadata changes are rare
      }
    );

    return () => unsubscribe();
  }, [chatId]);

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  };

  const initializeChat = async () => {
    if (!user) return;

    try {
      setLoading(true);
      // Create a test chat with just the current user
      // In PR #4, we'll allow selecting other users
      const testChatId = await createOrGetChat(
        [user.uid],
        {
          // Personal chats don't need metadata since there are no "other" users
        }
      );
      setChatId(testChatId);
      setChatMembers([user.uid]);
      setChatMetadata({
        // Personal chats don't need metadata since there are no "other" users
      });
      console.log('Chat initialized:', testChatId);
    } catch (error) {
      console.error('Error initializing chat:', error);
      Alert.alert('Error', 'Failed to initialize chat: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle typing detection
  const handleTyping = (text) => {
    setNewMessage(text);
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    if (text.trim() && chatId && user) {
      // Set typing status
      setUserTyping(user.uid, chatId);
      
      // Clear typing after 3 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        clearUserTyping(user.uid, chatId);
      }, 3000);
    } else if (chatId && user) {
      // Clear typing immediately if input is empty
      clearUserTyping(user.uid, chatId);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !chatId) return;

    // Clear typing indicator immediately when sending
    if (user && chatId) {
      clearUserTyping(user.uid, chatId);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }

    const messageText = newMessage.trim();
    const tempId = `temp-${Date.now()}`;

    // Get current user's profile for nickname
    const currentUserProfile = userProfiles.find(p => p.id === user.uid);
    const senderName = currentUserProfile?.nickname || currentUserProfile?.displayName || user.email?.split('@')[0] || 'User';

    // Optimistic UI update - add message immediately
    const optimisticMessage = {
      id: tempId,
      text: messageText,
      type: 'text',
      senderId: user.uid,
      senderEmail: user.email,
      senderName,
      timestamp: { toDate: () => new Date() }, // Temporary timestamp
      sending: true, // Flag to show sending state
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setNewMessage('');
    scrollToBottom();

    try {
      await sendMessage(chatId, user.uid, user.email, messageText, senderName);
      // Message will be updated by real-time listener
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message: ' + error.message);
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
    }
  };

  const handleSendPhoto = async (source) => {
    if (!chatId || sendingPhoto) return;

    setSendingPhoto(true);

    try {
      console.log('📸 Starting photo send process:', {
        source,
        chatId,
        userUid: user?.uid,
        userEmail: user?.email
      });

      // Get current user's profile for nickname
      const currentUserProfile = userProfiles.find(p => p.id === user.uid);
      const senderName = currentUserProfile?.nickname || currentUserProfile?.displayName || user.email?.split('@')[0] || 'User';

      // Process photo (select, resize, upload)
      const photoData = await processPhoto(source, chatId, user.uid);
      
      if (!photoData) {
        // User cancelled photo selection
        console.log('📷 Photo selection cancelled by user');
        setSendingPhoto(false);
        return;
      }

      console.log('📷 Photo processed successfully:', photoData);

      const tempId = `temp-photo-${Date.now()}`;

      // Optimistic UI update - add photo message immediately
      const optimisticMessage = {
        id: tempId,
        type: 'photo',
        photo: photoData,
        senderId: user.uid,
        senderEmail: user.email,
        senderName,
        timestamp: { toDate: () => new Date() },
        sending: true,
      };

      setMessages((prev) => [...prev, optimisticMessage]);
      scrollToBottom();

      // Send photo message to Firestore
      console.log('💾 Saving photo message to Firestore...');
      await sendPhotoMessage(chatId, user.uid, user.email, photoData, senderName);
      
      console.log('✅ Photo message sent successfully');
    } catch (error) {
      console.error('❌ Error sending photo:', error);
      Alert.alert('Error', 'Failed to send photo: ' + error.message);
    } finally {
      setSendingPhoto(false);
    }
  };

  const canGoBack = navigation?.canGoBack?.() ?? false;
  const userProfileMap = useMemo(() => {
    const map = {};
    userProfiles.forEach((profile) => {
      map[profile.id] = profile;
    });
    return map;
  }, [userProfiles]);

  const metadataNameMap = useMemo(() => {
    const map = {};
    const metaNames = chatMetadata?.memberDisplayNames;
    if (Array.isArray(metaNames) && chatMembers?.length) {
      // Filter out current user from members for mapping since metadata only includes other users
      const otherMembers = chatMembers.filter(id => id !== user?.uid);
      otherMembers.forEach((memberId, index) => {
        const name = metaNames[index];
        if (name) {
          map[memberId] = name;
        }
      });
    }
    return map;
  }, [chatMetadata?.memberDisplayNames, chatMembers, user?.uid]);

  const getDisplayName = (memberId, fallbackEmail) => {
    // Don't show current user's name
    if (memberId === user?.uid) return null;
    
    // For 1-on-1 chats, skip metadata and use live user profile data to avoid incorrect stored names
    const isOneOnOne = chatMembers && chatMembers.length === 2;
    
    if (!isOneOnOne) {
      // For group chats, use metadata first (allows custom nicknames)
      const metaName = metadataNameMap[memberId];
      if (metaName) return metaName;
    }
    
    // Always prefer live user profile data for accuracy
    const profile = userProfileMap[memberId];
    if (profile?.nickname) return profile.nickname;
    if (profile?.displayName) return profile.displayName;
    if (profile?.email) return profile.email;
    if (fallbackEmail) return fallbackEmail;
    return memberId;
  };

  const chatTitle = useMemo(() => {
    if (!chatMembers?.length) return 'Chat';
    const currentUserId = user?.uid;
    
    // More robust filtering - ensure we're comparing strings and handle null/undefined
    const others = chatMembers.filter((id) => {
      const memberId = String(id || '').trim();
      const currentId = String(currentUserId || '').trim();
      return memberId && currentId && memberId !== currentId;
    });
    
    if (others.length === 0) return 'Personal Notes';
    
    // For 1-on-1 chats (2 members), always use the other user's name
    if (chatMembers.length === 2) {
      const names = others.map((id) => getDisplayName(id)).filter(Boolean);
      return names.length > 0 ? names[0] : 'Chat';
    }
    
    // For group chats (3+ members), use custom name if available
    if (chatMetadata?.name) {
      return chatMetadata.name;
    }
    
    // Fallback to dynamic name generation for groups
    const names = others.map((id) => getDisplayName(id)).filter(Boolean);
    return names.length > 0 ? names.join(' & ') : 'Chat';
  }, [chatMembers, chatMetadata?.name, metadataNameMap, userProfileMap, user?.uid]);

  const chatPresenceText = useMemo(() => {
    if (!chatMembers?.length) return '';
    const currentUserId = user?.uid;
    const others = chatMembers.filter((id) => {
      const memberId = String(id || '').trim();
      const currentId = String(currentUserId || '').trim();
      return memberId && currentId && memberId !== currentId;
    });
    if (others.length === 0) return '';
    
    // For 1-on-1 chats, show the user's presence
    if (others.length === 1) {
      const presence = presenceData[others[0]];
      return getPresenceText(presence, t);
    }
    
    // For group chats, show count of online members
    const onlineCount = others.filter((id) => isUserOnline(presenceData[id])).length;
    const totalOthers = others.length;
    
    if (onlineCount === 0) return '';
    if (onlineCount === 1) return t('oneUserOnline') || '1 user online';
    if (onlineCount === totalOthers) return t('allUsersOnline', { count: totalOthers }) || `All ${totalOthers} users online`;
    return t('usersOnlineCount', { online: onlineCount, total: totalOthers }) || `${onlineCount} of ${totalOthers} users online`;
  }, [chatMembers, presenceData, user?.uid]);

  const formatTime = (timestamp) => {
    if (!timestamp?.toDate) return '';
    const date = timestamp.toDate();
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Memoized message renderer for better performance
  const renderMessage = useCallback(({ item }) => {
    const isMyMessage = item.senderId === user.uid;
    const senderName = getDisplayName(item.senderId, item.senderEmail);

    // Calculate read status for sender's messages
    let readIndicator = '';
    if (isMyMessage && !item.sending) {
      const readBy = item.readBy || [];
      const otherMembers = (chatMembers || []).filter(id => id !== user.uid);
      const readByOthers = readBy.filter(id => id !== user.uid);
      
      if (otherMembers.length === 0) {
        // Personal chat with self - always read
        readIndicator = '✓✓';
      } else if (readByOthers.length === 0) {
        // Not read by anyone yet - single checkmark (sent)
        readIndicator = '✓';
      } else if (readByOthers.length === otherMembers.length) {
        // Read by ALL other members - double checkmark
        readIndicator = '✓✓';
      } else {
        // Read by some but not all - single checkmark
        readIndicator = '✓';
      }
    }

    // Render AI messages differently
    if (item.type === 'ai') {
      return (
        <TranslationMessage 
          message={item}
          onFeedback={(messageId, helpful) => {
            // Handle AI feedback - could implement in future
            console.log('AI feedback:', messageId, helpful);
          }}
        />
      );
    }

    // Render photo messages differently
    if (item.type === 'photo' && item.photo) {
      return (
        <View
          style={[
            styles.messageContainer,
            isMyMessage ? styles.myMessageContainer : styles.theirMessageContainer,
          ]}
        >
          <View
            style={[
              styles.photoMessageContainer,
              isMyMessage ? styles.myPhotoMessage : styles.theirPhotoMessage,
              item.sending && styles.sendingMessage,
            ]}
          >
            {!isMyMessage && chatMembers && chatMembers.length > 2 && (
              <Text style={styles.senderName}>{senderName}</Text>
            )}
            <PhotoMessage 
              photo={item.photo}
              isOwnMessage={isMyMessage}
              maxWidth={220}
            />
            <View style={styles.messageFooter}>
              <Text
                style={[
                  styles.timeText,
                  isMyMessage ? styles.myTimeText : styles.theirTimeText,
                ]}
              >
                {formatTime(item.timestamp)}
              </Text>
              {isMyMessage && (
                <Text
                  style={[
                    styles.readIndicator,
                    isMyMessage ? styles.myTimeText : styles.theirTimeText,
                  ]}
                >
                  {item.sending ? '○' : readIndicator}
                </Text>
              )}
            </View>
            {sendingPhoto && item.sending && (
              <View style={styles.sendingOverlay}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.sendingText}>Sending photo...</Text>
              </View>
            )}
          </View>
        </View>
      );
    }

    // Render text messages
    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessageContainer : styles.theirMessageContainer,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isMyMessage ? styles.myMessageBubble : styles.theirMessageBubble,
            item.sending && styles.sendingMessage,
          ]}
        >
          {!isMyMessage && chatMembers && chatMembers.length > 2 && (
            <Text style={styles.senderName}>{senderName}</Text>
          )}
          <Text
            style={[
              styles.messageText,
              isMyMessage ? styles.myMessageText : styles.theirMessageText,
            ]}
          >
            {item.text}
          </Text>
          <View style={styles.messageFooter}>
            <Text
              style={[
                styles.timeText,
                isMyMessage ? styles.myTimeText : styles.theirTimeText,
              ]}
            >
              {formatTime(item.timestamp)}
            </Text>
            {isMyMessage && (
              <Text
                style={[
                  styles.readIndicator,
                  isMyMessage ? styles.myTimeText : styles.theirTimeText,
                ]}
              >
                {item.sending ? '○' : readIndicator}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  }, [user?.uid, getDisplayName, chatMembers, formatTime]); // Dependencies for renderMessage

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerSide}>
          {canGoBack && (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Text style={styles.backButtonText}>{t('back')}</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity 
          style={styles.headerTitleWrapper}
          onPress={() => {
            // Only allow settings for group chats (3+ members)
            if (chatId && chatMembers && chatMembers.length >= 3) {
              navigation.navigate('ChatSettings', {
                chatId,
                chatData: {
                  name: chatMetadata?.name || chatTitle,
                  icon: chatMetadata?.icon,
                  notes: chatMetadata?.notes,
                  members: chatMembers,
                },
              });
            }
          }}
          disabled={!chatMembers || chatMembers.length < 3}
        >
          <Text style={styles.title}>{chatTitle}</Text>
          {chatPresenceText && (
            <Text style={styles.presenceText}>{chatPresenceText}</Text>
          )}
        </TouchableOpacity>
        <View style={styles.headerSide} />
      </View>

      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>{t('offline')}</Text>
        </View>
      )}
      
      {autoTranslateSettings.enabled && (
        <View style={styles.autoTranslateBanner}>
          <Text style={styles.autoTranslateText}>
            🔄 Live Translation ON → {autoTranslateSettings.targetLanguage} ({autoTranslateSettings.formality})
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        {loading ? (
          <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
        ) : (
          <>
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messagesList}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  {t('noMessagesYetStartConversation') || 'No messages yet. Start the conversation! 💬'}
                </Text>
              }
              onContentSizeChange={() => scrollToBottom()}
            />

            {/* Typing Indicator */}
            <TypingIndicator 
              visible={othersTypingUsers.length > 0} 
              typingText={getTypingText(othersTypingUsers, userProfiles, user?.uid)} 
            />

            <View style={styles.inputContainer}>
              <AIMenuButton 
                onPhotoSelected={handleSendPhoto}
                disabled={sendingPhoto || isOffline}
                chatId={chatId}
                messages={messages}
                userProfiles={userProfiles}
                onAutoTranslateChange={handleAutoTranslateChange}
                currentUser={user}
              />
              <TextInput
                style={styles.input}
                placeholder={t('typeMessage')}
                value={newMessage}
                onChangeText={handleTyping}
                multiline
                maxLength={1000}
                editable={!sendingPhoto}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  !newMessage.trim() && styles.sendButtonDisabled,
                ]}
                onPress={handleSendMessage}
                disabled={!newMessage.trim() || sendingPhoto}
              >
                <Text style={styles.sendButtonText}>{t('send')}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  offlineBanner: {
    backgroundColor: '#FFA500',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  offlineText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  autoTranslateBanner: {
    backgroundColor: '#4CAF50',
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  autoTranslateText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  presenceText: {
    fontSize: 13,
    color: '#34C759',
    marginTop: 2,
  },
  headerSide: {
    width: 72,
  },
  headerTitleWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 100,
  },
  messageContainer: {
    marginBottom: 12,
    flexDirection: 'row',
  },
  myMessageContainer: {
    justifyContent: 'flex-end',
  },
  theirMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  myMessageBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  theirMessageBubble: {
    backgroundColor: '#E5E5EA',
    borderBottomLeftRadius: 4,
  },
  sendingMessage: {
    opacity: 0.7,
  },
  senderName: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#fff',
  },
  theirMessageText: {
    color: '#000',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  timeText: {
    fontSize: 11,
  },
  myTimeText: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  theirTimeText: {
    color: '#666',
  },
  readIndicator: {
    fontSize: 11,
    fontWeight: '600',
  },
  photoMessageContainer: {
    maxWidth: '75%',
    padding: 4,
    borderRadius: 20,
    position: 'relative',
  },
  myPhotoMessage: {
    backgroundColor: 'transparent',
    alignSelf: 'flex-end',
  },
  theirPhotoMessage: {
    backgroundColor: 'transparent', 
    alignSelf: 'flex-start',
  },
  sendingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 8,
  },
  sendingText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    marginRight: 8,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#B0B0B0',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
