import { StatusBar } from 'expo-status-bar';
import { StyleSheet, ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NetworkProvider } from './context/NetworkContext';
import { NotificationProvider } from './context/NotificationContext';
import { LocalizationProvider } from './context/LocalizationContext';
import ErrorBoundary from './components/ErrorBoundary';
import { registerForPushNotifications } from './utils/notifications';
import logger from './utils/logger';

// Import screens
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import ChatScreen from './screens/ChatScreen';
import ChatListScreen from './screens/ChatListScreen';
import NewChatScreen from './screens/NewChatScreen';
import ProfileScreen from './screens/ProfileScreen';
import ChatSettingsScreen from './screens/ChatSettingsScreen';
import SplashScreen from './screens/SplashScreen';
import LanguageInitializationScreen from './screens/LanguageInitializationScreen';

const Stack = createNativeStackNavigator();

function Navigation() {
  const { user, loading } = useAuth();
  const navigationRef = useRef();
  const [showSplash, setShowSplash] = useState(true);
  const [showLanguageInit, setShowLanguageInit] = useState(false);
  
  // Prevent repeated language init calls
  const languageInitShownRef = useRef(false);

  // Handle splash screen completion
  const handleSplashComplete = () => {
    logger.ui('Splash screen completed');
    setShowSplash(false);
  };

  // Handle language initialization completion
  const handleLanguageInitComplete = () => {
    logger.ui('Language initialization completed');
    setShowLanguageInit(false);
  };

  // Enhanced language initialization flow - ALWAYS show after login to fetch fresh user preferences
  useEffect(() => {
    if (user && !loading && !showSplash && !languageInitShownRef.current) {
      console.log('🔄 User authenticated, showing language initialization to fetch fresh preferences:', user.uid);
      languageInitShownRef.current = true;
      setShowLanguageInit(true);
    } else if (!user && showLanguageInit) {
      console.log('👤 User logged out, resetting language initialization for next login');
      languageInitShownRef.current = false;
      setShowLanguageInit(false);
    }
  }, [user, loading, showSplash]);

  // Reset language initialization state when user changes (for fresh login sessions)
  useEffect(() => {
    if (user?.uid) {
      // Reset for new user session to ensure fresh language fetch
      languageInitShownRef.current = false;
    }
  }, [user?.uid]);

  // PERFORMANCE OPTIMIZATION: Defer notification permissions to background
  useEffect(() => {
    if (user) {
      // Defer notification registration to not block initial load
      setTimeout(() => {
        registerForPushNotifications();
      }, 100); // Register after 100ms to allow main UI to load first
    }
  }, [user]);

  // Handle notification taps
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const { chatId, chatData } = response.notification.request.content.data;
      
      // Navigate to the chat when notification is tapped
      if (navigationRef.current && chatId && chatData) {
        navigationRef.current.navigate('Chat', { chat: chatData });
      }
    });

    return () => subscription.remove();
  }, []);

  // Show splash screen on first load
  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  // Show loading screen while checking auth state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#CD853F" />
      </View>
    );
  }

  // Show language initialization screen after login
  if (showLanguageInit) {
    return <LanguageInitializationScreen onComplete={handleLanguageInitComplete} />;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        {user ? (
          // User is signed in - show main app
          <>
            <Stack.Screen name="ChatList" component={ChatListScreen} />
            <Stack.Screen name="NewChat" component={NewChatScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="ChatSettings" component={ChatSettingsScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
          </>
        ) : (
          // User is not signed in - show auth screens
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LocalizationProvider>
        <NetworkProvider>
          <AuthProvider>
            <NotificationProvider>
              <Navigation />
              <StatusBar style="auto" />
            </NotificationProvider>
          </AuthProvider>
        </NetworkProvider>
      </LocalizationProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
