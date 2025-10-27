import React, { useState, useRef, useCallback } from 'react';
import { View, Alert, StyleSheet } from 'react-native';
import { Audio } from 'expo-av';
import VoiceMessageRecorder from './VoiceMessageRecorder';
import { uploadAudioMessage } from '../utils/audioStorage';
import { sendAudioMessage } from '../utils/firestore';

/**
 * AudioMessageManager - Complete audio message system
 * Handles recording, uploading, and sending audio messages
 * Integrates VoiceMessageRecorder with Firebase Storage and Firestore
 */
export default function AudioMessageManager({
  chatId,
  currentUser,
  disabled = false,
  onSendStart,
  onSendComplete,
  onSendError,
  style = {},
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Handle voice message sending
  const handleSendVoiceMessage = useCallback(async (audioURI, duration) => {
    if (!audioURI || !duration || !currentUser) {
      console.warn('Invalid audio message data');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    onSendStart?.();

    try {
      // Upload audio file to Firebase Storage
      const uploadResult = await uploadAudioMessage(
        audioURI,
        chatId,
        currentUser.uid,
        (progress) => {
          setUploadProgress(progress);
        }
      );

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Failed to upload audio');
      }

      // Prepare audio data for Firestore
      const audioData = {
        url: uploadResult.downloadURL,
        duration: Math.round(duration), // Duration in seconds
        fileName: uploadResult.fileName,
        size: uploadResult.size,
      };

      // Send audio message to Firestore
      const messageId = await sendAudioMessage(
        chatId,
        currentUser.uid,
        currentUser.email,
        audioData,
        currentUser.displayName || currentUser.nickname
      );

      console.log('Audio message sent successfully:', messageId);
      onSendComplete?.(messageId, audioData);

    } catch (error) {
      console.error('Error sending audio message:', error);
      
      // Show user-friendly error message
      Alert.alert(
        'Failed to Send Voice Message',
        'There was a problem sending your voice message. Please try again.',
        [{ text: 'OK' }]
      );
      
      onSendError?.(error);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [chatId, currentUser, onSendStart, onSendComplete, onSendError]);

  // Handle recording cancellation
  const handleCancel = useCallback(() => {
    console.log('Voice message recording cancelled');
    // Could add haptic feedback here if needed
  }, []);

  return (
    <View style={[styles.container, style]}>
      <VoiceMessageRecorder
        onSendVoiceMessage={handleSendVoiceMessage}
        onCancel={handleCancel}
        disabled={disabled || isUploading}
      />
      
      {/* Optional: Could add upload progress indicator here */}
      {isUploading && (
        <View style={styles.uploadIndicator}>
          {/* Progress indicator would go here */}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  uploadIndicator: {
    position: 'absolute',
    top: -80,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#e0e0e0',
    borderRadius: 1,
  },
});

