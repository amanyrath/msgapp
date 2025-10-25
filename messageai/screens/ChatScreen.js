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
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { useNotifications } from '../context/NotificationContext';
import { useTranslation, useLocalization } from '../context/LocalizationContext';
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
import InlineTranslation from '../components/InlineTranslation';
// Removed: import AITranslationMessage from '../components/AITranslationMessage';
import SmartTextInput from '../components/SmartTextInput';
import SmartTextAssistant from '../components/SmartTextAssistant';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
// AI imports moved to dynamic imports for better bundle splitting
import subscriptionManager from '../utils/subscriptionManager';
import { printSubscriptionAnalysis } from '../utils/subscriptionDebugger';
import { shouldShowTranslationForChat } from '../utils/chatLanguageAnalysis';
import { generateProactiveTranslations, estimateProactiveTranslationCost } from '../utils/proactiveTranslation';
import { 
  setTranslationState, 
  getTranslationStates,
  isTranslationExpanded 
} from '../utils/translationStateManager';

// Utility functions for translate all toggle persistence
const TRANSLATE_ALL_STORAGE_KEY = 'msgapp_translateAllEnabled';

const saveTranslateAllState = async (chatId, enabled) => {
  try {
    const key = `${TRANSLATE_ALL_STORAGE_KEY}_${chatId}`;
    await AsyncStorage.setItem(key, JSON.stringify(enabled));
    console.log('💾 Saved translate all state for chat:', chatId, 'enabled:', enabled);
  } catch (error) {
    console.error('❌ Failed to save translate all state:', error);
  }
};

const loadTranslateAllState = async (chatId) => {
  try {
    const key = `${TRANSLATE_ALL_STORAGE_KEY}_${chatId}`;
    const value = await AsyncStorage.getItem(key);
    const enabled = value !== null ? JSON.parse(value) : false;
    console.log('📱 Loaded translate all state for chat:', chatId, 'value:', value, 'enabled:', enabled);
    return enabled;
  } catch (error) {
    console.error('❌ Failed to load translate all state:', error);
    return false;
  }
};

export default function ChatScreen({ route, navigation }) {
  const { user } = useAuth();
  const { isOffline } = useNetwork();
  const { setActiveChatId } = useNotifications();
  const t = useTranslation();
  const { userLanguagePreference } = useLocalization();
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
  
  // Translate all messages toggle state
  const [translateAllEnabled, setTranslateAllEnabled] = useState(false);
  
  // Track processed messages to avoid re-translating
  const processedMessageIds = useRef(new Set());
  
  // Inline translation state
  const [translationRecommendation, setTranslationRecommendation] = useState(null);
  const [translationStates, setTranslationStates] = useState({});
  const [userLanguage, setUserLanguage] = useState('English');
  
  // Proactive translation state
  const [preGeneratedTranslations, setPreGeneratedTranslations] = useState({});
  const [proactiveTranslationLoading, setProactiveTranslationLoading] = useState(false);
  
  // Active AI translation messages
  const [activeAITranslations, setActiveAITranslations] = useState(new Set());
  
  // Smart text assistant state
  const [smartAssistantVisible, setSmartAssistantVisible] = useState(false);
  const [smartTextData, setSmartTextData] = useState(null);
  const [languageDetection, setLanguageDetection] = useState({ detected: false, language: null });
  
  // Clear processed message IDs when chat changes
  useEffect(() => {
    processedMessageIds.current.clear();
  }, [chatId]);

  // Load translate all toggle state when chat changes - do this early and only once per chat
  useEffect(() => {
    if (chatId) {
      const loadToggleState = async () => {
        try {
          const enabled = await loadTranslateAllState(chatId);
          console.log('🔄 Loading translate all state for chat:', chatId, 'enabled:', enabled);
          setTranslateAllEnabled(enabled);
          if (enabled) {
            console.log('🌐 Restored translate all mode for chat:', chatId);
          }
        } catch (error) {
          console.error('Failed to load translate all state:', error);
          setTranslateAllEnabled(false); // Fallback to disabled
        }
      };
      
      loadToggleState();
    } else {
      // Reset when no chat ID
      setTranslateAllEnabled(false);
    }
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
  
  // Handle translate all toggle
  const handleTranslateAllToggle = useCallback(async (enabled) => {
    console.log('🔄 Toggle switch pressed - setting enabled to:', enabled, 'for chat:', chatId);
    setTranslateAllEnabled(enabled);
    console.log('🌐 Translate all messages:', enabled ? 'enabled' : 'disabled');
    
    // Save toggle state per chat for persistence
    if (chatId) {
      await saveTranslateAllState(chatId, enabled);
      console.log('✅ Toggle state saved to AsyncStorage');
    } else {
      console.warn('⚠️ No chatId available for saving toggle state');
    }
    
    if (enabled) {
      // When enabled, trigger translation of last 20 messages and set up auto-translation
      console.log('🚀 Starting translate all mode - processing last 20 messages');
      try {
        // Trigger enhanced proactive translation for last 20 messages
        const result = await generateProactiveTranslations(
          chatId, 
          messages.slice(-20), // Get last 20 messages
          user?.uid, 
          { 
            maxMessages: 20, 
            forceRefresh: false, // Use cache if available
            autoExpand: true // New flag to auto-expand translations
          }
        );
        
        if (result.success) {
          console.log(`✅ Generated ${result.translationsGenerated} translations for translate all mode`);
          setPreGeneratedTranslations(prev => ({
            ...prev,
            ...result.preGeneratedTranslations
          }));
        }
      } catch (error) {
        console.error('❌ Failed to generate translations for translate all mode:', error);
      }
    } else {
      console.log('🔄 Disabled translate all mode');
    }
  }, [chatId, messages, user?.uid]);

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
  
  // Load translation states when chat changes
  useEffect(() => {
    if (!chatId) return;
    
    const loadTranslationStates = async () => {
      try {
        const states = await getTranslationStates(chatId);
        setTranslationStates(states);
        console.log('🚀 Translation states loaded for chat:', chatId);
      } catch (error) {
        console.error('Error loading translation states:', error);
      }
    };
    
    loadTranslationStates();
  }, [chatId]);
  
  // Simplified translation setup - always show buttons for all foreign messages
  useEffect(() => {
    if (!chatId || !user?.uid || messages.length === 0) {
      console.log('🚫 Skipping proactive translation:', { chatId, userId: user?.uid, messageCount: messages.length });
      return;
    }
    
    const handleProactiveTranslation = async () => {
      console.log('🚀 Starting proactive translation analysis...');
      try {
        setProactiveTranslationLoading(true);
        
        // First, analyze if we need translations at all
        const recommendation = await shouldShowTranslationForChat(
          chatId, 
          messages, 
          user.uid,
          { forceRefresh: false }
        );
        
        console.log('🔍 Translation recommendation result:', recommendation);
        // Always enable translation buttons regardless of recommendation
        // Use the user's preferred language from LocalizationContext
        const targetLanguage = userLanguagePreference || 'English';
        console.log('🌍 Using user language preference:', targetLanguage, 'from LocalizationContext');
        console.log('📝 Setting up translations with target language:', targetLanguage);
        setTranslationRecommendation({ shouldShow: true, userLanguage: targetLanguage, targetLanguage });
        setUserLanguage(targetLanguage);
        
        if (false) { // Disable complex logic - always show buttons
          console.log('🎯 Chat needs translations, generating proactively...');
          
          // Estimate cost before proceeding
          const costEstimate = estimateProactiveTranslationCost(messages, user.uid);
          console.log('💰 Proactive translation cost estimate:', costEstimate.formattedCost, 'for', costEstimate.messagesToTranslate, 'messages');
          
          // Generate proactive translations for last 15 messages
          const proactiveResult = await generateProactiveTranslations(
            chatId,
            messages.slice(-15), // Last 15 messages
            user.uid,
            { forceRefresh: false }
          );
          
          if (proactiveResult.success && proactiveResult.preGeneratedTranslations) {
            setPreGeneratedTranslations(proactiveResult.preGeneratedTranslations);
            console.log('✅ Proactive translations ready:', proactiveResult.translationsGenerated, 'generated,', Object.keys(proactiveResult.preGeneratedTranslations).length, 'total available');
          } else {
            console.log('ℹ️ No proactive translations needed:', proactiveResult.reason);
          }
        } else {
          console.log('🚫 Complex translation analysis disabled - showing all buttons');
          // Keep any existing translations or set empty
          setPreGeneratedTranslations({});
        }
      } catch (error) {
        console.error('Error in proactive translation:', error);
      } finally {
        setProactiveTranslationLoading(false);
      }
    };
    
    // Debounce to avoid excessive API calls when messages are loading
    const timer = setTimeout(handleProactiveTranslation, 1500);
    return () => clearTimeout(timer);
  }, [messages, chatId, user?.uid]);
  
  // Handle translation toggle (now shows/hides AI translation messages)
  const handleTranslationToggle = useCallback(async (messageId, isExpanded) => {
    try {
      // Update state persistence
      await setTranslationState(chatId, messageId, isExpanded);
      setTranslationStates(prev => {
        const newStates = { ...prev };
        if (isExpanded) {
          newStates[messageId] = { expanded: true, timestamp: Date.now() };
        } else {
          delete newStates[messageId];
        }
        return newStates;
      });
      
      // Update active AI translations set
      setActiveAITranslations(prev => {
        const newSet = new Set(prev);
        if (isExpanded) {
          newSet.add(messageId);
        } else {
          newSet.delete(messageId);
        }
        return newSet;
      });
      
      console.log('🔄 AI translation toggle for message:', messageId, isExpanded ? 'shown' : 'hidden');
    } catch (error) {
      console.error('Error toggling AI translation:', error);
    }
  }, [chatId]);
  
  // Handle hiding AI translation
  const handleHideAITranslation = useCallback((messageId) => {
    handleTranslationToggle(messageId, false);
  }, [handleTranslationToggle]);
  
  // Filter out current user from typing users
  const othersTypingUsers = useMemo(() => {
    const filtered = typingUsers.filter(userId => userId !== user?.uid);
    console.log('👥 Others typing users:', filtered, 'from all:', typingUsers);
    return filtered;
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
      async (msgs) => {
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
        
        // Note: Auto-translation for translate all mode is handled in a separate effect to avoid dependency issues
      },
      { 
        cache: true, 
        shared: true, 
        priority: 'high' // Messages are high priority for active chat
      }
    );

    return () => unsubscribe();
  }, [chatId, user?.uid]); // Remove translateAllEnabled and preGeneratedTranslations to prevent subscription loops

  // Separate effect for translate all mode auto-generation to avoid subscription loops
  useEffect(() => {
    if (!translateAllEnabled || !messages.length || !user?.uid || !chatId) return;
    
    // Find new messages that need translation in translate all mode
    const newMessages = messages.filter(msg => 
      msg.senderId !== user.uid && // Not from current user
      msg.type !== 'ai' && // Not AI messages
      msg.text && // Has text
      msg.text.trim().length > 10 && // Meaningful length
      !msg.sending && // Not currently sending
      !preGeneratedTranslations[msg.id] // Not already translated
    );
    
    if (newMessages.length > 0) {
      console.log(`🌐 Auto-generating translations for ${newMessages.length} new messages in translate all mode`);
      
      const generateTranslationsForNewMessages = async () => {
        try {
          const result = await generateProactiveTranslations(
            chatId,
            newMessages,
            user.uid,
            {
              maxMessages: newMessages.length,
              forceRefresh: false,
              autoExpand: true
            }
          );
          
          if (result.success && result.preGeneratedTranslations) {
            setPreGeneratedTranslations(prev => ({
              ...prev,
              ...result.preGeneratedTranslations
            }));
            console.log(`✅ Generated ${Object.keys(result.preGeneratedTranslations).length} new translations`);
          }
        } catch (error) {
          console.error('❌ Failed to auto-generate translations for new messages:', error);
        }
      };
      
      // Debounce to avoid excessive API calls
      const timeoutId = setTimeout(generateTranslationsForNewMessages, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [translateAllEnabled, messages, user?.uid, chatId, preGeneratedTranslations]);

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

  // Subscribe to typing indicators for all chats
  useEffect(() => {
    if (!chatId || !chatMembers || chatMembers.length < 2) {
      // Need at least 2 members for typing indicators to make sense
      setTypingUsers([]);
      return;
    }

    const unsubscribe = subscriptionManager.subscribe(
      `typing-${chatId}`,
      (callback) => subscribeToTypingUsers(chatId, callback),
      (typingUserIds) => {
        console.log('📨 Received typing users update:', typingUserIds, 'for chat:', chatId);
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

  // Clear translation states when leaving the chat (unless translate all is enabled)
  useFocusEffect(
    useCallback(() => {
      console.log('📱 useFocusEffect: Screen gained focus for chat:', chatId, 'translateAllEnabled:', translateAllEnabled);
      // This runs when the screen comes into focus
      return () => {
        // This cleanup runs when the screen loses focus (user navigates away)
        console.log('📱 useFocusEffect cleanup: Screen losing focus for chat:', chatId, 'translateAllEnabled:', translateAllEnabled);
        if (!translateAllEnabled) {
          console.log('🧹 Clearing translation states on chat exit (including AsyncStorage)');
          setTranslationStates({});
          setActiveAITranslations(new Set());
          
          // Also clear AsyncStorage states for this chat
          if (chatId) {
            import('../utils/translationStateManager').then(({ clearAllTranslationStates }) => {
              clearAllTranslationStates(chatId).catch(err => 
                console.log('⚠️ Failed to clear AsyncStorage states:', err)
              );
            });
          }
        } else {
          console.log('🌐 Preserving translation states (translate all mode enabled)');
        }
      };
    }, [chatId, translateAllEnabled])
  );

  // Also clear states when component unmounts (unless translate all is enabled)
  useEffect(() => {
    return () => {
      console.log('🗑️ Component unmount cleanup: translateAllEnabled:', translateAllEnabled);
      if (!translateAllEnabled) {
        console.log('🧹 Clearing translation states on component unmount');
        setTranslationStates({});
        setActiveAITranslations(new Set());
      } else {
        console.log('🌐 Preserving translation states on unmount (translate all mode enabled)');
      }
    };
  }, [translateAllEnabled]);

  // Debug effect to track translateAllEnabled state changes
  useEffect(() => {
    console.log('🔄 translateAllEnabled changed to:', translateAllEnabled, 'for chat:', chatId);
  }, [translateAllEnabled, chatId]);

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
      console.log('👀 Setting typing status for user:', user.uid, 'in chat:', chatId);
      setUserTyping(user.uid, chatId);
      
      // Clear typing after 3 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        console.log('⏰ Clearing typing status for user:', user.uid, 'in chat:', chatId);
        clearUserTyping(user.uid, chatId);
      }, 3000);
    } else if (chatId && user) {
      // Clear typing immediately if input is empty
      console.log('🧹 Clearing typing status (empty input) for user:', user.uid, 'in chat:', chatId);
      clearUserTyping(user.uid, chatId);
    }
  };


  // Handle language detection from SmartTextInput
  const handleLanguageDetection = (detectionData) => {
    console.log('🔍 Language detection callback received:', detectionData);
    setLanguageDetection(detectionData);
    
    // If different language detected, prepare smart text data
    if (detectionData.detected && detectionData.language) {
      console.log('✅ Setting up smart text data for:', detectionData.language);
      setSmartTextData({
        text: detectionData.text,
        detectedLanguage: {
          language: detectionData.language,
          confidence: detectionData.confidence
        },
        userNativeLanguage: userLanguagePreference || userLanguage
      });
    } else {
      console.log('❌ No smart text data - clearing');
      setSmartTextData(null);
    }
  };

  // Handle text update from smart assistant
  const handleSmartTextUpdate = (newText) => {
    setNewMessage(newText);
    setSmartAssistantVisible(false);
  };

  const handleSendMessage = async (messageText = null, options = {}) => {
    const textToSend = messageText || newMessage.trim();
    
    // Validate input
    if (typeof textToSend !== 'string' || !textToSend || !chatId) return;

    // Clear typing indicator immediately when sending
    if (user && chatId) {
      clearUserTyping(user.uid, chatId);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }

    const tempId = `temp-${Date.now()}`;

    // Get current user's profile for nickname
    const currentUserProfile = userProfiles.find(p => p.id === user.uid);
    const senderName = currentUserProfile?.nickname || currentUserProfile?.displayName || user.email?.split('@')[0] || 'User';

    // Optimistic UI update - add message immediately
    const optimisticMessage = {
      id: tempId,
      text: textToSend,
      type: 'text',
      senderId: user.uid,
      senderEmail: user.email,
      senderName,
      timestamp: { toDate: () => new Date() }, // Temporary timestamp
      sending: true, // Flag to show sending state
      sentWithAI: options.sentWithAI || false, // Flag for AI-sent messages
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    
    // Only clear input if using the input field (not AI-sent)
    if (!messageText) {
      setNewMessage('');
    }
    
    scrollToBottom();

    try {
      await sendMessage(chatId, user.uid, user.email, textToSend, senderName, { sentWithAI: options.sentWithAI });
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

  // Use original messages without AI message insertion (now handled inline)
  const getDisplayMessages = useCallback(() => {
    return messages;
  }, [messages]);

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

    // Removed: AI translation messages now handled inline within regular messages
    
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
                <>
                  {item.sentWithAI && (
                    <Text style={[styles.sentWithAI, styles.myTimeText]}>
                      sent with AI
                    </Text>
                  )}
                  <Text
                    style={[
                      styles.readIndicator,
                      isMyMessage ? styles.myTimeText : styles.theirTimeText,
                    ]}
                  >
                    {item.sending ? '○' : readIndicator}
                  </Text>
                </>
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
          
          {/* iOS-Style Inline Translation beneath message */}
          {!isMyMessage && 
           (translationRecommendation?.shouldShow || translateAllEnabled) && 
           item.text && 
           item.text.trim().length > 0 && (
            <InlineTranslation
              messageId={item.id}
              messageText={item.text}
              userLanguage={userLanguage}
              chatLanguage={translationRecommendation?.chatLanguage || 'Unknown'}
              chatId={chatId}
              preGeneratedTranslations={preGeneratedTranslations}
              translationState={translationStates[item.id]}
              onToggle={handleTranslationToggle}
              translateAllEnabled={translateAllEnabled}
              autoExpand={translateAllEnabled}
            />
          )}
          
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
              <>
                {item.sentWithAI && (
                  <Text style={[styles.sentWithAI, styles.myTimeText]}>
                    sent with AI
                  </Text>
                )}
                <Text
                  style={[
                    styles.readIndicator,
                    isMyMessage ? styles.myTimeText : styles.theirTimeText,
                  ]}
                >
                  {item.sending ? '○' : readIndicator}
                </Text>
              </>
            )}
          </View>
        </View>
        {/* Translation button now moved inside message bubble above */}
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
        <View style={styles.headerSide}>
          <View style={styles.translateToggleContainer}>
            <Text style={styles.translateToggleLabel}>🌐</Text>
            <Switch
              value={translateAllEnabled}
              onValueChange={handleTranslateAllToggle}
              trackColor={{ false: '#e0e0e0', true: '#007AFF' }}
              thumbColor={translateAllEnabled ? '#fff' : '#f4f3f4'}
              ios_backgroundColor="#e0e0e0"
              style={styles.translateToggle}
              testID="translate-all-toggle"
            />
          </View>
        </View>
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
        keyboardVerticalOffset={Platform.OS === 'ios' ? 44 : 90}
      >
        {loading ? (
          <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
        ) : (
          <>
            <FlatList
              ref={flatListRef}
              data={getDisplayMessages()}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={[styles.messagesList, { paddingBottom: 20 }]}
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
                smartTextData={smartTextData}
                languageDetected={languageDetection.detected}
                onSmartTextPress={() => setSmartAssistantVisible(true)}
              />
              <SmartTextInput
                style={styles.input}
                placeholder={t('typeMessage')}
                value={newMessage}
                onChangeText={handleTyping}
                onLanguageDetected={handleLanguageDetection}
                userNativeLanguage={userLanguagePreference || userLanguage}
                multiline
                maxLength={1000}
                editable={!sendingPhoto}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  !newMessage.trim() && styles.sendButtonDisabled,
                ]}
                onPress={() => handleSendMessage()}
                disabled={!newMessage.trim() || sendingPhoto}
              >
                <Text style={styles.sendButtonText}>{t('send')}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
        
        {/* Smart Text Assistant Modal */}
        <SmartTextAssistant
          visible={smartAssistantVisible}
          onClose={() => setSmartAssistantVisible(false)}
          textData={smartTextData}
          onTextUpdate={handleSmartTextUpdate}
        />
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
  translateToggleContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  translateToggleLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  translateToggle: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
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
    maxWidth: '80%', // Increased from 75% for better side positioning
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
  sentWithAI: {
    fontSize: 10,
    fontStyle: 'italic',
    opacity: 0.8,
    marginRight: 4,
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20, // More buffer space at bottom
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    minHeight: 80, // Taller minimum height for better UX
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
  // Translation button positioning
  translationButtonContainer: {
    marginLeft: 16,
    marginRight: 16,
    marginTop: 4,
  },
  seeTranslationButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 16,
    marginLeft: 0,
  },
  seeTranslationText: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '600',
  },
  inlineTranslationButton: {
    alignSelf: 'flex-start',
    marginTop: 6,
    marginBottom: 4,
    paddingHorizontal: 0,
    paddingVertical: 2,
  },
  inlineTranslationText: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '500',
  },
});
