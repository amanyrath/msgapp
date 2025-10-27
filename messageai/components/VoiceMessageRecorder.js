import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
  Vibration,
  PanResponder
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

const { width } = Dimensions.get('window');

/**
 * VoiceMessageRecorder - Apple-style voice message recording component
 * Features:
 * - Hold to record
 * - Slide to cancel
 * - Waveform animation
 * - Quick release to send
 */
export default function VoiceMessageRecorder({ onSendVoiceMessage, onCancel, disabled = false }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [slideToCancel, setSlideToCancel] = useState(false);
  
  // Animation values
  const recordingAnimation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(0)).current;
  const waveformAnimation = useRef(new Animated.Value(0)).current;
  
  // Recording refs
  const recording = useRef(null);
  const recordingTimer = useRef(null);
  
  // Gesture handling
  const translateX = useRef(new Animated.Value(0)).current;

  // Start recording
  const startRecording = async () => {
    if (disabled) return;
    
    try {
      // Request permissions
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        console.warn('Microphone permission denied');
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

      recording.current = newRecording;
      setIsRecording(true);
      setRecordingDuration(0);
      
      // Haptic feedback
      Vibration.vibrate(10);
      
      // Start animations
      Animated.parallel([
        Animated.timing(recordingAnimation, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(waveformAnimation, {
              toValue: 1,
              duration: 500,
              useNativeDriver: false,
            }),
            Animated.timing(waveformAnimation, {
              toValue: 0.3,
              duration: 500,
              useNativeDriver: false,
            }),
          ])
        ),
      ]).start();
      
      // Start timer
      recordingTimer.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  // Stop recording and send
  const stopRecordingAndSend = async () => {
    if (!recording.current || !isRecording) return;
    
    try {
      await recording.current.stopAndUnloadAsync();
      const uri = recording.current.getURI();
      
      // Clean up
      cleanup();
      
      // Send the voice message
      if (uri && recordingDuration > 0 && !slideToCancel) {
        onSendVoiceMessage(uri, recordingDuration);
      } else if (slideToCancel) {
        onCancel?.();
      }
      
    } catch (error) {
      console.error('Failed to stop recording:', error);
      cleanup();
    }
  };

  // Cancel recording
  const cancelRecording = async () => {
    if (!recording.current) return;
    
    try {
      await recording.current.stopAndUnloadAsync();
      
      // Delete the file
      const uri = recording.current.getURI();
      if (uri) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      }
    } catch (error) {
      console.error('Failed to cancel recording:', error);
    }
    
    cleanup();
    onCancel?.();
  };

  // Cleanup function
  const cleanup = () => {
    setIsRecording(false);
    setSlideToCancel(false);
    setRecordingDuration(0);
    
    if (recordingTimer.current) {
      clearInterval(recordingTimer.current);
      recordingTimer.current = null;
    }
    
    recording.current = null;
    
    // Reset animations
    Animated.parallel([
      Animated.timing(recordingAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(slideAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
    
    waveformAnimation.stopAnimation();
    waveformAnimation.setValue(0);
  };

  // Pan responder for gesture handling
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startRecording();
      },
      onPanResponderMove: (event, gestureState) => {
        const { dx } = gestureState;
        
        // Update translateX animation
        translateX.setValue(dx);
        
        // Show slide to cancel when moved left
        if (dx < -50 && !slideToCancel) {
          setSlideToCancel(true);
          Animated.timing(slideAnimation, {
            toValue: 1,
            duration: 150,
            useNativeDriver: false,
          }).start();
        } else if (dx >= -50 && slideToCancel) {
          setSlideToCancel(false);
          Animated.timing(slideAnimation, {
            toValue: 0,
            duration: 150,
            useNativeDriver: false,
          }).start();
        }
      },
      onPanResponderRelease: (event, gestureState) => {
        const { dx } = gestureState;
        
        // If slid too far left, cancel
        if (dx < -100) {
          setSlideToCancel(true);
          cancelRecording();
        } else {
          stopRecordingAndSend();
        }
      },
    })
  ).current;

  // Format duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      {/* Recording overlay */}
      {isRecording && (
        <Animated.View 
          style={[
            styles.recordingOverlay,
            {
              opacity: recordingAnimation,
              backgroundColor: slideToCancel ? '#ff4444' : '#CD853F',
            }
          ]}
        >
          <View style={styles.recordingContent}>
            {/* Slide to cancel indicator */}
            <Animated.View
              style={[
                styles.slideIndicator,
                {
                  opacity: slideAnimation,
                  transform: [{
                    translateX: slideAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-20, 0],
                    }),
                  }],
                }
              ]}
            >
              <Text style={styles.slideText}>
                {slideToCancel ? '← Release to Cancel' : '← Slide to Cancel'}
              </Text>
            </Animated.View>

            {/* Recording duration */}
            <Text style={styles.durationText}>
              {formatDuration(recordingDuration)}
            </Text>

            {/* Waveform animation */}
            <View style={styles.waveform}>
              {[...Array(8)].map((_, i) => (
                <Animated.View
                  key={i}
                  style={[
                    styles.waveformBar,
                    {
                      height: waveformAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [4, 20 + Math.random() * 15],
                      }),
                    }
                  ]}
                />
              ))}
            </View>
          </View>
        </Animated.View>
      )}

      {/* Microphone button */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.micButton,
          {
            backgroundColor: isRecording ? '#ff4444' : '#CD853F',
            transform: [
              { translateX },
              {
                scale: recordingAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.2],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.micIcon}>🎤</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  recordingOverlay: {
    position: 'absolute',
    top: -60,
    left: -width / 2 + 25,
    right: -width / 2 + 25,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  recordingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  slideIndicator: {
    position: 'absolute',
    left: 20,
  },
  slideText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  durationText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 15,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
  },
  waveformBar: {
    width: 2,
    backgroundColor: 'white',
    marginHorizontal: 1,
    borderRadius: 1,
  },
  micButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  micIcon: {
    fontSize: 24,
  },
});
