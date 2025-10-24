import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocalization } from '../context/LocalizationContext';

/**
 * UserLanguageInitializer - Initializes user's language preference when they log in
 * This component handles the initialization of user-specific language settings
 */
export default function UserLanguageInitializer({ children }) {
  const { user } = useAuth();
  const { initializeUserLanguage, isInitialized, isLoading } = useLocalization();
  const [userLanguageInitialized, setUserLanguageInitialized] = useState(false);
  const [initializationAttempted, setInitializationAttempted] = useState(false);

  useEffect(() => {
    // Initialize user language when user logs in and system is ready
    if (user?.uid && isInitialized && !userLanguageInitialized && !initializationAttempted) {
      console.log('🚀 User logged in, initializing language preference:', user.uid);
      setInitializationAttempted(true);
      
      initializeUserLanguage(user.uid).then(() => {
        setUserLanguageInitialized(true);
        console.log('✅ User language initialized successfully');
      }).catch((error) => {
        console.error('❌ Failed to initialize user language:', error);
        setUserLanguageInitialized(true); // Set to true anyway to prevent retry loops
      });
    }
  }, [user?.uid, initializeUserLanguage, isInitialized, userLanguageInitialized, initializationAttempted]);

  // Reset user language initialization when user changes or logs out
  useEffect(() => {
    if (!user?.uid) {
      console.log('👤 User logged out, resetting language initialization state');
      setUserLanguageInitialized(false);
      setInitializationAttempted(false);
    }
  }, [user?.uid]);

  // Force initialization after a delay if system is ready but user language wasn't initialized
  useEffect(() => {
    if (user?.uid && isInitialized && !userLanguageInitialized && !isLoading) {
      const timeout = setTimeout(() => {
        if (!userLanguageInitialized && !initializationAttempted) {
          console.log('⚡ Force initializing user language after delay:', user.uid);
          setInitializationAttempted(true);
          
          initializeUserLanguage(user.uid).then(() => {
            setUserLanguageInitialized(true);
            console.log('✅ Force initialization completed');
          }).catch((error) => {
            console.error('❌ Force initialization failed:', error);
            setUserLanguageInitialized(true);
          });
        }
      }, 1000); // 1 second delay

      return () => clearTimeout(timeout);
    }
  }, [user?.uid, isInitialized, userLanguageInitialized, isLoading, initializationAttempted, initializeUserLanguage]);

  // Always render children - language initialization happens in background
  return children;
}
