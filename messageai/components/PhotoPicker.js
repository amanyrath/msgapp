import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActionSheetIOS,
  Platform
} from 'react-native';
import { requestPhotoPermissions } from '../utils/photos';

/**
 * PhotoPicker component for selecting photos from camera or library
 */
export default function PhotoPicker({ onPhotoSelected, disabled = false }) {
  const showPhotoOptions = async () => {
    if (disabled) return;

    try {
      // Request permissions first
      const permissions = await requestPhotoPermissions();
      
      if (!permissions.camera && !permissions.library) {
        Alert.alert(
          'Permissions Required',
          'Please enable camera and photo library permissions in Settings to send photos.'
        );
        return;
      }

      if (Platform.OS === 'ios') {
        // Use iOS ActionSheet
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ['Cancel', 'Take Photo', 'Choose from Library'],
            cancelButtonIndex: 0,
          },
          (buttonIndex) => {
            if (buttonIndex === 1) {
              // Take Photo
              if (permissions.camera) {
                onPhotoSelected('camera');
              } else {
                Alert.alert('Camera permission not granted');
              }
            } else if (buttonIndex === 2) {
              // Choose from Library
              if (permissions.library) {
                onPhotoSelected('library');
              } else {
                Alert.alert('Photo library permission not granted');
              }
            }
          }
        );
      } else {
        // Use Android Alert
        Alert.alert(
          'Select Photo',
          'Choose photo source',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Take Photo',
              onPress: () => {
                if (permissions.camera) {
                  onPhotoSelected('camera');
                } else {
                  Alert.alert('Camera permission not granted');
                }
              }
            },
            {
              text: 'Choose from Library',
              onPress: () => {
                if (permissions.library) {
                  onPhotoSelected('library');
                } else {
                  Alert.alert('Photo library permission not granted');
                }
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error showing photo options:', error);
      Alert.alert('Error', 'Failed to access photo options');
    }
  };

  return (
    <TouchableOpacity
      style={[styles.photoButton, disabled && styles.photoButtonDisabled]}
      onPress={showPhotoOptions}
      disabled={disabled}
    >
      <Text style={[styles.photoButtonText, disabled && styles.photoButtonTextDisabled]}>
        📷
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  photoButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  photoButtonDisabled: {
    backgroundColor: '#ccc',
  },
  photoButtonText: {
    fontSize: 20,
    color: 'white',
  },
  photoButtonTextDisabled: {
    color: '#999',
  },
});
