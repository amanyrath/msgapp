import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActionSheetIOS,
  Platform,
  Modal,
  Animated
} from 'react-native';
import Constants from 'expo-constants';
import { requestPhotoPermissions } from '../utils/photos';
import { useTranslation } from '../context/LocalizationContext';
import AIAssistant from './AIAssistant';

/**
 * AIMenuButton - Replaces PhotoPicker with AI-first menu interface
 * Default action is AI Assistant, with photo options in submenu
 */
export default function AIMenuButton({
  onPhotoSelected,
  disabled = false,
  chatId,
  messages = [],
  userProfiles = [],
  currentUser,
  onAutoTranslateChange, // Auto-translate state changes
  languageDetected = false, // New prop to indicate different language detected
  smartTextData = null, // Smart text data for assistance
  onSmartTextPress // Callback when smart text assistance is needed
}) {
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const t = useTranslation();
  
  // Golden glow animation for smart text detection
  const glowAnim = useRef(new Animated.Value(0)).current;
  
  // Animate golden glow when language is detected
  useEffect(() => {
    console.log('🎨 AIMenuButton languageDetected changed to:', languageDetected);
    if (languageDetected) {
      console.log('🟡 Starting golden glow animation');
      // Start pulsing golden glow
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: false,
          }),
        ])
      ).start();
    } else {
      console.log('🔵 Stopping golden glow animation');
      // Stop animation and reset
      glowAnim.stopAnimation();
      Animated.timing(glowAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [languageDetected]);

  const handlePress = async () => {
    if (disabled) return;

    // If language detected, prioritize smart text assistance
    if (languageDetected && smartTextData && onSmartTextPress) {
      onSmartTextPress();
      return;
    }

    // Normal behavior - show full menu
    showFullMenu();
  };

  const showFullMenu = () => {
    // Show menu with AI as default and photo options
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t('cancel'), t('aiAssistantOption'), t('takePhoto'), t('choosePhoto')],
          cancelButtonIndex: 0,
          title: t('whatWouldYouLikeToDo')
        },
        (buttonIndex) => {
          handleMenuSelection(buttonIndex);
        }
      );
    } else {
      Alert.alert(
        t('chooseAction'),
        t('whatWouldYouLikeToDo'),
        [
          { text: t('cancel'), style: 'cancel' },
          { text: t('aiAssistantOption'), onPress: () => handleMenuSelection(1) },
          { text: t('takePhoto'), onPress: () => handleMenuSelection(2) },
          { text: t('choosePhoto'), onPress: () => handleMenuSelection(3) }
        ]
      );
    }
  };

  const handleMenuSelection = async (buttonIndex) => {
    switch (buttonIndex) {
      case 1: // AI Assistant
        setShowAIAssistant(true);
        break;
      case 2: // Take Photo
        await handlePhotoOption('camera');
        break;
      case 3: // Choose Photo
        await handlePhotoOption('library');
        break;
      default:
        break;
    }
  };

  const handlePhotoOption = async (source) => {
    try {
      const isExpoGo = Constants.appOwnership === null;
      
      if (isExpoGo) {
        // Mock photo functionality for Expo Go
        onPhotoSelected(source);
        return;
      }

      // Real photo functionality
      const permissions = await requestPhotoPermissions();
      
      if (source === 'camera' && !permissions.camera) {
        Alert.alert('Camera permission not granted');
        return;
      }
      
      if (source === 'library' && !permissions.library) {
        Alert.alert('Photo library permission not granted');
        return;
      }

      onPhotoSelected(source);
    } catch (error) {
      console.error('Error handling photo option:', error);
      Alert.alert('Error', 'Failed to access photo options');
    }
  };

  // Long press behavior
  const handleLongPress = () => {
    if (disabled) return;
    
    if (languageDetected) {
      // When golden, long press shows full menu
      showFullMenu();
    } else {
      // When not golden, long press opens AI Assistant directly
      setShowAIAssistant(true);
    }
  };

  // Create golden glow style
  const glowStyle = {
    shadowColor: '#FFD700', // Golden color
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: glowAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 0.8],
    }),
    shadowRadius: glowAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 8],
    }),
    elevation: glowAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [2, 8],
    }),
  };

  const buttonStyle = languageDetected ? 
    [styles.menuButton, styles.smartButton, glowStyle] : 
    [styles.menuButton, disabled && styles.menuButtonDisabled];

  return (
    <View>
      <TouchableOpacity
        onPress={handlePress}
        onLongPress={handleLongPress}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <Animated.View style={buttonStyle}>
          <Text style={[styles.menuButtonText, disabled && styles.menuButtonTextDisabled]}>
            🤖
          </Text>
        </Animated.View>
      </TouchableOpacity>

      <Modal
        visible={showAIAssistant}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAIAssistant(false)}
      >
        <AIAssistant
          visible={showAIAssistant}
          onClose={() => setShowAIAssistant(false)}
          chatId={chatId}
          messages={messages}
          userProfiles={userProfiles}
          currentUser={currentUser}
          onAutoTranslateChange={onAutoTranslateChange}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  smartButton: {
    backgroundColor: '#FFD700', // Golden background when smart text detected
    borderWidth: 2,
    borderColor: '#FFA500', // Darker golden border
  },
  menuButtonDisabled: {
    backgroundColor: '#ccc',
  },
  menuButtonText: {
    fontSize: 20,
    color: 'white',
  },
  menuButtonTextDisabled: {
    color: '#999',
  },
});
