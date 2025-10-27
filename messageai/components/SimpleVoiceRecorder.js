import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';
import { uploadAudioMessage } from '../utils/audioStorage';
import { sendAudioMessage } from '../utils/firestore';

/**
 * SimpleVoiceRecorder - Basic voice message recording with simple UI
 * No complex gestures, just start/stop recording
 */
export default function SimpleVoiceRecorder({
  visible = false,
  onClose,
  chatId,
  currentUser,
  onSendComplete,
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recording, setRecording] = useState(null);
  const [duration, setDuration] = useState(0);

  // Start recording
  const startRecording = async () => {
    try {
      // Request permissions
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission Required', 'Microphone permission is needed to record voice messages.');
        return;
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Create recording
      const { recording: newRecording } = await Audio.Recording.createAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
      });

      setRecording(newRecording);
      setIsRecording(true);
      setDuration(0);
      
      // Start duration timer
      const timer = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
      
      // Store timer reference
      newRecording._timer = timer;
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  // Stop recording
  const stopRecording = async () => {
    if (!recording) return;
    
    try {
      // Clear timer
      if (recording._timer) {
        clearInterval(recording._timer);
      }
      
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      
      const uri = recording.getURI();
      if (uri && duration > 0) {
        await sendVoiceMessage(uri, duration);
      } else {
        Alert.alert('Error', 'Recording too short or invalid.');
      }
      
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording.');
    }
  };

  // Cancel recording
  const cancelRecording = async () => {
    if (!recording) return;
    
    try {
      // Clear timer
      if (recording._timer) {
        clearInterval(recording._timer);
      }
      
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      
      // Delete the file
      const uri = recording.getURI();
      if (uri) {
        // File will be auto-cleaned by system
      }
      
      setRecording(null);
      setDuration(0);
      onClose();
      
    } catch (error) {
      console.error('Failed to cancel recording:', error);
    }
  };

  // Send voice message
  const sendVoiceMessage = async (audioURI, recordingDuration) => {
    setIsUploading(true);
    
    try {
      // Upload audio file
      const uploadResult = await uploadAudioMessage(
        audioURI,
        chatId,
        currentUser.uid,
        (progress) => {
          console.log('Upload progress:', progress);
        }
      );

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Failed to upload audio');
      }

      // Send message to Firestore
      const audioData = {
        url: uploadResult.downloadURL,
        duration: Math.round(recordingDuration),
        fileName: uploadResult.fileName,
        size: uploadResult.size,
      };

      const messageId = await sendAudioMessage(
        chatId,
        currentUser.uid,
        currentUser.email,
        audioData,
        currentUser.displayName || currentUser.nickname
      );

      console.log('Voice message sent:', messageId);
      
      // Reset and close
      setRecording(null);
      setDuration(0);
      onClose();
      onSendComplete?.(messageId, audioData);
      
    } catch (error) {
      console.error('Error sending voice message:', error);
      Alert.alert('Failed to Send', 'Could not send voice message. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Format duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Voice Message</Text>
          
          {isUploading ? (
            <View style={styles.uploadingContainer}>
              <ActivityIndicator size="large" color="#CD853F" />
              <Text style={styles.uploadingText}>Sending voice message...</Text>
            </View>
          ) : (
            <>
              <View style={styles.recordingContainer}>
                <View style={[
                  styles.recordButton,
                  isRecording && styles.recordingActive
                ]}>
                  <Text style={styles.recordIcon}>
                    {isRecording ? '⏹️' : '🎤'}
                  </Text>
                </View>
                
                {isRecording && (
                  <Text style={styles.duration}>
                    {formatDuration(duration)}
                  </Text>
                )}
              </View>

              <Text style={styles.instruction}>
                {isRecording ? 'Tap stop when finished' : 'Tap to start recording'}
              </Text>

              <View style={styles.buttonContainer}>
                {isRecording ? (
                  <>
                    <TouchableOpacity
                      style={[styles.button, styles.cancelButton]}
                      onPress={cancelRecording}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.button, styles.stopButton]}
                      onPress={stopRecording}
                    >
                      <Text style={styles.stopButtonText}>Send</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={[styles.button, styles.cancelButton]}
                      onPress={onClose}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.button, styles.recordStartButton]}
                      onPress={startRecording}
                    >
                      <Text style={styles.recordButtonText}>Record</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 30,
    width: '80%',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#333',
  },
  recordingContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#CD853F',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  recordingActive: {
    backgroundColor: '#ff4444',
  },
  recordIcon: {
    fontSize: 32,
  },
  duration: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#CD853F',
  },
  instruction: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  recordStartButton: {
    backgroundColor: '#CD853F',
  },
  recordButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  stopButton: {
    backgroundColor: '#34C759',
  },
  stopButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  uploadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  uploadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
  },
});
