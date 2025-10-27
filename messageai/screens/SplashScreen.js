import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import logger from '../utils/logger';

const { width, height } = Dimensions.get('window');

/**
 * SplashScreen - Introduces Babble and its purpose
 * Shows before main app loads, explains the value proposition
 */
export default function SplashScreen({ onComplete }) {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));

  useEffect(() => {
    logger.ui('SplashScreen mounted');
    
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

    // Auto-complete after shorter delay for faster startup
    const timer = setTimeout(() => {
      logger.ui('SplashScreen auto-completing after 800ms');
      onComplete();
    }, 800); // Reduced from 3000ms to 800ms for faster app launch

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
        <Text style={styles.appName}>Babble</Text>
        
        {/* Multilingual Tagline */}
        <View style={styles.multilingualContainer}>
          <Text style={styles.taglineEnglish}>Now everyone speaks your language</Text>
          <Text style={styles.taglineOther}>الآن الجميع يتحدث لغتك</Text>
          <Text style={styles.taglineOther}>이제 모두가 당신의 언어를 말합니다</Text>
          <Text style={styles.taglineOther}>Теперь все говорят на вашем языке</Text>
          <Text style={styles.taglineOther}>Jetzt spricht jeder Ihre Sprache</Text>
        </View>

        {/* Value Proposition */}
        <View style={styles.features}>
          <FeatureItem icon="🚀" text="Instant messaging across devices" />
          <FeatureItem icon="👥" text="Smart group conversations" />
          <FeatureItem icon="🔒" text="Secure & reliable messaging" />
          <FeatureItem icon="📱" text="Native mobile experience" />
        </View>

        {/* Target Persona */}
        <Text style={styles.persona}>
          Built for teams and individuals who need{'\n'}reliable, real-time communication
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
    backgroundColor: '#DEB887', // Lighter desert sand background
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
    color: '#8B4513', // Saddle brown for better contrast on desert background
    marginBottom: 8,
    textAlign: 'center',
  },
  multilingualContainer: {
    marginBottom: 40,
    alignItems: 'center',
  },
  taglineEnglish: {
    fontSize: 18,
    color: '#8B4513', // Saddle brown for main tagline
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 8,
  },
  taglineOther: {
    fontSize: 14,
    color: '#A0522D', // Desert brown for other languages
    textAlign: 'center',
    fontWeight: '400',
    marginBottom: 4,
    opacity: 0.85,
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
    color: '#8B4513', // Desert brown for feature text
    flex: 1,
  },
  persona: {
    fontSize: 14,
    color: '#A0522D', // Desert brown for persona text
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 40,
    fontStyle: 'italic',
  },
  loading: {
    marginTop: 20,
  },
  loadingText: {
    color: '#A0522D', // Desert brown for loading text
    fontSize: 14,
  },
});
