import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocalization } from '../context/LocalizationContext';

/**
 * UserLanguageInitializer - Initializes user's language preference when they log in
 * This component handles the initialization of user-specific language settings
 */
export default function UserLanguageInitializer({ children }) {
  const { user } = useAuth();
  const { initializeUserLanguage, isInitialized } = useLocalization();
  const [userLanguageInitialized, setUserLanguageInitialized] = useState(false);

  useEffect(() => {
    // Initialize user language when user logs in and system is ready
    if (user?.uid && isInitialized && !userLanguageInitialized) {
      console.log('User logged in, initializing language preference:', user.uid);
      initializeUserLanguage(user.uid).then(() => {
        setUserLanguageInitialized(true);
        console.log('User language initialized successfully');
      }).catch((error) => {
        console.error('Failed to initialize user language:', error);
        setUserLanguageInitialized(true); // Set to true anyway to prevent retry loops
      });
    }
  }, [user?.uid, initializeUserLanguage, isInitialized, userLanguageInitialized]);

  // Reset user language initialization when user changes
  useEffect(() => {
    if (!user?.uid) {
      setUserLanguageInitialized(false);
    }
  }, [user?.uid]);

  // Always render children - language initialization happens in background
  return children;
}
