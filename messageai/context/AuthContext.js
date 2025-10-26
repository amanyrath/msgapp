import React, { createContext, useState, useEffect, useContext } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { createUserProfile } from '../utils/firestore';
import { getSystemLanguage, getLanguageName } from '../utils/localization';
import { setUserOnline, setUserOffline, clearPresenceRetryQueue } from '../utils/presence';
import { registerForPushTokenAsync, clearPushToken } from '../utils/notifications';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setLoading(false);
      
      if (user) {
        console.log('User signed in:', user.email);
        // Set user presence as online (skip if RTDB not initialized)
        try {
          // Fetch user profile to get nickname and icon
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          
          let displayName = user.email?.split('@')[0] || 'User';
          let nickname = displayName;
          let icon = '👤';
          
          if (userSnap.exists()) {
            const userData = userSnap.data();
            displayName = userData.displayName || displayName;
            nickname = userData.nickname || displayName;
            icon = userData.icon || icon;
          }
          
          // PERFORMANCE OPTIMIZATION: Defer non-critical operations to background
          setTimeout(async () => {
            try {
              await setUserOnline(user.uid, {
                email: user.email,
                displayName,
                nickname,
                icon,
              });
              
              // Register for push notifications in background
              registerForPushTokenAsync(user.uid).catch(error => {
                console.log('Push token registration failed:', error.message);
              });
            } catch (error) {
              console.log('Background presence/push setup failed:', error.message);
            }
          }, 50); // Start background operations after 50ms
        } catch (error) {
          console.log('Presence not available:', error.message);
        }
      } else {
        console.log('User signed out');
      }
    });

    // Cleanup subscription
    return unsubscribe;
  }, []);

  // Sign up with email and password
  const signUp = async (email, password, nickname, icon, selectedLanguage) => {
    try {
      setError(null);
      setLoading(true);
      
      // Detect system language for reference, but use selected language
      const systemLanguage = getSystemLanguage();
      const languagePreference = selectedLanguage || getLanguageName(systemLanguage);
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await createUserProfile(
        userCredential.user.uid,
        {
          email,
          displayName: nickname,
          nickname,
          icon,
          languagePreference: languagePreference, // Store user's selected language preference
          systemLanguage: systemLanguage, // Store detected system language for reference
        },
        { setCreatedAt: true }
      );
      console.log('Sign up successful:', userCredential.user.email, 'Language:', languagePreference);
      return { success: true };
    } catch (error) {
      console.error('Sign up error:', error.message);
      setError(error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Sign in with email and password
  const signIn = async (email, password) => {
    try {
      setError(null);
      setLoading(true);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const displayName = email.split('@')[0];
      await createUserProfile(userCredential.user.uid, {
        email,
        displayName,
      });
      console.log('Sign in successful:', userCredential.user.email);
      return { success: true };
    } catch (error) {
      console.error('Sign in error:', error.message);
      setError(error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      setError(null);
      
      // Set user as offline and clear push token before signing out
      if (user?.uid) {
        try {
          await setUserOffline(user.uid);
          // Clear any pending presence retry operations
          clearPresenceRetryQueue();
          // PERFORMANCE ENHANCEMENT: Clear push token on logout
          await clearPushToken(user.uid);
        } catch (presenceError) {
          console.log('Could not update presence/push token on logout:', presenceError.message);
        }
      }
      
      await firebaseSignOut(auth);
      console.log('Sign out successful');
      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error.message);
      setError(error.message);
      return { success: false, error: error.message };
    }
  };

  const value = {
    user,
    loading,
    error,
    signUp,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
