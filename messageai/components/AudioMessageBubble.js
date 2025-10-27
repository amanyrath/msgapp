import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';

/**
 * AudioMessageBubble - Apple-style audio message playback component
 * Features:
 * - Play/pause toggle
 * - Progress visualization
 * - Duration display
 * - Loading states
 * - Auto-cleanup
 */
export default function AudioMessageBubble({
  audioUri,
  duration,
  isOwn = false,
  timestamp,
  senderName,
  onPlayStateChange, // Callback for managing multiple audio players
  isPlaying = false,
  playbackPosition = 0,
  style = {},
}) {
  const [sound, setSound] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [localIsPlaying, setLocalIsPlaying] = useState(isPlaying);
  const [localPosition, setLocalPosition] = useState(playbackPosition);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  
  // Animation for waveform
  const waveformAnimation = useRef(new Animated.Value(0)).current;
  const progressAnimation = useRef(new Animated.Value(0)).current;

  // Create sound object when component mounts
  useEffect(() => {
    let soundObject = null;
    
    const createSound = async () => {
      try {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: audioUri },
          { shouldPlay: false },
          onPlaybackStatusUpdate
        );
        soundObject = newSound;
        setSound(newSound);
      } catch (error) {
        console.error('Error creating sound:', error);
      }
    };

    if (audioUri) {
      createSound();
    }

    return () => {
      if (soundObject) {
        soundObject.unloadAsync();
      }
    };
  }, [audioUri]);

  // Handle playback status updates
  const onPlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      setLocalPosition(status.positionMillis || 0);
      setTotalDuration(status.durationMillis || duration || 0);
      setLocalIsPlaying(status.isPlaying);
      
      // Update progress animation
      const progress = status.durationMillis > 0 
        ? (status.positionMillis || 0) / status.durationMillis 
        : 0;
      
      Animated.timing(progressAnimation, {
        toValue: progress,
        duration: 100,
        useNativeDriver: false,
      }).start();
      
      // If finished playing, notify parent
      if (status.didJustFinish) {
        onPlayStateChange?.(false, audioUri);
      }
    }
  };

  // Toggle play/pause
  const togglePlayback = async () => {
    if (!sound) return;
    
    setIsLoading(true);
    
    try {
      const status = await sound.getStatusAsync();
      
      if (status.isLoaded) {
        if (status.isPlaying) {
          // Pause current audio
          await sound.pauseAsync();
          onPlayStateChange?.(false, audioUri);
        } else {
          // Stop any other playing audio first
          onPlayStateChange?.(true, audioUri);
          
          // If at end, restart from beginning
          if (status.positionMillis === status.durationMillis) {
            await sound.setPositionAsync(0);
          }
          
          // Start playing
          await sound.playAsync();
        }
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Stop playback (called by parent when other audio starts)
  const stopPlayback = async () => {
    if (sound) {
      try {
        const status = await sound.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await sound.pauseAsync();
        }
      } catch (error) {
        console.error('Error stopping playback:', error);
      }
    }
  };

  // Expose stop method to parent
  useEffect(() => {
    if (!localIsPlaying && isPlaying) {
      stopPlayback();
    }
  }, [isPlaying, localIsPlaying]);

  // Format time from milliseconds
  const formatTime = (millis) => {
    const seconds = Math.floor(millis / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Generate waveform visualization
  const generateWaveform = () => {
    const bars = [];
    const barCount = 12;
    
    for (let i = 0; i < barCount; i++) {
      const progress = totalDuration > 0 ? localPosition / totalDuration : 0;
      const isActive = i / barCount <= progress;
      
      bars.push(
        <View
          key={i}
          style={[
            styles.waveformBar,
            {
              height: 12 + Math.sin(i * 0.8) * 8,
              backgroundColor: isActive 
                ? (isOwn ? '#ffffff' : '#CD853F') 
                : (isOwn ? '#ffffff80' : '#CD853F40'),
            }
          ]}
        />
      );
    }
    
    return bars;
  };

  const bubbleStyle = [
    styles.bubble,
    isOwn ? styles.ownBubble : styles.otherBubble,
    style,
  ];

  return (
    <View style={bubbleStyle}>
      {/* Sender name for group chats */}
      {!isOwn && senderName && (
        <Text style={styles.senderName}>{senderName}</Text>
      )}

      <View style={styles.audioContent}>
        {/* Play/Pause Button */}
        <TouchableOpacity 
          onPress={togglePlayback} 
          style={styles.playButton}
          disabled={isLoading || !sound}
        >
          {isLoading ? (
            <ActivityIndicator 
              size="small" 
              color={isOwn ? '#ffffff' : '#CD853F'} 
            />
          ) : (
            <Text style={[
              styles.playIcon,
              { color: isOwn ? '#ffffff' : '#CD853F' }
            ]}>
              {localIsPlaying ? '⏸️' : '▶️'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Waveform */}
        <View style={styles.waveform}>
          {generateWaveform()}
        </View>

        {/* Duration */}
        <Text style={[
          styles.duration,
          { color: isOwn ? '#ffffff' : '#666666' }
        ]}>
          {formatTime(localIsPlaying ? localPosition : totalDuration)}
        </Text>
      </View>

      {/* Timestamp */}
      <Text style={[
        styles.timestamp,
        { color: isOwn ? '#ffffff80' : '#999999' }
      ]}>
        {timestamp}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 18,
    marginVertical: 2,
  },
  ownBubble: {
    backgroundColor: '#CD853F',
    alignSelf: 'flex-end',
    marginLeft: '20%',
  },
  otherBubble: {
    backgroundColor: '#f0f0f0',
    alignSelf: 'flex-start',
    marginRight: '20%',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#CD853F',
    marginBottom: 4,
  },
  audioContent: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 200,
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  playIcon: {
    fontSize: 16,
  },
  waveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 24,
    marginHorizontal: 8,
  },
  waveformBar: {
    width: 2,
    borderRadius: 1,
    minHeight: 4,
  },
  duration: {
    fontSize: 12,
    fontWeight: '500',
    minWidth: 35,
    textAlign: 'right',
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
});

