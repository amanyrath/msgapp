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
  sendAudioMessage,
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
import AudioMessageBubble from '../components/AudioMessageBubble';
import SimpleVoiceRecorder from '../components/SimpleVoiceRecorder';
import GroupMemberList from '../components/GroupMemberList';
// import AudioMessageManager from '../components/AudioMessageManager'; // Temporarily disabled - requires react-native-gesture-handler
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
// AI imports moved to dynamic imports for better bundle splitting
import subscriptionManager from '../utils/subscriptionManager';
import { printSubscriptionAnalysis } from '../utils/subscriptionDebugger';
// Removed chat language analysis - users can speak any language!
import { generateProactiveTranslations, estimateProactiveTranslationCost } from '../utils/proactiveTranslation';
import { 
  setTranslationState, 
  getTranslationStates,
  isTranslationExpanded 
} from '../utils/translationStateManager';
import { processMessageForInsights } from '../utils/insightsProcessor';
import { 
  getCachedTranslation,
  cacheTranslation
} from '../utils/autoTranslationState';
import OfflineCache from '../utils/offlineCache';

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
  
  // Audio message state
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const [audioObjects, setAudioObjects] = useState(new Map());
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const flatListRef = useRef(null);
  const [userProfiles, setUserProfiles] = useState([]);
  const [presenceData, setPresenceData] = useState({});
  
  // Typing indicators
  const [typingUsers, setTypingUsers] = useState([]);
  const typingTimeoutRef = useRef(null);
  
  
  // Translate all messages toggle state
  const [translateAllEnabled, setTranslateAllEnabled] = useState(false);
  
  // Debug: Log toggle state changes
  useEffect(() => {
    console.log('🌐 TOGGLE STATE CHANGED:', translateAllEnabled);
  }, [translateAllEnabled]);
  
  // Track processed messages to avoid re-translating
  const processedMessageIds = useRef(new Set());
  
  // NEW: Translation replacement state - tracks which messages are showing translations vs originals
  const [messageTranslations, setMessageTranslations] = useState({}); // { messageId: { translation, originalText, isShowingOriginal } }
  const [processingTranslations, setProcessingTranslations] = useState(false);
  const [translationLoadingState, setTranslationLoadingState] = useState(null); // 'checking-cache' | 'generating' | null
  
  // Inline translation state (kept for fallback cases)
  const [translationRecommendation, setTranslationRecommendation] = useState({
    shouldShow: true, // Always enable translations for international communication
    userLanguage: 'English',
    chatLanguage: 'Mixed',
    reason: 'International communication - translate all foreign messages'
  });
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
  
  // Group member list state
  const [showMemberList, setShowMemberList] = useState(false);
  
  // Track which messages need translation UI (not in user's native language)
  const [messagesNeedingTranslation, setMessagesNeedingTranslation] = useState(new Set());
  
  // Offline cache state
  const [usingCachedMessages, setUsingCachedMessages] = useState(false);
  const [cachedMessageCount, setCachedMessageCount] = useState(0);
  
  // Clear processed message IDs and caches when chat changes
  useEffect(() => {
    processedMessageIds.current.clear();
    // Also clear language detection cache when chat changes
    languageDetectionCache.current.clear();
    // Clear in-memory translation cache when switching chats
    translationMemoryCache.current = null;
  }, [chatId]);

  // OPTIMIZATION: Add language detection cache to avoid re-detecting same messages
  const languageDetectionCache = useRef(new Map());
  
  // OPTIMIZATION: In-memory translation cache for instant access
  const translationMemoryCache = useRef(null);

  // OPTIMIZED: Comprehensive language detection heuristics to minimize API calls
  const fastLanguageHeuristic = useCallback((messageText, userNativeLanguage) => {
    if (!messageText || messageText.trim().length < 8) {
      // Very short messages - assume same language to avoid API call
      return { confident: true, isSameLanguage: true, reason: 'too_short' };
    }

    const text = messageText.toLowerCase().trim();
    const userLang = userNativeLanguage.toLowerCase();
    const words = text.split(/\s+/);
    
    // Skip if mostly numbers, URLs, or symbols
    const numericRatio = (text.match(/\d/g) || []).length / text.length;
    if (numericRatio > 0.5 || text.includes('http') || text.includes('www.')) {
      return { confident: true, isSameLanguage: true, reason: 'numeric_or_url' };
    }

    // Enhanced English detection
    if (userLang.includes('english')) {
      const englishCommon = ['the', 'and', 'you', 'that', 'was', 'for', 'are', 'with', 'his', 'they', 'this', 'have', 'will', 'your', 'can', 'not', 'but', 'what', 'all', 'would', 'there', 'when'];
      const englishVerbs = ['is', 'am', 'are', 'was', 'were', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'get', 'got', 'go', 'went', 'come', 'came', 'see', 'saw', 'know', 'knew', 'think', 'thought', 'want', 'like', 'need', 'make', 'made'];
      const englishPronouns = ['i', 'me', 'my', 'mine', 'we', 'us', 'our', 'ours', 'he', 'him', 'she', 'her', 'it', 'its'];
      
      const englishWords = [...englishCommon, ...englishVerbs, ...englishPronouns];
      const englishMatches = words.filter(word => englishWords.includes(word.replace(/[.,!?;:]$/, ''))).length;
      
      // Check for Spanish indicators
      const spanishWords = ['que', 'el', 'la', 'de', 'y', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'una', 'del', 'los', 'las', 'como', 'pero', 'sus', 'está', 'todo', 'esta', 'ser', 'hay', 'donde', 'más', 'muy', 'me', 'ya', 'así', 'aquí'];
      const spanishMatches = words.filter(word => spanishWords.includes(word.replace(/[.,!?;:]$/, ''))).length;
      
      // French indicators  
      const frenchWords = ['le', 'de', 'et', 'à', 'un', 'il', 'être', 'et', 'en', 'avoir', 'que', 'pour', 'dans', 'ce', 'son', 'une', 'sur', 'avec', 'ne', 'se', 'pas', 'par', 'mais', 'du', 'au', 'vous', 'je', 'nous', 'elle', 'les', 'des', 'ces', 'cette', 'mes', 'ses', 'nos', 'vos', 'leurs'];
      const frenchMatches = words.filter(word => frenchWords.includes(word.replace(/[.,!?;:]$/, ''))).length;
      
      const totalWords = Math.max(words.length, 1);
      const englishRatio = englishMatches / totalWords;
      const spanishRatio = spanishMatches / totalWords;
      const frenchRatio = frenchMatches / totalWords;
      
      if (englishRatio >= 0.4 && spanishRatio <= 0.15 && frenchRatio <= 0.15) {
        return { confident: true, isSameLanguage: true, reason: `english_heuristic_${Math.round(englishRatio * 100)}%` };
      }
      if (spanishRatio >= 0.3 && englishRatio <= 0.2) {
        return { confident: true, isSameLanguage: false, reason: `spanish_detected_${Math.round(spanishRatio * 100)}%` };
      }
      if (frenchRatio >= 0.3 && englishRatio <= 0.2) {
        return { confident: true, isSameLanguage: false, reason: `french_detected_${Math.round(frenchRatio * 100)}%` };
      }
    }

    // Enhanced Spanish detection  
    if (userLang.includes('spanish') || userLang.includes('español')) {
      const spanishWords = ['que', 'el', 'la', 'de', 'y', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'una', 'del', 'los', 'las', 'como', 'pero', 'sus', 'está', 'todo', 'esta', 'ser', 'hay', 'donde', 'más', 'muy', 'me', 'ya', 'así', 'aquí'];
      const spanishMatches = words.filter(word => spanishWords.includes(word.replace(/[.,!?;:]$/, ''))).length;
      const spanishRatio = spanishMatches / Math.max(words.length, 1);
      
      if (spanishRatio >= 0.4) {
        return { confident: true, isSameLanguage: true, reason: `spanish_heuristic_${Math.round(spanishRatio * 100)}%` };
      }
    }

    // Enhanced character set detection
    const hasAccents = /[áéíóúüñ¿¡àèùâêîôûçë]/i.test(text);
    const hasCyrillic = /[а-яё]/i.test(text);
    const hasArabic = /[\u0600-\u06FF]/i.test(text);
    const hasChinese = /[\u4e00-\u9fff]/i.test(text);
    const hasJapanese = /[\u3040-\u309f\u30a0-\u30ff]/i.test(text);
    const hasKorean = /[\uac00-\ud7af]/i.test(text);

    // Strong character set indicators
    if (hasCyrillic || hasArabic || hasChinese || hasJapanese || hasKorean) {
      const isUserNonLatin = userLang.includes('chinese') || userLang.includes('japanese') || 
                            userLang.includes('korean') || userLang.includes('arabic') || 
                            userLang.includes('russian') || userLang.includes('cyrillic');
      return { confident: true, isSameLanguage: isUserNonLatin, reason: 'non_latin_script' };
    }

    // Accent detection for Romance languages
    if (hasAccents) {
      const isUserRomance = userLang.includes('spanish') || userLang.includes('french') || 
                           userLang.includes('italian') || userLang.includes('portuguese');
      const isUserEnglish = userLang.includes('english');
      
      if (isUserEnglish) {
        return { confident: true, isSameLanguage: false, reason: 'accented_chars_non_english' };
      }
      if (isUserRomance) {
        return { confident: false, isSameLanguage: false, reason: 'accented_chars_romance' }; // Less certain
      }
    }

    // Emoji and casual text patterns
    const emojiCount = (text.match(/[\u{1f600}-\u{1f64f}\u{1f300}-\u{1f5ff}\u{1f680}-\u{1f6ff}\u{1f1e0}-\u{1f1ff}]/gu) || []).length;
    if (emojiCount > words.length * 0.3) {
      return { confident: true, isSameLanguage: true, reason: 'emoji_heavy' };
    }

    // If we couldn't determine with confidence, use API
    return { confident: false, isSameLanguage: false, reason: 'needs_api' };
  }, []);

  // OPTIMIZED: Helper function with caching and heuristics
  const isMessageInUserLanguage = useCallback(async (messageText, userNativeLanguage) => {
    if (!messageText || !userNativeLanguage) return false;
    
    // Check cache first
    const cacheKey = `${messageText.substring(0, 100)}_${userNativeLanguage}`;
    if (languageDetectionCache.current.has(cacheKey)) {
      const cached = languageDetectionCache.current.get(cacheKey);
      console.log(`⚡ Using cached language detection: ${cached ? 'SAME' : 'DIFFERENT'} (cache size: ${languageDetectionCache.current.size})`);
      return cached;
    }

    // Try fast heuristics first
    const heuristic = fastLanguageHeuristic(messageText, userNativeLanguage);
    if (heuristic.confident) {
      console.log(`⚡ Fast heuristic detection (${heuristic.reason}): ${heuristic.isSameLanguage ? 'SAME LANGUAGE' : 'DIFFERENT LANGUAGE'}`);
      // Cache heuristic results too
      if (languageDetectionCache.current.size > 100) {
        const entries = Array.from(languageDetectionCache.current.entries());
        entries.slice(0, 50).forEach(([key]) => languageDetectionCache.current.delete(key));
      }
      languageDetectionCache.current.set(cacheKey, heuristic.isSameLanguage);
      return heuristic.isSameLanguage;
    }
    
    try {
      // Fall back to API detection for unclear cases
      const { detectLanguage } = await import('../utils/aiService');
      const detection = await detectLanguage(messageText);
      
      if (detection.success) {
        const detectedLang = detection.language.toLowerCase();
        const userLang = userNativeLanguage.toLowerCase();
        const confidence = detection.confidence || 0;
        
        console.log(`🔍 API language detection for "${messageText.substring(0, 30)}...": detected="${detectedLang}", user="${userLang}", confidence=${confidence}`);
        
        const isMatch = detectedLang === userLang ||
                       (detectedLang.includes('english') && userLang.includes('english')) ||
                       (detectedLang.includes('spanish') && userLang.includes('spanish')) ||
                       (detectedLang.includes('french') && userLang.includes('french')) ||
                       (detectedLang.includes('german') && userLang.includes('german')) ||
                       (confidence > 0.8 && detectedLang.includes(userLang.substring(0, 4)));
        
        // Cache the result with size management
        if (languageDetectionCache.current.size > 100) {
          // Clear oldest entries if cache gets too large
          const entries = Array.from(languageDetectionCache.current.entries());
          entries.slice(0, 50).forEach(([key]) => languageDetectionCache.current.delete(key));
        }
        languageDetectionCache.current.set(cacheKey, isMatch);
        console.log(`🔍 API detection result (cached): ${isMatch ? 'SAME LANGUAGE' : 'DIFFERENT LANGUAGE'}`);
        return isMatch;
      }
      return false;
    } catch (error) {
      console.error('❌ Language detection failed:', error);
      return false;
    }
  }, [fastLanguageHeuristic]);

  // Analyze messages to determine which need translation UI
  useEffect(() => {
    if (!messages.length || !userLanguagePreference) return;
    
    const analyzeMessages = async () => {
      const analysisStartTime = Date.now();
      const targetLanguage = userLanguagePreference || 'English';
      const newMessagesNeedingTranslation = new Set();
      
      // Check incoming messages (not from current user, not AI)
      const incomingMessages = messages.filter(msg => 
        msg.senderId !== user?.uid && 
        msg.type !== 'ai' && 
        msg.text && 
        msg.text.trim().length > 0
      );
      
      // Batch language detection for efficiency
      const detectionPromises = incomingMessages.map(async (message) => {
        const isSameLanguage = await isMessageInUserLanguage(message.text, targetLanguage);
        return { messageId: message.id, needsTranslation: !isSameLanguage };
      });
      
      const results = await Promise.all(detectionPromises);
      
      results.forEach(result => {
        if (result.needsTranslation) {
          newMessagesNeedingTranslation.add(result.messageId);
        }
      });
      
      const analysisEndTime = Date.now();
      console.log(`🔍 OPTIMIZED Language analysis complete: ${newMessagesNeedingTranslation.size} out of ${incomingMessages.length} messages need translation UI (${analysisEndTime - analysisStartTime}ms)`);
      setMessagesNeedingTranslation(newMessagesNeedingTranslation);
    };
    
    // OPTIMIZED: Reduced debounce time for faster response
    const timeoutId = setTimeout(analyzeMessages, 300);
    return () => clearTimeout(timeoutId);
  }, [messages, userLanguagePreference, user?.uid, isMessageInUserLanguage]);

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

  // OPTIMIZATION: Preload translations into memory cache when chat loads
  useEffect(() => {
    if (chatId && messages.length > 5) { // Wait for some messages to load
      // Preload in background - this makes toggle instant even on first press
      const preloadTranslations = async () => {
        try {
          console.log('🚀 Preloading translations for instant toggle...');
          await loadCachedTranslationsOnly();
        } catch (error) {
          console.log('⚠️ Preload failed, will load on demand:', error.message);
        }
      };
      
      // Small delay to let messages settle
      const timer = setTimeout(preloadTranslations, 1000);
      return () => clearTimeout(timer);
    }
  }, [chatId, messages.length, loadCachedTranslationsOnly]);

  // OPTIMIZED: Ultra-fast cache loading with in-memory cache
  const loadCachedTranslationsOnly = useCallback(async () => {
    if (!chatId) return null;
    
    try {
      // Check in-memory cache first (instant)
      if (translationMemoryCache.current && translationMemoryCache.current.chatId === chatId) {
        console.log(`⚡ Using in-memory cache: ${Object.keys(translationMemoryCache.current.translations).length} translations`);
        setMessageTranslations(translationMemoryCache.current.translations);
        return translationMemoryCache.current.translations;
      }
      
      console.log('💾 Loading from AsyncStorage cache for chat:', chatId);
      const cachedData = await OfflineCache.getCachedMessagesWithTranslations(chatId);
      
      if (cachedData && Object.keys(cachedData.translations).length > 0) {
        console.log(`🚀 Loaded ${Object.keys(cachedData.translations).length} cached translations from storage`);
        
        // Store in memory cache for next time
        translationMemoryCache.current = {
          chatId,
          translations: cachedData.translations,
          loadedAt: Date.now()
        };
        
        setMessageTranslations(cachedData.translations);
        return cachedData.translations;
      } else {
        console.log('📭 No cached translations available');
        return null;
      }
    } catch (error) {
      console.error('❌ Failed to load cached translations:', error);
      return null;
    }
  }, [chatId]);

  // Auto-restore translations when toggle is enabled and messages are loaded
  useEffect(() => {
    if (!translateAllEnabled || !messages.length || !chatId || !user?.uid) return;
    
    // Check if translations are already applied (to avoid re-applying on every message change)
    const hasExistingTranslations = Object.keys(messageTranslations).length > 0;
    
    if (!hasExistingTranslations) {
      console.log('🔄 Auto-restoring translations for enabled toggle with', messages.length, 'messages');
      
      // Try cache first - this is instant if available
      setTranslationLoadingState('checking-cache');
      loadCachedTranslationsOnly().then((cachedTranslations) => {
        setTranslationLoadingState(null);
        if (!cachedTranslations) {
          // Only regenerate if no cache available - this prevents the slow loading issue
          console.log('⚠️ No cache available, will regenerate on next toggle or manual action');
          // Instead of auto-generating, we'll let the user know and regenerate when they interact
          setProcessingTranslations(false); // Ensure we're not stuck in loading state
        }
      });
    }
  }, [translateAllEnabled, messages.length, chatId, user?.uid, messageTranslations, loadCachedTranslationsOnly]);

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
  

  
  // OPTIMIZED: Handle translate all toggle with cache-first approach
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
      // When enabled, try cache first for instant loading
      console.log('🚀 Starting translate all mode - checking cache first');
      setTranslationLoadingState('checking-cache');
      setProcessingTranslations(true);
      
      try {
        // OPTIMIZATION: Check cache first for instant results
        const cachedTranslations = await loadCachedTranslationsOnly();
        
        if (cachedTranslations && Object.keys(cachedTranslations).length > 0) {
          console.log(`⚡ Using ${Object.keys(cachedTranslations).length} cached translations - instant loading!`);
          setTranslationLoadingState(null);
          setProcessingTranslations(false);
          return; // Cache hit - we're done!
        }
        
        // No cache available - need to generate translations
        console.log('📭 No cache available, generating translations...');
        setTranslationLoadingState('generating');
        const toggleStartTime = Date.now();
        // Get last 30 incoming messages (not from current user)
        const incomingMessages = messages
          .filter(msg => msg.senderId !== user?.uid && msg.type !== 'ai' && msg.text && msg.text.trim().length > 0)
          .slice(-30); // Last 30 incoming messages
        
        console.log(`📝 Found ${incomingMessages.length} incoming messages to check for translation`);
        
        if (incomingMessages.length === 0) {
          console.log('⏭️ No messages to translate, finishing');
          setTranslationLoadingState(null);
          setProcessingTranslations(false);
          return;
        }
        
        const targetLanguage = userLanguagePreference || 'English';
        
        // OPTIMIZED: Filter messages in parallel for better performance
        const languageCheckPromises = incomingMessages.map(async (message) => {
          const isSameLanguage = await isMessageInUserLanguage(message.text, targetLanguage);
          return { message, needsTranslation: !isSameLanguage };
        });
        
        const languageResults = await Promise.all(languageCheckPromises);
        const messagesToTranslate = languageResults
          .filter(result => {
            if (!result.needsTranslation) {
              console.log(`⏭️ Skipping message already in ${targetLanguage}:`, result.message.text.substring(0, 50) + '...');
            }
            return result.needsTranslation;
          })
          .map(result => result.message);
        
        console.log(`🌐 ${messagesToTranslate.length} out of ${incomingMessages.length} messages need translation`);
        
        if (messagesToTranslate.length === 0) {
          console.log('⏭️ No messages need translation, finishing');
          setTranslationLoadingState(null);
          setProcessingTranslations(false);
          return;
        }
        
        const translationPromises = messagesToTranslate.map(async (message) => {
          try {
            // Dynamic import for better bundle splitting
            const { translateText } = await import('../utils/aiService');
            const translationResult = await translateText({
              text: message.text,
              targetLanguage: targetLanguage,
              formality: 'casual',
              culturalContext: {
                chatContext: 'message-replacement',
                userLocation: user?.location
              }
            });
            
            if (translationResult.success) {
              return {
                messageId: message.id,
                translation: translationResult.translation,
                originalText: message.text,
                culturalNotes: translationResult.culturalNotes || [],
                detectedLanguage: translationResult.detectedLanguage,
                isShowingOriginal: false // Initially show translation
              };
            }
            return null;
          } catch (error) {
            console.error(`❌ Failed to translate message ${message.id}:`, error);
            return null;
          }
        });
        
        const translationResults = (await Promise.all(translationPromises)).filter(Boolean);
        
        // Update messageTranslations state to replace message content
        const newTranslations = {};
        translationResults.forEach(result => {
          newTranslations[result.messageId] = result;
        });
        
        setMessageTranslations(prev => {
          const updatedTranslations = {
            ...prev,
          ...newTranslations
          };
          
          // Cache translations for offline use (background task)
          if (chatId && messages.length > 0) {
            setTimeout(async () => {
              try {
                await OfflineCache.cacheMessagesWithTranslations(chatId, messages, updatedTranslations);
                console.log('💾 Cached updated translations for offline use');
              } catch (error) {
                console.error('❌ Failed to cache translations:', error);
              }
            }, 100);
          }
          
          return updatedTranslations;
        });
        
        const toggleEndTime = Date.now();
        console.log(`✅ OPTIMIZED: Replaced content for ${translationResults.length} messages with translations in ${toggleEndTime - toggleStartTime}ms`);
        
      } catch (error) {
        console.error('❌ Failed to process message replacements:', error);
      } finally {
        setTranslationLoadingState(null);
        setProcessingTranslations(false);
      }
    } else {
      // When disabled, clear all message replacements (show originals)
      console.log('🔄 Disabled translate all mode - reverting to original messages');
      setMessageTranslations({});
      setTranslationLoadingState(null);
      setProcessingTranslations(false);
    }
  }, [chatId, messages, user?.uid, userLanguagePreference, isMessageInUserLanguage, loadCachedTranslationsOnly]);

  // Enhanced auto translation for new messages with caching (unused now - AI Assistant auto-translate removed)
  const handleAutoTranslateNewMessages = useCallback(async (newMessages) => {
    return; // Disabled - auto-translate functionality removed from AI Assistant

    console.log('🔄 Auto-translating', newMessages.length, 'new messages');

    for (const message of newMessages) {
      try {
        // Skip if already processed or is from current user/AI
        if (processedMessageIds.current.has(message.id) || 
            message.senderId === user?.uid || 
            message.type === 'ai' || 
            !message.text) {
          continue;
        }

        // Mark as processed to avoid duplicate processing
        processedMessageIds.current.add(message.id);

        // Check cache first for performance
        const cachedTranslation = null; // Disabled - autoTranslateSettings removed

        let translationResult;

        if (cachedTranslation) {
          console.log('🚀 Using cached translation for message:', message.id);
          translationResult = cachedTranslation;
        } else {
          // Generate new translation
          console.log('🌐 Generating new auto translation for message:', message.id);
          const { translateText } = await import('../utils/aiService');
          
          translationResult = null; // Disabled - autoTranslateSettings removed

          // Cache the result for future use
          if (translationResult.success) {
            await cacheTranslation(message.text, translationResult);
          }
        }

        if (translationResult.success) {
          // Replace message content in UI (same approach as translate all toggle)
          setMessageTranslations(prev => {
            const updatedTranslations = {
            ...prev,
            [message.id]: {
              translation: translationResult.translation,
              originalText: message.text,
              isShowingOriginal: false,
              culturalNotes: translationResult.culturalNotes || [],
              confidence: translationResult.confidence || 0.95,
              autoTranslated: true
            }
            };
            
            // Cache updated translations for offline use (background task)
            if (chatId && messages.length > 0) {
              setTimeout(async () => {
                try {
                  await OfflineCache.cacheMessagesWithTranslations(chatId, messages, updatedTranslations);
                } catch (error) {
                  console.error('❌ Failed to cache auto-translation:', error);
                }
              }, 100);
            }
            
            return updatedTranslations;
          });

          console.log('✅ Auto translation applied to message:', message.id);
        }
      } catch (error) {
        console.error('❌ Auto translation failed for message:', message.id, error);
      }
    }
  }, [user?.uid]);

  // Preload auto translations for existing messages when auto translation is enabled
  const preloadAutoTranslations = useCallback(async (settings) => {
    if (!settings.enabled || !messages.length) return;

    console.log('🔄 Preloading auto translations for', messages.length, 'existing messages');

    // Filter messages that need translation (incoming messages not from current user)
    const messagesNeedingTranslation = messages.filter(msg => 
      msg.type !== 'ai' && 
      msg.senderId !== user?.uid &&
      msg.text &&
      msg.text.trim().length > 0 &&
      !processedMessageIds.current.has(msg.id)
    );

    if (messagesNeedingTranslation.length === 0) {
      console.log('✅ No messages need preloading');
      return;
    }

    console.log('📥 Preloading translations for', messagesNeedingTranslation.length, 'messages');
    
    // Process in small batches to avoid overwhelming the system
    const BATCH_SIZE = 3;
    const translationUpdates = {};

    for (let i = 0; i < messagesNeedingTranslation.length; i += BATCH_SIZE) {
      const batch = messagesNeedingTranslation.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (message) => {
        try {
          // Mark as processed
          processedMessageIds.current.add(message.id);

          // Check cache first
          const cachedTranslation = null; // Disabled - autoTranslateSettings removed

          let translationResult;

          if (cachedTranslation) {
            console.log('🚀 Using cached preload translation for:', message.id);
            translationResult = cachedTranslation;
          } else {
            // Generate new translation
            console.log('🌐 Generating preload translation for:', message.id);
            const { translateText } = await import('../utils/aiService');
            
            translationResult = await translateText({
              text: message.text,
              targetLanguage: settings.targetLanguage,
              formality: settings.formality,
              culturalContext: {
                chatContext: 'preload-auto-translation',
                messageId: message.id,
                userLocation: user?.location
              }
            });

            // Cache the result
            if (translationResult.success) {
              await cacheTranslation(message.text, translationResult);
            }
          }

          if (translationResult.success) {
            translationUpdates[message.id] = {
              translation: translationResult.translation,
              originalText: message.text,
              isShowingOriginal: false,
              culturalNotes: translationResult.culturalNotes || [],
              confidence: translationResult.confidence || 0.95,
              autoTranslated: true,
              preloaded: true
            };
          }
        } catch (error) {
          console.error('❌ Preload translation failed for message:', message.id, error);
        }
      });

      await Promise.all(batchPromises);

      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < messagesNeedingTranslation.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Apply all translations at once for better performance
    if (Object.keys(translationUpdates).length > 0) {
      setMessageTranslations(prev => {
        const updatedTranslations = {
        ...prev,
        ...translationUpdates
        };
        
        // Cache preloaded translations for offline use (background task)
        if (chatId && messages.length > 0) {
          setTimeout(async () => {
            try {
              await OfflineCache.cacheMessagesWithTranslations(chatId, messages, updatedTranslations);
              console.log('💾 Cached preloaded translations for offline use');
            } catch (error) {
              console.error('❌ Failed to cache preloaded translations:', error);
            }
          }, 100);
        }
        
        return updatedTranslations;
      });
      
      console.log('✅ Preloaded', Object.keys(translationUpdates).length, 'auto translations');
    }
  }, [messages, user?.uid]);

  // Auto-translate new incoming messages when translate all is enabled - NEW: Replace content
  const handleAutoTranslateNewMessage = useCallback(async (message) => {
    console.log('🔄 handleAutoTranslateNewMessage called for message:', message.id, message.text.substring(0, 50));
    
    // Only auto-translate if translate all toggle is enabled
    if (!translateAllEnabled) {
      console.log('❌ Auto-translate disabled, skipping message:', message.id);
      return;
    }
    
    // Skip if message is from current user, AI, or already processed
    if (message.senderId === user?.uid || 
        message.type === 'ai' || 
        processedMessageIds.current.has(message.id)) {
      console.log('⏭️ Skipping message - from user/AI/already processed:', message.id);
      return;
    }
    
    // Skip if message doesn't have text
    if (!message.text || message.text.trim() === '') {
      console.log('⏭️ Skipping message - no text:', message.id);
      return;
    }
    
    const targetLanguage = userLanguagePreference || 'English';
    
    // Check if message is already in user's native language
    const isSameLanguage = await isMessageInUserLanguage(message.text, targetLanguage);
    if (isSameLanguage) {
      console.log(`⏭️ Skipping auto-translation - message already in ${targetLanguage}:`, message.text.substring(0, 50) + '...');
      processedMessageIds.current.add(message.id); // Mark as processed to avoid re-checking
      return;
    }
    
    try {
      console.log('🔄 Auto-translating new message for replacement:', message.text.substring(0, 100));
      
      // Mark as processed to avoid duplicate translations
      processedMessageIds.current.add(message.id);
      
      // Dynamic import for better bundle splitting
      const { translateText } = await import('../utils/aiService');
      const translationResult = await translateText({
        text: message.text,
        targetLanguage: targetLanguage,
        formality: 'casual',
        culturalContext: {
          chatContext: 'auto-message-replacement',
          userLocation: user?.location
        }
      });
      
      if (translationResult.success) {
        console.log('✅ Auto-translation successful for message:', message.id, 'translation:', translationResult.translation.substring(0, 100));
        // Replace message content by updating messageTranslations state
        setMessageTranslations(prev => {
          const updatedTranslations = {
          ...prev,
          [message.id]: {
            messageId: message.id,
            translation: translationResult.translation,
            originalText: message.text,
            culturalNotes: translationResult.culturalNotes || [],
            detectedLanguage: translationResult.detectedLanguage,
            isShowingOriginal: false // Show translation by default
          }
          };
          
          // Cache new auto-translation for offline use (background task)
          if (chatId && messages.length > 0) {
            setTimeout(async () => {
              try {
                await OfflineCache.cacheMessagesWithTranslations(chatId, messages, updatedTranslations);
              } catch (error) {
                console.error('❌ Failed to cache new auto-translation:', error);
              }
            }, 100);
          }
          
          return updatedTranslations;
        });
        
        console.log('✅ Auto-replaced message content with translation:', message.id);
      } else {
        console.log('❌ Translation failed, message will show original content');
      }
    } catch (error) {
      console.error('❌ Auto-translation failed:', error);
      // Don't show error to user, message will appear in original language
    }
  }, [translateAllEnabled, user?.uid, userLanguagePreference, isMessageInUserLanguage]);
  
  // Keep the old auto-translate function for the AI assistant auto-translate feature
  const handleAutoTranslateMessage = useCallback(async (message) => {
    // Auto-translate functionality removed from AI Assistant
    return;
    
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
        // Disabled - autoTranslateSettings removed
        culturalContext: {
          chatContext: 'auto-translation',
          userLocation: user?.location
        }
      });
      
      if (translationResult.success) {
        // Create auto-translation message display
        let translationDisplay = `🔄 **Auto-Translation** (Disabled):\n\n${translationResult.translation}`;
        
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
            // Disabled - autoTranslateSettings removed
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
  }, [user, chatId]); // Dependencies: only re-create when these values change
  
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
        
        // SIMPLIFIED: Always enable translations - users can speak any language!
        // Each message will be individually checked against user's language preference
        const targetLanguage = userLanguagePreference || 'English';
        console.log('🌍 User language preference:', targetLanguage);
        console.log('✅ Translation enabled for all foreign messages');
        
        setTranslationRecommendation({ 
          shouldShow: true, 
          userLanguage: targetLanguage, 
          targetLanguage,
          chatLanguage: 'Mixed', // No single chat language - users speak freely!
          reason: 'International communication - translate all foreign messages'
        });
        setUserLanguage(targetLanguage);
        
        if (false) { // Disable old complex logic
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
  
  // NEW: Handle message click to toggle between translated and original content
  const handleMessageClick = useCallback((messageId) => {
    const translationData = messageTranslations[messageId];
    if (!translationData) return; // No translation available
    
    console.log('🔄 Toggling message view for:', messageId, 'currently showing original:', translationData.isShowingOriginal);
    
    // Toggle between showing translation and original
    setMessageTranslations(prev => {
      const updatedTranslations = {
      ...prev,
      [messageId]: {
        ...prev[messageId],
        isShowingOriginal: !prev[messageId].isShowingOriginal
      }
      };
      
      // Cache toggle state for offline use (background task, lower priority)
      if (chatId && messages.length > 0) {
        setTimeout(async () => {
          try {
            await OfflineCache.cacheMessagesWithTranslations(chatId, messages, updatedTranslations);
          } catch (error) {
            console.error('❌ Failed to cache translation toggle state:', error);
          }
        }, 200); // Slightly longer delay for toggle state
      }
      
      return updatedTranslations;
    });
  }, [messageTranslations]);
  
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
    
    // Load cached messages first (especially when offline)
    const loadCachedMessages = async () => {
      if (isOffline) {
        console.log('📱 Offline detected - loading cached messages');
        const cachedData = await OfflineCache.getCachedMessagesWithTranslations(chatId);
        
        if (cachedData) {
          console.log(`📦 Using ${cachedData.messages.length} cached messages with ${Object.keys(cachedData.translations).length} translations`);
          setMessages(cachedData.messages);
          setMessageTranslations(cachedData.translations);
          setUsingCachedMessages(true);
          setCachedMessageCount(cachedData.messages.length);
          setLoading(false);
          setTimeout(() => scrollToBottom(), 100);
          return;
        } else {
          console.log('📭 No cached messages available for offline use');
          setUsingCachedMessages(false);
          setCachedMessageCount(0);
        }
      } else {
        // Reset cache indicators when online
        setUsingCachedMessages(false);
        setCachedMessageCount(0);
      }
    };

    // Load cached messages first if offline
    loadCachedMessages();
    
    const unsubscribe = subscriptionManager.subscribe(
      `messages-${chatId}`,
      (callback) => subscribeToMessages(chatId, callback, 50), // Limit to 50 messages
      async (msgs) => {
        console.log('📨 Received messages:', msgs.length);
        
        // If we had cached messages and now have fresh messages, merge them intelligently
        const currentMessages = messages.length > 0 ? messages : [];
        const mergedData = OfflineCache.mergeCachedWithFresh(msgs, currentMessages, messageTranslations);
        
        setMessages(mergedData.messages);
        setLoading(false);
        setTimeout(() => scrollToBottom(), 100);
        
        // Clear cache indicators when fresh messages are received
        if (msgs.length > 0 && !isOffline) {
          setUsingCachedMessages(false);
          setCachedMessageCount(0);
          console.log('💾 Caching fresh messages and translations for offline use');
          await OfflineCache.cacheMessagesWithTranslations(chatId, msgs, messageTranslations);
        }
        
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

        // Process new messages for structured data extraction (background)
        if (msgs.length > 0 && user?.uid) {
          // Get most recent messages to check for new ones
          const recentMessages = msgs.slice(0, 5); // Check last 5 messages for new insights
          for (const message of recentMessages) {
            // Find sender profile for context
            const senderProfile = users.find(u => u.id === message.senderId) || {};
            // Process in background (non-blocking)
            processMessageForInsights(message, chatId, user.uid, senderProfile);
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
  }, [chatId, user?.uid, isOffline]); // Add isOffline to dependencies

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

  // Handle new message auto-translation for translate all toggle
  useEffect(() => {
    if (!translateAllEnabled || !messages.length) {
      console.log('🔄 Auto-translate useEffect early return - translateAllEnabled:', translateAllEnabled, 'messages.length:', messages.length);
      return;
    }
    
    // Find new messages that haven't been processed for auto-translation
    const currentMessageIds = new Set(processedMessageIds.current);
    const newMessages = messages.filter(msg => 
      !currentMessageIds.has(msg.id) && 
      msg.senderId !== user?.uid &&
      msg.type !== 'ai' &&
      msg.text && 
      msg.text.trim() !== ''
    );
    
    console.log('🔄 Auto-translate check - total messages:', messages.length, 'new messages:', newMessages.length, 'processed IDs:', processedMessageIds.current.size);
    
    // Process each new message based on which mode is enabled
    if (newMessages.length > 0) {
        console.log(`🔄 Processing ${newMessages.length} new messages for content replacement`);
        newMessages.forEach(message => {
          processedMessageIds.current.add(message.id);
        console.log('🚀 Triggering auto-translate for message:', message.id, message.text.substring(0, 50));
          // Use delay to ensure the message is saved first
          setTimeout(() => handleAutoTranslateNewMessage(message), 1000);
        });
    } else {
      console.log('📝 No new messages to auto-translate');
    }
  }, [messages, translateAllEnabled, handleAutoTranslateNewMessage, user?.uid]);

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

  // Handle navigation to source message from conversation insights
  const handleNavigateToMessage = useCallback((messageId) => {
    // Find the message in our current messages array
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    
    if (messageIndex !== -1 && flatListRef.current) {
      // Scroll to the message (using reverse indexing since messages are reversed in FlatList)
      const scrollIndex = messages.length - 1 - messageIndex;
      
      try {
        flatListRef.current.scrollToIndex({
          index: scrollIndex,
          animated: true,
          viewPosition: 0.5 // Center the message on screen
        });
        
        console.log('📍 Navigated to message:', messageId, 'at index:', scrollIndex);
      } catch (error) {
        console.error('❌ Error scrolling to message:', error);
        // Fallback: scroll to end and let user find it manually
        flatListRef.current.scrollToEnd({ animated: true });
      }
    } else {
      console.log('❌ Message not found or FlatList ref not available:', messageId);
    }
  }, [messages]);

  // Audio playback management
  const handleAudioPlayStateChange = useCallback(async (isPlaying, audioId) => {
    try {
      if (isPlaying) {
        // Stop any currently playing audio
        if (playingAudioId && playingAudioId !== audioId) {
          const currentAudio = audioObjects.get(playingAudioId);
          if (currentAudio) {
            await currentAudio.pauseAsync();
          }
        }
        setPlayingAudioId(audioId);
      } else {
        setPlayingAudioId(null);
      }
    } catch (error) {
      console.error('Error managing audio playback:', error);
    }
  }, [playingAudioId, audioObjects]);

  // Cleanup audio objects when component unmounts
  useEffect(() => {
    return () => {
      // Cleanup all audio objects
      audioObjects.forEach(async (audio) => {
        try {
          await audio.unloadAsync();
        } catch (error) {
          console.error('Error unloading audio:', error);
        }
      });
      setAudioObjects(new Map());
    };
  }, []);

  // Handle voice message selection from menu
  const handleVoiceMessageSelected = () => {
    setShowVoiceRecorder(true);
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

    // Render audio messages
    if (item.type === 'audio' && item.audio) {
      return (
        <View
          style={[
            styles.messageContainer,
            isMyMessage ? styles.myMessageContainer : styles.theirMessageContainer,
          ]}
        >
          <AudioMessageBubble
            audioUri={item.audio.url}
            duration={item.audio.duration * 1000} // Convert to milliseconds
            isOwn={isMyMessage}
            timestamp={formatTime(item.timestamp)}
            senderName={isMyMessage ? null : senderName}
            onPlayStateChange={handleAudioPlayStateChange}
            isPlaying={playingAudioId === item.audio.url}
          />
          <Text style={styles.readIndicator}>{readIndicator}</Text>
        </View>
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
                <ActivityIndicator size="small" color="#CD853F" />
                <Text style={styles.sendingText}>Sending photo...</Text>
              </View>
            )}
          </View>
        </View>
      );
    }

    // NEW: Check if this message has translation data
    const translationData = messageTranslations[item.id];
    const isTranslated = translationData && !translationData.isShowingOriginal;
    const isShowingOriginal = translationData && translationData.isShowingOriginal;
    
    // Determine what text to show
    const displayText = isTranslated ? translationData.translation : item.text;

    // Render text messages
    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessageContainer : styles.theirMessageContainer,
        ]}
      >
        <TouchableOpacity
          style={[
            styles.messageBubble,
            isMyMessage ? styles.myMessageBubble : styles.theirMessageBubble,
            item.sending && styles.sendingMessage,
            // NEW: Add blue border if message is translated
            isTranslated && styles.translatedMessageBubble,
          ]}
          onPress={() => translationData ? handleMessageClick(item.id) : undefined}
          disabled={!translationData}
          activeOpacity={translationData ? 0.7 : 1}
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
            {displayText}
          </Text>
          
          {/* Show old translation system when viewing original of a translated message */}
          {isShowingOriginal && translationData && (
            <InlineTranslation
              messageId={item.id}
              messageText={translationData.originalText} // Use the stored original text
              userLanguage={userLanguage}
              chatLanguage={translationData.detectedLanguage || 'Unknown'} // Use detected language from translation
              chatId={chatId}
              preGeneratedTranslations={{ [item.id]: { translation: translationData.translation, culturalNotes: translationData.culturalNotes } }}
              translationState={null} // Don't force state - let component manage its own progression
              onToggle={handleTranslationToggle}
              translateAllEnabled={false}
              autoExpand={true} // Auto-expand to show translation first, then allow cultural context
            />
          )}
          
          {/* Show old inline translation system for non-translated messages when toggle is off */}
          {!translationData && !isMyMessage && 
           (translationRecommendation?.shouldShow && !translateAllEnabled) && 
           item.text && 
           item.text.trim().length > 0 && 
           messagesNeedingTranslation.has(item.id) && ( // NEW: Only show if message needs translation
            <InlineTranslation
              messageId={item.id}
              messageText={item.text} // This is always original text since !translationData
              userLanguage={userLanguage}
              chatLanguage={'Mixed'} // No single chat language - users speak any language!
              chatId={chatId}
              preGeneratedTranslations={preGeneratedTranslations}
              translationState={translationStates[item.id]}
              onToggle={handleTranslationToggle}
              translateAllEnabled={translateAllEnabled}
              autoExpand={translateAllEnabled}
            />
          )}
          
          {/* Translation button removed for messages already showing translations - user can tap message bubble to toggle */}
          
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
        </TouchableOpacity>
        {/* Translation button now moved inside message bubble above */}
      </View>
    );
  }, [user?.uid, getDisplayName, chatMembers, formatTime, messageTranslations, handleMessageClick, userLanguage, translationRecommendation, chatId, preGeneratedTranslations, translationStates, handleTranslationToggle, translateAllEnabled, messagesNeedingTranslation, playingAudioId, handleAudioPlayStateChange]); // Dependencies for renderMessage

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
          {(processingTranslations || translationLoadingState) && (
            <Text style={styles.processingText}>
              {translationLoadingState === 'checking-cache' ? '⚡ Loading translations...' :
               translationLoadingState === 'generating' ? '🌐 Generating translations...' :
               processingTranslations ? (t('processingTranslations') || 'Processing translations...') : ''}
            </Text>
          )}
          {!processingTranslations && !translationLoadingState && chatPresenceText && (
            <Text style={styles.presenceText}>{chatPresenceText}</Text>
          )}
        </TouchableOpacity>
        <View style={styles.headerSide}>
          {/* Show members button for group chats (3+ members) */}
          {chatMembers && chatMembers.length >= 3 ? (
            <View style={styles.headerRightGroup}>
              <TouchableOpacity
                style={styles.membersButton}
                onPress={() => setShowMemberList(true)}
              >
                <Text style={styles.membersButtonText}>👥</Text>
                <Text style={styles.membersButtonCount}>{chatMembers.length}</Text>
              </TouchableOpacity>
          <View style={styles.translateToggleContainer}>
            <Text style={styles.translateToggleLabel}>🌐</Text>
            <Switch
              value={translateAllEnabled}
              onValueChange={handleTranslateAllToggle}
              trackColor={{ false: '#e0e0e0', true: '#CD853F' }}
              thumbColor={translateAllEnabled ? '#fff' : '#f4f3f4'}
              ios_backgroundColor="#e0e0e0"
              style={styles.translateToggle}
              testID="translate-all-toggle"
            />
          </View>
            </View>
          ) : (
            <View style={styles.translateToggleContainer}>
              <Text style={styles.translateToggleLabel}>🌐</Text>
              <Switch
                value={translateAllEnabled}
                onValueChange={handleTranslateAllToggle}
                trackColor={{ false: '#e0e0e0', true: '#CD853F' }}
                thumbColor={translateAllEnabled ? '#fff' : '#f4f3f4'}
                ios_backgroundColor="#e0e0e0"
                style={styles.translateToggle}
                testID="translate-all-toggle"
              />
            </View>
          )}
        </View>
      </View>

      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            {usingCachedMessages 
              ? `${t('offline')} - Showing ${cachedMessageCount} cached messages`
              : t('offline')
            }
          </Text>
        </View>
      )}
      

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 44 : 90}
      >
        {loading ? (
          <ActivityIndicator size="large" color="#CD853F" style={styles.loader} />
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
                onVoiceMessageSelected={handleVoiceMessageSelected}
                disabled={sendingPhoto || isOffline}
                chatId={chatId}
                messages={messages}
                userProfiles={userProfiles}
                currentUser={user}
                smartTextData={smartTextData}
                languageDetected={languageDetection.detected}
                onSmartTextPress={() => setSmartAssistantVisible(true)}
                onNavigateToMessage={handleNavigateToMessage}
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
        
        {/* Voice Message Recorder Modal */}
        <SimpleVoiceRecorder
          visible={showVoiceRecorder}
          onClose={() => setShowVoiceRecorder(false)}
          chatId={chatId}
          currentUser={user}
          onSendComplete={(messageId, audioData) => {
            console.log('Voice message sent:', messageId);
            // Optional: Add success feedback
          }}
        />

        {/* Smart Text Assistant Modal */}
        <SmartTextAssistant
          visible={smartAssistantVisible}
          onClose={() => setSmartAssistantVisible(false)}
          textData={smartTextData}
          onTextUpdate={handleSmartTextUpdate}
        />

        {/* Group Member List Modal */}
        <GroupMemberList
          visible={showMemberList}
          onClose={() => setShowMemberList(false)}
          chatMembers={chatMembers}
          userProfiles={userProfiles}
          presenceData={presenceData}
          currentUserId={user?.uid}
          chatTitle={chatTitle}
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
  processingText: {
    fontSize: 12,
    color: '#CD853F',
    marginTop: 2,
    fontStyle: 'italic',
  },
  headerSide: {
    width: 72,
  },
  headerTitleWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  membersButton: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    minWidth: 32,
  },
  membersButtonText: {
    fontSize: 16,
  },
  membersButtonCount: {
    fontSize: 10,
    color: '#CD853F',
    fontWeight: '600',
    marginTop: -2,
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
    color: '#CD853F',
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
    backgroundColor: '#CD853F',
    borderBottomRightRadius: 4,
  },
  theirMessageBubble: {
    backgroundColor: '#E5E5EA',
    borderBottomLeftRadius: 4,
  },
  translatedMessageBubble: {
    borderWidth: 2,
    borderColor: '#CD853F',
    backgroundColor: '#F0F8FF', // Light blue background
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
    backgroundColor: '#CD853F',
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
    color: '#CD853F',
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
    color: '#CD853F',
    fontSize: 12,
    fontWeight: '500',
  },
});
