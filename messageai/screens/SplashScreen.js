import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { Logger } from '../utils/logger';

const { width, height } = Dimensions.get('window');

/**
 * SplashScreen - Introduces MessageAI and its purpose
 * Shows before main app loads, explains the value proposition
 */
export default function SplashScreen({ onComplete }) {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));

  useEffect(() => {
    Logger.ui('SplashScreen mounted');
    
    // Animate in the splash content
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-complete after 3 seconds
    const timer = setTimeout(() => {
      Logger.ui('SplashScreen auto-completing after 3s');
      onComplete();
    }, 3000);

    return () => clearTimeout(timer);
  }, [fadeAnim, slideAnim, onComplete]);

  return (
    <View style={styles.container}>
      <Animated.View 
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }
        ]}
      >
        {/* App Icon */}
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>💬</Text>
          <Text style={styles.iconBg}>✨</Text>
        </View>

        {/* App Name */}
        <Text style={styles.appName}>MessageAI</Text>
        
        {/* Tagline */}
        <Text style={styles.tagline}>
          Real-time messaging platform
        </Text>

        {/* Value Proposition */}
        <View style={styles.features}>
          <FeatureItem icon="🚀" text="Instant messaging across devices" />
          <FeatureItem icon="👥" text="Smart group conversations" />
          <FeatureItem icon="🔒" text="Secure & reliable messaging" />
          <FeatureItem icon="📱" text="Native mobile experience" />
        </View>

        {/* Target Persona */}
        <Text style={styles.persona}>
          Built for teams and individuals who need{'\n'}
          reliable, real-time communication
        </Text>

        {/* Loading indicator */}
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </Animated.View>
    </View>
  );
}

/**
 * Individual feature item component
 */
function FeatureItem({ icon, text }) {
  return (
    <View style={styles.featureItem}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
    maxWidth: width * 0.8,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  icon: {
    fontSize: 80,
    textAlign: 'center',
  },
  iconBg: {
    position: 'absolute',
    top: -10,
    right: -10,
    fontSize: 30,
    opacity: 0.8,
  },
  appName: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 40,
    textAlign: 'center',
    fontWeight: '500',
  },
  features: {
    alignSelf: 'stretch',
    marginBottom: 30,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 10,
  },
  featureIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  featureText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    flex: 1,
  },
  persona: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 40,
    fontStyle: 'italic',
  },
  loading: {
    marginTop: 20,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
});
