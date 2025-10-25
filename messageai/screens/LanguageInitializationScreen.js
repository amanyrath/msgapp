import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useLocalization } from '../context/LocalizationContext';

/**
 * LanguageInitializationScreen - Shows a brief splash screen after login
 * to ensure user's language preferences are fully loaded before navigation
 */
export default function LanguageInitializationScreen({ onComplete }) {
  const { user } = useAuth();
  const { userLanguagePreference, isLoading, isInitialized, initializeUserLanguage, t } = useLocalization();
  const [initializationComplete, setInitializationComplete] = useState(false);
  const [timeoutReached, setTimeoutReached] = useState(false);
  const [forcedInitialization, setForcedInitialization] = useState(false);

  useEffect(() => {
    // Set a maximum timeout of 10 seconds for initialization
    const timeout = setTimeout(() => {
      console.log('⏰ Language initialization timeout reached');
      setTimeoutReached(true);
    }, 10000);

    return () => clearTimeout(timeout);
  }, []);

  // Force language initialization when screen is shown
  useEffect(() => {
    if (user?.uid && !forcedInitialization) {
      console.log('🔄 LanguageInitializationScreen: Forcing language initialization for user:', user.uid);
      setForcedInitialization(true);
      
      // Force language initialization regardless of cache state
      initializeUserLanguage(user.uid, true).then(() => {
        console.log('✅ LanguageInitializationScreen: Forced initialization completed');
      }).catch((error) => {
        console.error('❌ LanguageInitializationScreen: Forced initialization failed:', error);
      });
    }
  }, [user?.uid, forcedInitialization, initializeUserLanguage]);

  useEffect(() => {
    // Check if initialization is complete - require forced initialization to have been attempted
    if (user?.uid && isInitialized && !isLoading && forcedInitialization && userLanguagePreference) {
      console.log('✅ Language initialization completed:', userLanguagePreference);
      console.log('🎯 Language context state:', { isInitialized, isLoading, userLanguagePreference });
      
      // Longer delay to ensure UI is stable and language is fully loaded
      setTimeout(() => {
        console.log('🏁 LanguageInitializationScreen: Completing initialization');
        setInitializationComplete(true);
      }, 3000); // Extended to 3 seconds for better reliability
    }
  }, [user?.uid, isInitialized, isLoading, userLanguagePreference, forcedInitialization]);

  useEffect(() => {
    // Complete initialization when ready or timeout is reached
    if (initializationComplete || timeoutReached) {
      onComplete();
    }
  }, [initializationComplete, timeoutReached, onComplete]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.title}>{t('settingUpExperience') || 'Setting up your experience'}</Text>
        <Text style={styles.subtitle}>
          {!forcedInitialization
            ? t('initializingLanguageSystem') || 'Initializing language system...'
            : isLoading 
              ? t('loadingLanguagePreferences') || 'Loading your language preferences...'
              : userLanguagePreference 
                ? `${t('settingUpInterface') || 'Setting up interface'} in ${userLanguagePreference}...`
                : t('preparingInterface') || 'Preparing your personalized interface...'
          }
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111',
    marginTop: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 22,
  },
});
