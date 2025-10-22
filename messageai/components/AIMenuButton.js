import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActionSheetIOS,
  Platform,
  Modal
} from 'react-native';
import Constants from 'expo-constants';
import { requestPhotoPermissions } from '../utils/photos';
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
  currentUser
}) {
  const [showAIAssistant, setShowAIAssistant] = useState(false);

  const handlePress = async () => {
    if (disabled) return;

    // Show menu with AI as default and photo options
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', '🤖 AI Assistant', '📸 Take Photo', '🖼️ Choose Photo'],
          cancelButtonIndex: 0,
          title: 'What would you like to do?'
        },
        (buttonIndex) => {
          handleMenuSelection(buttonIndex);
        }
      );
    } else {
      Alert.alert(
        'Choose Action',
        'What would you like to do?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: '🤖 AI Assistant', onPress: () => handleMenuSelection(1) },
          { text: '📸 Take Photo', onPress: () => handleMenuSelection(2) },
          { text: '🖼️ Choose Photo', onPress: () => handleMenuSelection(3) }
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

  // Quick AI access (tap and hold or double tap)
  const handleLongPress = () => {
    if (!disabled) {
      setShowAIAssistant(true);
    }
  };

  return (
    <View>
      <TouchableOpacity
        style={[styles.menuButton, disabled && styles.menuButtonDisabled]}
        onPress={handlePress}
        onLongPress={handleLongPress}
        disabled={disabled}
      >
        <Text style={[styles.menuButtonText, disabled && styles.menuButtonTextDisabled]}>
          🤖
        </Text>
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
