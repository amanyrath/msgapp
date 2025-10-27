import * as Localization from 'expo-localization';
import { translateText } from './aiService';
import subscriptionManager from './subscriptionManager';

/**
 * Localization Service - System language detection and UI translation
 * Uses static locale files for supported languages, falls back to OpenAI for others
 */

// Static locale imports for fast loading
import enLocale from '../locales/en.json';
import esLocale from '../locales/es.json';
import jaLocale from '../locales/ja.json';
import kmLocale from '../locales/km.json';
import loLocale from '../locales/lo.json';

// Cache for translated strings to avoid API calls for repeated text
const translationCache = new Map();
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

// Static locale mapping for instant loading
const STATIC_LOCALES = {
  'English': enLocale,
  'Spanish': esLocale,
  'Japanese': jaLocale,
  'Khmer': kmLocale,
  'Lao': loLocale
};

// Supported static locale languages
const SUPPORTED_STATIC_LANGUAGES = ['English', 'Spanish', 'Japanese', 'Khmer', 'Lao'];

/**
 * Get the user's system language
 * @returns {string} Language code (e.g., 'en-US', 'es-ES', 'fr-FR')
 */
export function getSystemLanguage() {
  try {
    // Get the first preferred locale from the system
    const locale = Localization.locale || Localization.locales?.[0] || 'en-US';
    console.log('Detected system locale:', locale);
    return locale;
  } catch (error) {
    console.warn('Failed to detect system language, falling back to English:', error);
    return 'en-US';
  }
}

/**
 * Get language name from locale code
 * @param {string} locale - Locale code (e.g., 'en-US')
 * @returns {string} Language name (e.g., 'English')
 */
export function getLanguageName(locale = getSystemLanguage()) {
  const languageMap = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh': 'Chinese',
    'ar': 'Arabic',
    'hi': 'Hindi',
    'nl': 'Dutch',
    'sv': 'Swedish',
    'da': 'Danish',
    'no': 'Norwegian',
    'fi': 'Finnish',
    'pl': 'Polish',
    'cs': 'Czech',
    'hu': 'Hungarian',
    'tr': 'Turkish',
    'th': 'Thai',
    'vi': 'Vietnamese',
    'km': 'Khmer',
    'lo': 'Lao'
  };

  const languageCode = locale.split('-')[0];
  return languageMap[languageCode] || 'English';
}

/**
 * Check if current system language is English
 * @returns {boolean}
 */
export function isSystemLanguageEnglish() {
  const locale = getSystemLanguage();
  return locale.startsWith('en');
}

/**
 * Create cache key for translation
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - Target language
 * @returns {string}
 */
function createCacheKey(text, targetLanguage) {
  return `${text}|${targetLanguage}`;
}

/**
 * Check if cached translation is still valid
 * @param {object} cachedItem - Cached translation item
 * @returns {boolean}
 */
function isCacheValid(cachedItem) {
  return cachedItem && (Date.now() - cachedItem.timestamp) < CACHE_EXPIRY;
}

/**
 * Get user's preferred language from cached profiles (optimized)
 * @param {string} userId - User ID (optional)
 * @returns {string} User's preferred language or system language
 */
function getCachedUserLanguage(userId = null) {
  if (userId) {
    // Try to get from cached user profiles first
    const cachedProfiles = subscriptionManager.getCachedData('user-profiles');
    if (cachedProfiles) {
      const userProfile = cachedProfiles.find(profile => profile.id === userId);
      if (userProfile?.languagePreference) {
        return userProfile.languagePreference;
      }
    }
  }
  
  // Fallback to system language detection
  return getLanguageName(getSystemLanguage());
}

/**
 * Check if a language has static locale support
 * @param {string} language - Language name (e.g., 'Spanish', 'Japanese')
 * @returns {boolean}
 */
export function hasStaticLocaleSupport(language) {
  return SUPPORTED_STATIC_LANGUAGES.includes(language);
}

/**
 * Load static locale for a language
 * @param {string} language - Language name (e.g., 'Spanish', 'Japanese')
 * @returns {object|null} Static locale object or null if not supported
 */
export function loadStaticLocale(language) {
  if (hasStaticLocaleSupport(language)) {
    return STATIC_LOCALES[language];
  }
  return null;
}

/**
 * Translate UI text using OpenAI service with caching
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - Target language (optional, uses cached user preference or system language)
 * @param {object} options - Translation options
 * @returns {Promise<string>} Translated text
 */
export async function translateUIText(text, targetLanguage = null, options = {}) {
  try {
    // OPTIMIZED: Use cached user preference, then system language if no target specified
    const finalTargetLanguage = targetLanguage || getCachedUserLanguage(options.userId);
    
    // Return original text if target is English
    if (finalTargetLanguage === 'English') {
      return text;
    }

    // Check cache first
    const cacheKey = createCacheKey(text, finalTargetLanguage);
    const cached = translationCache.get(cacheKey);
    
    if (isCacheValid(cached)) {
      return cached.translation;
    }

    // Translate using OpenAI service
    const result = await translateText({
      text,
      targetLanguage: finalTargetLanguage,
      sourceLanguage: 'English',
      formality: options.formality || 'casual',
      culturalContext: {
        chatContext: 'UI interface translation',
        ...options.culturalContext
      }
    });

    if (result.success && result.translation) {
      // Cache the translation
      translationCache.set(cacheKey, {
        translation: result.translation,
        timestamp: Date.now(),
        confidence: result.confidence
      });

      return result.translation;
    } else {
      console.warn('Translation failed, using original text:', result.error);
      return text;
    }
  } catch (error) {
    console.warn('Translation error, using original text:', error);
    return text;
  }
}

/**
 * Batch translate multiple UI strings using static locales or API fallback
 * @param {object} texts - Object with key-value pairs of texts to translate
 * @param {string} targetLanguage - Target language (optional, uses cached user preference)
 * @param {object} options - Options including userId for cached preference lookup
 * @returns {Promise<object>} Object with translated texts
 */
export async function batchTranslateUITexts(texts, targetLanguage = null, options = {}) {
  // OPTIMIZED: Use cached user preference, then system language if no target specified
  const finalTargetLanguage = targetLanguage || getCachedUserLanguage(options.userId);
  
  if (finalTargetLanguage === 'English') {
    return texts;
  }

  // FAST PATH: Use static locale if available
  const staticLocale = loadStaticLocale(finalTargetLanguage);
  if (staticLocale) {
    console.log(`🚀 Loading ${finalTargetLanguage} UI strings from static locale (instant)`);
    // Return static translations directly - they match the keys in DEFAULT_UI_STRINGS
    return staticLocale;
  }

  // FALLBACK PATH: Use API translation for unsupported languages
  console.log(`🌐 Loading ${finalTargetLanguage} UI strings via API translation`);
  const translatedTexts = {};
  const translationPromises = [];

  for (const [key, text] of Object.entries(texts)) {
    translationPromises.push(
      translateUIText(text, finalTargetLanguage)
        .then(translatedText => {
          translatedTexts[key] = translatedText;
        })
        .catch(() => {
          translatedTexts[key] = text; // Fallback to original
        })
    );
  }

  await Promise.all(translationPromises);
  return translatedTexts;
}

/**
 * Default UI strings in English
 */
export const DEFAULT_UI_STRINGS = {
  // Navigation & Buttons
  back: 'Back',
  send: 'Send',
  done: 'Done',
  cancel: 'Cancel',
  delete: 'Delete',
  edit: 'Edit',
  save: 'Save',
  loading: 'Loading...',
  
  // New Chat Screen
  newChat: 'New Chat',
  startChat: 'Start Chat',
  selectUsers: 'Select Users',
  pleaseSelectAtLeastOnePerson: 'Please choose at least one person to start a chat.',
  mustBeSignedIn: 'You must be signed in to start a chat.',
  failedToCreateChat: 'Failed to create chat: {error}',
  noOtherUsersYet: 'No other users yet',
  inviteTeammates: 'Invite teammates so you can start a conversation.',
  
  // Chat & Messages
  noMessagesYetStartConversation: 'No messages yet. Start the conversation! 💬',

  // Profile Screen  
  profile: 'Profile',
  enterYourNickname: 'Enter your nickname',
  nicknameHint: 'This is how others will see you (max 20 characters)',
  enterEmoji: 'Enter an emoji (e.g., 😊 or 🚀)',
  iconHint: 'Your personal emoji avatar (or tap 🎲 for random)',
  languagePreference: 'Language Preference',
  languagePreferenceHint: 'Choose your preferred language for app interface and AI responses',
  saveChanges: 'Save Changes',
  profileUpdated: 'Profile updated! Your new nickname and icon will be visible immediately.',
  failedToSaveProfile: 'Failed to save profile: {error}',
  areYouSureSignOut: 'Are you sure you want to sign out?',
  signOut: 'Sign Out',

  // Chat Settings Screen
  success: 'Success',
  groupSettings: 'Group Settings',
  groupName: 'Group Name', 
  groupIcon: 'Group Icon',
  enterGroupName: 'Enter group name...',
  notes: 'Notes',
  members: 'Members',
  noMembers: 'No members',
  justYou: 'Just you',
  invalidChatId: 'Invalid chat ID',
  groupNameCannotBeEmpty: 'Group name cannot be empty',
  groupNameTooLong: 'Group name must be 50 characters or less',
  groupIconCannotBeEmpty: 'Group icon cannot be empty',
  iconShouldBeEmoji: 'Icon should be an emoji (max 2 characters)',
  notesTooLong: 'Notes must be 500 characters or less',
  groupSettingsUpdated: 'Group settings updated!',
  failedToUpdateSettings: 'Failed to update settings: {error}',
  
  // Authentication
  login: 'Log In',
  signup: 'Sign Up',
  email: 'Email',
  password: 'Password',
  confirmPassword: 'Confirm Password',
  nickname: 'Nickname',
  welcomeBack: 'Welcome back!',
  createAccount: 'Create your account',
  alreadyHaveAccount: 'Already have an account? Log In',
  dontHaveAccount: "Don't have an account? Sign Up",
  
  // Chat Interface
  typeMessage: 'Type a message...',
  askMeAnything: 'Ask me anything...',
  chats: 'Chats',
  noChatsYet: 'No chats yet.',
  noMessagesYet: 'No messages yet',
  startConversation: 'Start a conversation to see it appear here.',
  offline: 'Offline - Messages will send when reconnected',
  youreOffline: "📵 You're offline",
  
  // AI Assistant
  aiAssistant: 'AI Assistant',
  translate1h: '🕐 Translate 1h',
  translate24h: '📅 Translate 24h',
  explain: '🌍 Explain',
  suggest: '💡 Suggest',
  casual: '😊 Casual',
  formal: '🎩 Formal',
  tips: '🌟 Tips',
  demo: '🎯 Demo',
  
  // Auto-Translation Toggle
  autoTranslate: 'Auto-Translate',
  on: 'ON',
  off: 'OFF',
  language: 'Language',
  tone: 'Tone',
  autoTranslating: 'Auto-translating to',
  
  // Language Selection
  selectLanguage: 'Select Language',
  choosePreferredLanguage: 'Choose your preferred language',
  languageUpdated: 'Language Updated',
  languageChangedTo: 'Language changed to',
  restartForFullEffect: 'The interface has been updated immediately',
  
  // Photo/Media
  takePhoto: '📸 Take Photo',
  choosePhoto: '🖼️ Choose Photo',
  recordVoiceMessage: '🎤 Record Voice Message',
  aiAssistantOption: '🤖 AI Assistant',
  whatWouldYouLikeToDo: 'What would you like to do?',
  chooseAction: 'Choose Action',
  
  // Errors & Validation
  error: 'Error',
  pleaseFillAllFields: 'Please fill in all fields',
  passwordsDoNotMatch: 'Passwords do not match',
  passwordTooShort: 'Password must be at least 6 characters',
  pleaseEnterNickname: 'Please enter a nickname',
  nicknameTooLong: 'Nickname must be 20 characters or less',
  pleaseEnterIcon: 'Please enter an icon (emoji)',
  loginFailed: 'Login Failed',
  signupFailed: 'Sign Up Failed',
  
  // Chat Operations
  deleteChat: 'Delete Chat',
  deleteChatConfirm: 'Are you sure you want to delete "{chatTitle}"?\n\nThis will permanently delete all messages and cannot be undone.',
  failedToDeleteChat: 'Failed to delete chat: {error}',
  
  // Profile & Settings
  personalNotes: 'Personal Notes',
  unknown: 'Unknown',
  iconPlaceholder: 'Icon (emoji, e.g., 😊 or 🚀)',
  
  // Status Messages
  activeNow: 'Active now',
  active1mAgo: 'Active 1m ago', 
  activeMinsAgo: 'Active {mins}m ago',
  activeHoursAgo: 'Active {hours}h ago',
  activeDaysAgo: 'Active {days}d ago',
  lastSeenWeekAgo: 'Last seen over a week ago',
  oneUserOnline: '1 user online',
  allUsersOnline: 'All {count} users online',
  usersOnlineCount: '{online} of {total} users online',
  online: 'online',
  
  // AI Assistant Messages
  noMessagesFoundTimeframe: 'No messages found in the specified timeframe ({timeRange}).',
  noMessagesSummaryTimeframe: 'No messages found to summarize for the timeframe: {timeRange}.',
  
  // Insights Feature
  insights: 'Insights',
  chat: 'Chat',
  loadingInsights: 'Loading insights...',
  noInsightsYet: 'No insights yet',
  insightsExplanation: 'I\'ll extract structured data (dates, locations, action items) from your messages automatically.',
  testAIExtraction: 'Test AI Extraction',
  testResult: 'Test Result',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  
  // AI Assistant Quick Actions
  explainCulture: 'Explain Culture',
  smartReplies: 'Smart Replies',
  makeCasual: 'Make Casual',
  makeFormal: 'Make Formal',
  culturalTips: 'Cultural Tips',
  
  // AI Assistant Contextual Suggestions
  summarizeChatHistory: 'Summarize chat history (last week, month, or all messages)',
  explainCulturalContext: 'Explain cultural context and slang',
  suggestResponses: 'Suggest appropriate responses',
  analyzePatterns: 'Analyze conversation patterns',
  generateSmartReplies: 'Generate smart reply suggestions',
  helpSpanishCommunication: 'Help with Spanish communication',
  explainMusicTerminology: 'Explain music/rave terminology',
  
  // AI Assistant Messages
  assistantWelcome: 'Hi! I\'m your AI assistant for international communication. I can help you with:',
  assistantPrompt: 'What would you like me to help you with?',
  summarizeHowFarBack: 'I can summarize the chat history for you! How long back would you like me to summarize?\n\n• The last week\n• The last month\n• Today only\n• All messages\n\nPlease let me know your preference.',
  
  // AI Assistant Error Messages
  errorTryAgain: 'Sorry, I encountered an error. Please try again.',
  errorGeneratingSummary: 'Sorry, I encountered an error while generating the summary:',
  pleaseRetry: 'Please try again.',
  errorProcessingSummary: 'Sorry, I encountered an error while processing the summary. Please try again.',
  errorAdjustingFormality: 'Sorry, I encountered an error adjusting formality. Please try again.',
  errorAnalyzingCulture: 'Sorry, I encountered an error analyzing cultural context. Please try again.',
  errorGeneratingReplies: 'Sorry, I encountered an error generating smart replies. Please try again.',
  
  // Additional AI Assistant Messages
  noRecentMessagesFormality: 'No recent messages to adjust for formality.',
  noRecentMessagesCultural: 'No recent messages to analyze for cultural context.',
  noRecentMessagesReplies: 'No recent messages to generate replies for.',
  explainCulturalContextRequest: 'Can you explain any cultural context or slang in recent messages?',
  culturalTipsRequest: 'Can you give me cultural tips for better communication in this conversation?',
  loadingConversation: 'Loading conversation...',
  
  // AI Assistant Request Messages
  summarizeWeekRequest: 'Please summarize the chat history from the last week',
  summarizeTodayRequest: 'Please summarize today\'s chat history',
  summarizeAllRequest: 'Please summarize all our chat history',
  adjustToneCasualRequest: 'Please adjust the tone of recent messages to be more casual',
  adjustToneFormalRequest: 'Please adjust the tone of recent messages to be more formal',
  
  // Language Settings
  languageUpdated: 'Language Updated',
  languageChangedTo: 'Language changed to',
  restartForFullEffect: 'Restart the app to see all changes.',
  failedToUpdateLanguage: 'Failed to update language preference. Please try again.',
  failedToLoadProfile: 'Failed to load profile: {error}',
  
  // App Info
  appName: 'Babble',
  tagline: 'Real-time messaging platform',
  builtForTeams: 'Built for teams and individuals who need\nreliable, real-time communication',
  
  // Inline Translation UI
  seeTranslation: 'See translation',
  hideTranslation: 'Hide translation', 
  seeCulturalContext: 'See cultural context',
  hideCulturalContext: 'Hide cultural context',
  translating: 'Translating',
  translation: 'Translation',
  translationFailed: 'Translation failed',
  culturalContext: 'Cultural Context',
  analyzingCulturalContext: 'Analyzing cultural context...',
  culturalAnalysisFailed: 'Cultural analysis failed',
  formalityNote: 'Original Message Tone',
  regionalNotes: 'Regional Context',
  
  // Smart Text Assistant
  detectingLanguage: 'Detecting language...',
  detectedLanguage: 'Language detected: {language}',
  smartTextAssistant: '🤖 Smart Text Assistant',
  yourText: 'Your Text',
  detectedAs: 'Detected as',
  analyzingText: 'Analyzing your text...',
  suggestions: 'Suggestions',
  makeCasual: '😊 Make more casual',
  makeFormal: '🎩 Make more formal',
  makeNatural: '🌟 Make more natural',
  seeInYourLanguage: '🌍 See in {language}',
  casualExplanation: 'This version sounds more relaxed and friendly',
  formalExplanation: 'This version sounds more professional and polite',
  naturalExplanation: 'This version sounds more natural for native speakers',
  equivalentExplanation: 'This shows how your message sounds in your native language',
  confidence: 'Confidence',
  toneReference: 'Tone Reference',
  toneReferenceMessage: 'This translation helps you understand the tone of your message. Your original text will remain unchanged.',
  replaceText: 'Replace Text?',
  replaceTextMessage: 'Would you like to replace your text with this suggestion?',
  replace: 'Replace',
  noSuggestionsAvailable: 'No suggestions available at the moment.',
  errorGeneratingSuggestions: 'Error generating suggestions. Please try again.',
  ok: 'OK',
  tryAgain: 'Try Again'
};

/**
 * Clear translation cache
 */
export function clearTranslationCache() {
  translationCache.clear();
  console.log('Translation cache cleared');
}

/**
 * Get cache size for debugging
 */
export function getCacheSize() {
  return translationCache.size;
}

/**
 * Initialize localization system
 * @returns {Promise<object>} System language info
 */
export async function initializeLocalization() {
  try {
    const systemLanguage = getSystemLanguage();
    const languageName = getLanguageName(systemLanguage);
    const isEnglish = isSystemLanguageEnglish();

    console.log('Localization initialized:', {
      locale: systemLanguage,
      language: languageName,
      isEnglish
    });

    return {
      locale: systemLanguage,
      language: languageName,
      isEnglish
    };
  } catch (error) {
    console.error('Failed to initialize localization:', error);
    return {
      locale: 'en-US',
      language: 'English',
      isEnglish: true
    };
  }
}
