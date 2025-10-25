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
import { Logger } from './utils/logger';

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

  // Handle splash screen completion
  const handleSplashComplete = () => {
    Logger.ui('Splash screen completed');
    setShowSplash(false);
  };

  // Handle language initialization completion
  const handleLanguageInitComplete = () => {
    Logger.ui('Language initialization completed');
    setShowLanguageInit(false);
  };

  // Force language initialization screen on every login
  useEffect(() => {
    if (user && !loading && !showSplash) {
      console.log('🔄 Forcing language initialization screen for user:', user.uid);
      setShowLanguageInit(true);
    } else if (!user) {
      console.log('👤 User logged out, hiding language initialization');
      setShowLanguageInit(false);
    }
  }, [user, loading, showSplash]);

  // Request notification permissions when user logs in
  useEffect(() => {
    if (user) {
      registerForPushNotifications();
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
        <ActivityIndicator size="large" color="#007AFF" />
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
