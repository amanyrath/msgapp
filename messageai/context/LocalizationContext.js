import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  initializeLocalization,
  translateUIText,
  batchTranslateUITexts,
  isSystemLanguageEnglish,
  getSystemLanguage,
  getLanguageName,
  hasStaticLocaleSupport,
  loadStaticLocale,
  DEFAULT_UI_STRINGS
} from '../utils/localization';
import { getCachedUserLanguagePreference, updateCachedUserLanguagePreference, clearCachedUserLanguagePreference } from '../utils/languageIntegration';

/**
 * LocalizationContext - Provides translated UI strings throughout the app
 * Automatically detects system language and translates UI text
 */

const LocalizationContext = createContext({
  // Current language info
  systemLanguage: 'en-US',
  languageName: 'English',
  userLanguagePreference: 'English',
  isEnglish: true,
  
  // UI strings (translated or default)
  strings: DEFAULT_UI_STRINGS,
  
  // Translation functions
  t: (key, params) => key,
  translateText: (text) => text,
  
  // Static locale support
  hasStaticLocaleSupport: (language) => false,
  loadStaticLocale: (language) => null,
  
  // State
  isLoading: false,
  isInitialized: false,
  
  // Actions
  refreshTranslations: () => {},
  forceLanguage: (language) => {},
  setUserLanguagePreference: (userId, language) => {},
  initializeUserLanguage: (userId) => {}
});

/**
 * LocalizationProvider - Manages app localization state
 */
export function LocalizationProvider({ children }) {
  const [systemLanguage, setSystemLanguage] = useState('en-US');
  const [languageName, setLanguageName] = useState('English');
  const [userLanguagePreference, setUserLanguagePreference] = useState('English');
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isEnglish, setIsEnglish] = useState(true);
  const [strings, setStrings] = useState(DEFAULT_UI_STRINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [forcedLanguage, setForcedLanguage] = useState(null);

  /**
   * Initialize localization system - wait for user context
   */
  useEffect(() => {
    // Only do basic system language detection initially
    // Don't set any language preferences until user is available
    initializeBasicLanguageSystem();
  }, []);

  /**
   * Update language when user preference changes
   */
  useEffect(() => {
    if (forcedLanguage) {
      loadTranslations(forcedLanguage);
    }
  }, [forcedLanguage, loadTranslations]);

  /**
   * Reinitialize when forced language changes
   */
  useEffect(() => {
    if (isInitialized && forcedLanguage) {
      loadTranslations(forcedLanguage);
    }
  }, [forcedLanguage, isInitialized]);

  const initializeBasicLanguageSystem = async () => {
    try {
      setIsLoading(true);
      // Development logging only
      if (__DEV__) {
        console.log('Initializing basic localization system...');
      }

      // Initialize localization and get system language info
      const languageInfo = await initializeLocalization();
      
      setSystemLanguage(languageInfo.locale);
      
      if (__DEV__) {
        console.log(`System language detected: ${languageInfo.language}, waiting for user authentication...`);
      }
      
      // DON'T set any language defaults here - wait for actual user preference
      // This prevents the flash of English content before user language loads
      // setStrings will be set when initializeUserLanguage is called

      setIsInitialized(true);
    } catch (error) {
      // Always show initialization errors
      console.error('Failed to initialize localization:', error);
      // Only fallback to English on complete failure
      setStrings(DEFAULT_UI_STRINGS);
      setIsEnglish(true);
      setLanguageName('English');
      setIsInitialized(true);
    } finally {
      // Keep loading state until user language is loaded
      // setIsLoading(false); - This will be handled by initializeUserLanguage
    }
  };

  /**
   * Load translations for specified language - memoized to prevent infinite re-renders
   */
  const loadTranslations = useCallback(async (targetLanguage) => {
    try {
      if (__DEV__) {
        console.log(`Loading translations for ${targetLanguage}...`);
      }
      
      // Translate all UI strings using cached user preference
      const translatedStrings = await batchTranslateUITexts(
        DEFAULT_UI_STRINGS,
        targetLanguage,
        { userId: currentUserId }
      );

      setStrings(translatedStrings);
      if (__DEV__) {
        console.log(`Translations loaded for ${targetLanguage}`);
      }
    } catch (error) {
      // Always show translation errors
      console.error('Failed to load translations:', error);
      // Fallback to English strings
      setStrings(DEFAULT_UI_STRINGS);
    }
  }, []); // No dependencies needed since it only uses external functions and setState

  /**
   * Translate a string by key with optional parameters - memoized
   * @param {string} key - String key from DEFAULT_UI_STRINGS
   * @param {object} params - Parameters to replace in string (e.g., {chatTitle: 'My Chat'})
   * @returns {string} Translated string
   */
  const t = useCallback((key, params = {}) => {
    let translatedString = strings[key] || DEFAULT_UI_STRINGS[key] || key;
    
    // Replace parameters in string
    if (params && typeof translatedString === 'string') {
      Object.keys(params).forEach(param => {
        const placeholder = `{${param}}`;
        translatedString = translatedString.replace(placeholder, params[param]);
      });
    }
    
    return translatedString;
  }, [strings]);

  /**
   * Translate arbitrary text (not from predefined strings) - memoized
   * @param {string} text - Text to translate
   * @returns {Promise<string>} Translated text
   */
  const translateText = useCallback(async (text) => {
    if (isEnglish && !forcedLanguage) {
      return text;
    }
    
    const targetLanguage = forcedLanguage || languageName;
    return await translateUIText(text, targetLanguage, { userId: currentUserId });
  }, [isEnglish, forcedLanguage, languageName, currentUserId]);

  /**
   * Refresh all translations (useful when language settings change) - memoized
   */
  const refreshTranslations = useCallback(async () => {
    if (isEnglish && !forcedLanguage) {
      setStrings(DEFAULT_UI_STRINGS);
      return;
    }

    const targetLanguage = forcedLanguage || languageName;
    await loadTranslations(targetLanguage);
  }, [isEnglish, forcedLanguage, languageName, loadTranslations]);

  /**
   * Force a specific language (useful for testing or manual language switching)
   * @param {string} language - Language name (e.g., 'Spanish', 'French') or null to use system language
   */
  const forceLanguage = useCallback((language) => {
    setForcedLanguage(language);
    
    if (language === null) {
      // Reset to system language - use the current isEnglish state instead of calling function
      // This will be updated when the forcedLanguage changes trigger the effect
    } else {
      // Use React's batching by calling setState functions in sequence
      setIsEnglish(language === 'English');
      setLanguageName(language);
    }
  }, []);

  /**
   * Initialize user's language preference from their profile (OPTIMIZED for fast startup)
   * @param {string} userId - User ID
   * @param {boolean} forceRefresh - Force fresh data fetch (optional, defaults to false for speed)
   */
  const initializeUserLanguage = useCallback(async (userId, forceRefresh = false) => {
    if (!userId) {
      console.warn('No user ID provided for language initialization');
      // Set default English and end loading
      setUserLanguagePreference('English');
      setLanguageName('English');
      setIsEnglish(true);
      setStrings(DEFAULT_UI_STRINGS);
      setIsLoading(false);
      return;
    }
    
    try {
      setCurrentUserId(userId);
      console.log('🌍 Initializing user language preference for:', userId, forceRefresh ? '(FORCED - FRESH FETCH)' : '(CACHED ALLOWED)');
      
      // Clear stale cached data when forcing refresh (e.g., after login)
      if (forceRefresh) {
        console.log('🧹 Clearing stale cached language data for fresh fetch');
        clearCachedUserLanguagePreference(userId);
      }
      
      // Try multiple fallback strategies for maximum reliability
      let savedLanguage = null;
      
      // ALWAYS prioritize fresh Firestore data after login to get user's actual preference
      if (forceRefresh) {
        console.log('🔄 Force refresh: Fetching fresh language preference from Firestore');
        try {
          const { getUserLanguagePreference } = await import('../utils/firestore');
          const freshLanguage = await getUserLanguagePreference(userId);
          console.log('🔄 Firestore language preference (fresh):', freshLanguage);
          
          if (freshLanguage) {
            savedLanguage = freshLanguage;
            // Update cache with fresh data for future use
            try {
              await updateCachedUserLanguagePreference(userId, freshLanguage);
              console.log('💾 Updated cache with fresh language preference:', freshLanguage);
            } catch (cacheUpdateError) {
              console.warn('Failed to update language cache:', cacheUpdateError);
            }
          }
        } catch (firestoreError) {
          console.warn('Firestore language lookup failed during force refresh:', firestoreError);
        }
      }
      
      // Fallback to cached data only if fresh fetch failed or not forced
      if (!savedLanguage && !forceRefresh) {
        try {
          // Strategy: Try cached data (only when not forcing fresh)
          savedLanguage = await getCachedUserLanguagePreference(userId);
          console.log('📱 Cached language preference:', savedLanguage);
        } catch (cacheError) {
          console.warn('Cache lookup failed:', cacheError);
        }
        
        // If still no cached data, try Firestore as backup
        if (!savedLanguage) {
          try {
            const { getUserLanguagePreference } = await import('../utils/firestore');
            const freshLanguage = await getUserLanguagePreference(userId);
            console.log('🔄 Firestore language preference (backup):', freshLanguage);
            
            if (freshLanguage) {
              savedLanguage = freshLanguage;
            }
          } catch (firestoreError) {
            console.warn('Firestore language lookup failed:', firestoreError);
          }
        }
      }
      
      // Strategy 3: If still no language, try system language detection
      if (!savedLanguage) {
        try {
          const systemLanguage = getSystemLanguage();
          const systemLanguageName = getLanguageName(systemLanguage);
          console.log('🌍 Falling back to system language:', systemLanguageName);
          savedLanguage = systemLanguageName;
        } catch (systemError) {
          console.warn('System language detection failed:', systemError);
          savedLanguage = 'English'; // Final fallback
        }
      }
      
      console.log(`🚀 Final language selection: ${savedLanguage}`);
      
      // Load the determined language
      await loadLanguageIfNeeded(savedLanguage);
      console.log(`✅ User language initialized: ${savedLanguage}`);
      
    } catch (error) {
      console.error('❌ Failed to initialize user language:', error);
      // Robust fallback to English
      setUserLanguagePreference('English');
      setLanguageName('English');
      setIsEnglish(true);
      setStrings(DEFAULT_UI_STRINGS);
    } finally {
      // Always end loading state
      setIsLoading(false);
    }
  }, [loadLanguageIfNeeded]);

  /**
   * Helper function to load language without blocking startup
   */
  const loadLanguageIfNeeded = useCallback(async (targetLanguage) => {
    // Ensure we have a valid target language
    if (!targetLanguage) {
      console.log('⚠️ No target language provided, defaulting to English');
      targetLanguage = 'English';
    }
    
    if (targetLanguage !== 'English') {
      console.log(`🌐 Loading user's preferred language: ${targetLanguage}`);
      
      setUserLanguagePreference(targetLanguage);
      setLanguageName(targetLanguage);
      setIsEnglish(false);
      
      // Load translations with error handling
      try {
        await loadTranslations(targetLanguage);
        console.log(`✅ Translations loaded successfully for ${targetLanguage}`);
      } catch (error) {
        console.warn('Translation loading failed, falling back to English:', error);
        // Fallback to English if translation fails
        setUserLanguagePreference('English');
        setLanguageName('English');
        setIsEnglish(true);
        setStrings(DEFAULT_UI_STRINGS);
      }
      
    } else {
      console.log('🇺🇸 Using English, loading default strings');
      
      setUserLanguagePreference('English');
      setLanguageName('English');
      setIsEnglish(true);
      setStrings(DEFAULT_UI_STRINGS);
    }
  }, [loadTranslations]);

  /**
   * Update user's language preference 
   * @param {string} userId - User ID
   * @param {string} language - New language preference
   */
  const setUserLanguagePreferenceFunc = useCallback(async (userId, language) => {
    if (!userId) {
      console.warn('No user ID provided for language preference update');
      return false;
    }

    try {
      setIsLoading(true); // Show loading state during language change
      console.log(`🔄 Updating language preference for ${userId}: ${language}`);
      
      // Update using cached optimization (updates both cache and Firestore)
      const success = await updateCachedUserLanguagePreference(userId, language);
      
      if (success) {
        // Update local state
        setUserLanguagePreference(language);
        setLanguageName(language);
        setIsEnglish(language === 'English');
        
        // Load translations for new language
        if (language !== 'English') {
          console.log(`🌐 Loading translations for ${language}...`);
          await loadTranslations(language);
        } else {
          console.log('🇺🇸 Switching to English, using default strings');
          setStrings(DEFAULT_UI_STRINGS);
        }
        
        console.log('✅ Language preference updated successfully');
        return true;
      } else {
        console.error('❌ Failed to update language preference in Firestore');
        return false;
      }
    } catch (error) {
      console.error('❌ Error updating language preference:', error);
      return false;
    } finally {
      setIsLoading(false); // Hide loading state
    }
  }, [loadTranslations]);

  const contextValue = useMemo(() => ({
    // Language info
    systemLanguage,
    languageName: forcedLanguage || languageName,
    userLanguagePreference,
    isEnglish: forcedLanguage ? forcedLanguage === 'English' : isEnglish,
    
    // UI strings
    strings,
    
    // Translation functions
    t,
    translateText,
    
    // Static locale support
    hasStaticLocaleSupport,
    loadStaticLocale,
    
    // State
    isLoading,
    isInitialized,
    
    // Actions
    refreshTranslations,
    forceLanguage,
    setUserLanguagePreference: setUserLanguagePreferenceFunc,
    initializeUserLanguage
  }), [
    systemLanguage,
    languageName,
    userLanguagePreference,
    forcedLanguage,
    isEnglish,
    strings,
    t,
    translateText,
    isLoading,
    isInitialized,
    refreshTranslations,
    forceLanguage,
    setUserLanguagePreferenceFunc,
    initializeUserLanguage
  ]);

  return (
    <LocalizationContext.Provider value={contextValue}>
      {children}
    </LocalizationContext.Provider>
  );
}

/**
 * Hook to use localization context
 * @returns {object} Localization context
 */
export function useLocalization() {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error('useLocalization must be used within a LocalizationProvider');
  }
  return context;
}

/**
 * Hook to get translated strings
 * @returns {function} Translation function
 */
export function useTranslation() {
  const { t } = useLocalization();
  return t;
}

/**
 * Higher-order component to inject translation function
 * @param {React.Component} Component - Component to wrap
 * @returns {React.Component} Wrapped component with translation props
 */
export function withTranslation(Component) {
  return function TranslatedComponent(props) {
    const { t, translateText, isLoading } = useLocalization();
    
    return (
      <Component 
        {...props} 
        t={t} 
        translateText={translateText}
        isTranslationLoading={isLoading}
      />
    );
  };
}

export default LocalizationContext;
