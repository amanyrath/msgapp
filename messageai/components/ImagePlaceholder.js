import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated
} from 'react-native';

/**
 * Reusable image placeholder component with shimmer effect
 */
export default function ImagePlaceholder({ 
  width = 200, 
  height = 200, 
  showSpinner = true,
  iconSize = 24,
  backgroundColor = '#f0f0f0',
  shimmerColor = '#e0e0e0'
}) {
  const [shimmerAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    const shimmerAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    shimmerAnimation.start();
    return () => shimmerAnimation.stop();
  }, [shimmerAnim]);

  return (
    <View 
      style={[
        styles.placeholder, 
        { 
          width, 
          height, 
          backgroundColor 
        }
      ]}
    >
      <Animated.View
        style={[
          styles.shimmer,
          {
            backgroundColor: shimmerColor,
            opacity: shimmerAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.3, 0.7],
            }),
          }
        ]}
      />
      <View style={styles.placeholderContent}>
        <Text style={[styles.placeholderIcon, { fontSize: iconSize }]}>📷</Text>
        {showSpinner && (
          <ActivityIndicator 
            size="small" 
            color="#CD853F" 
            style={styles.spinner} 
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
  },
  placeholderContent: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  placeholderIcon: {
    opacity: 0.5,
    marginBottom: 8,
  },
  spinner: {
    opacity: 0.7,
  },
});
