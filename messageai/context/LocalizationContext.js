import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  initializeLocalization,
  translateUIText,
  batchTranslateUITexts,
  isSystemLanguageEnglish,
  getSystemLanguage,
  getLanguageName,
  DEFAULT_UI_STRINGS
} from '../utils/localization';
import { getCachedUserLanguagePreference, updateCachedUserLanguagePreference } from '../utils/languageIntegration';

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
   * Initialize localization system - start with basic setup only
   */
  useEffect(() => {
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
      console.log('Initializing basic localization system...');

      // Initialize localization and get system language (but don't use it yet)
      const languageInfo = await initializeLocalization();
      
      setSystemLanguage(languageInfo.locale);
      
      // Don't set language name or load translations yet - wait for user preference
      console.log(`System language detected: ${languageInfo.language}, waiting for user preference...`);
      
      // Start with English defaults until user preference is loaded
      setStrings(DEFAULT_UI_STRINGS);
      setIsEnglish(true);
      setLanguageName('English');

      setIsInitialized(true);
    } catch (error) {
      console.error('Failed to initialize localization:', error);
      // Fallback to English
      setStrings(DEFAULT_UI_STRINGS);
      setIsEnglish(true);
      setLanguageName('English');
      setIsInitialized(true);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Load translations for specified language - memoized to prevent infinite re-renders
   */
  const loadTranslations = useCallback(async (targetLanguage) => {
    try {
      console.log(`Loading translations for ${targetLanguage}...`);
      
      // Translate all UI strings using cached user preference
      const translatedStrings = await batchTranslateUITexts(
        DEFAULT_UI_STRINGS,
        targetLanguage,
        { userId: currentUserId }
      );

      setStrings(translatedStrings);
      console.log(`Translations loaded for ${targetLanguage}`);
    } catch (error) {
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
   * Initialize user's language preference from their profile
   * @param {string} userId - User ID
   */
  const initializeUserLanguage = useCallback(async (userId) => {
    if (!userId) return;
    
    try {
      setCurrentUserId(userId);
      setIsLoading(true); // Show loading state during language initialization
      console.log('🌍 Initializing user language preference for:', userId);
      
      // Get user's saved language preference from cached data (optimized)
      const savedLanguage = await getCachedUserLanguagePreference(userId);
      console.log('📱 User stored language preference:', savedLanguage);
      
      // PRIORITY: User stored language takes precedence over system language
      if (savedLanguage && savedLanguage !== 'English') {
        console.log(`🌐 Loading user's preferred language: ${savedLanguage}`);
        
        setUserLanguagePreference(savedLanguage);
        setLanguageName(savedLanguage);
        setIsEnglish(false);
        
        // Load translations for the user's preferred language
        await loadTranslations(savedLanguage);
        console.log(`✅ User language initialized: ${savedLanguage}`);
        
      } else if (savedLanguage === 'English') {
        console.log('🇺🇸 User prefers English, using default strings');
        
        setUserLanguagePreference('English');
        setLanguageName('English');
        setIsEnglish(true);
        setStrings(DEFAULT_UI_STRINGS);
        
      } else {
        // No user preference saved, fall back to system language as secondary option
        console.log('⚙️ No user language preference found, checking system language...');
        const languageInfo = await initializeLocalization();
        
        setUserLanguagePreference(languageInfo.language);
        setLanguageName(languageInfo.language);
        setIsEnglish(languageInfo.isEnglish);
        
        if (!languageInfo.isEnglish) {
          console.log(`🔄 Using system language: ${languageInfo.language}`);
          await loadTranslations(languageInfo.language);
        } else {
          console.log('🇺🇸 System language is English, using default strings');
          setStrings(DEFAULT_UI_STRINGS);
        }
      }
    } catch (error) {
      console.error('❌ Failed to initialize user language:', error);
      // Fallback to English on error
      setUserLanguagePreference('English');
      setLanguageName('English');
      setIsEnglish(true);
      setStrings(DEFAULT_UI_STRINGS);
    } finally {
      setIsLoading(false); // Hide loading state
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
