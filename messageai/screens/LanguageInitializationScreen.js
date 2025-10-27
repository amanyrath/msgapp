import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Animated, Dimensions } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useLocalization } from '../context/LocalizationContext';

const { width, height } = Dimensions.get('window');

/**
 * LanguageInitializationScreen - Shows a brief splash screen after login
 * to ensure user's language preferences are fully loaded before navigation
 */
export default function LanguageInitializationScreen({ onComplete }) {
  const { user } = useAuth();
  const { userLanguagePreference, isLoading, isInitialized, initializeUserLanguage, t } = useLocalization();
  const [initializationComplete, setInitializationComplete] = useState(false);
  const [timeoutReached, setTimeoutReached] = useState(false);
  const [forcedInitialization, setForcedInitialization] = useState(false);
  
  // Animations
  const [sunGlow] = useState(new Animated.Value(0.8));
  const [starTwinkle] = useState(new Animated.Value(0.6));
  const [fadeAnim] = useState(new Animated.Value(0));
  const [contentOpacity] = useState(new Animated.Value(0));
  const [progressAnim] = useState(new Animated.Value(0.3));
  
  // Stable content to prevent flashing
  const [displayText, setDisplayText] = useState('Setting Up Experience');
  const [minDisplayTime, setMinDisplayTime] = useState(false);
  
  // Ref to prevent multiple initialization calls
  const initializationStartedRef = useRef(false);
  const completionTriggeredRef = useRef(false);

  // Start animations and ensure smooth entrance
  useEffect(() => {
    // Smooth entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 800,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Ensure minimum display time to prevent flashing
    setTimeout(() => {
      setMinDisplayTime(true);
    }, 1000); // Minimum 1 second display

    // Smooth progress animation
    Animated.timing(progressAnim, {
      toValue: 0.7,
      duration: 1500,
      useNativeDriver: false, // Width changes can't use native driver
    }).start();

    // Sun glow animation (slower to reduce distraction)
    Animated.loop(
      Animated.sequence([
        Animated.timing(sunGlow, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(sunGlow, {
          toValue: 0.8,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Star twinkle animation (gentler)
    Animated.loop(
      Animated.sequence([
        Animated.timing(starTwinkle, {
          toValue: 0.9,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(starTwinkle, {
          toValue: 0.5,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [sunGlow, starTwinkle, fadeAnim, contentOpacity]);

  useEffect(() => {
    let timeoutId = null;
    
    // Check cache status and set appropriate timeout
    (async () => {
      let timeoutDuration = 8000; // Default 8 seconds
      
      try {
        const { getCachedUserLanguagePreference } = await import('../utils/languageIntegration');
        if (user?.uid) {
          const cachedLanguage = await getCachedUserLanguagePreference(user.uid);
          if (cachedLanguage) {
            timeoutDuration = 8000; // 8 second timeout for cached data
            console.log('⏱️ Using timeout (8s) - cached data available');
          } else {
            console.log('⏱️ Using normal timeout (8s) - need server fetch');
          }
        }
      } catch (error) {
        console.log('⏱️ Using normal timeout (8s) - cache check failed');
      }
      
      // Set the timeout with determined duration
      timeoutId = setTimeout(() => {
        console.log('⏰ Language initialization timeout reached:', timeoutDuration + 'ms');
        setTimeoutReached(true);
      }, timeoutDuration);
    })();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [user?.uid]);

  // Force language initialization when screen is shown - run only once
  useEffect(() => {
    if (user?.uid && !initializationStartedRef.current) {
      console.log('🔄 LanguageInitializationScreen: Starting initialization for user:', user.uid);
      initializationStartedRef.current = true;
      setForcedInitialization(true);
      
      // Force language initialization regardless of cache state
      initializeUserLanguage(user.uid, true).then(() => {
        console.log('✅ LanguageInitializationScreen: Initialization completed');
      }).catch((error) => {
        console.error('❌ LanguageInitializationScreen: Initialization failed:', error);
      });
    }
  }, [user?.uid, initializeUserLanguage]); // Safe dependencies

  // Stable text updates to prevent flashing
  useEffect(() => {
    if (!forcedInitialization) {
      setDisplayText(t('initializingLanguageSystem') || 'Initializing language system...');
    } else if (isLoading) {
      setDisplayText(t('loadingLanguagePreferences') || 'Loading language preferences...');
      // Animate progress further when loading
      Animated.timing(progressAnim, {
        toValue: 0.85,
        duration: 800,
        useNativeDriver: false,
      }).start();
    } else if (userLanguagePreference) {
      setDisplayText(`Setting up interface in ${userLanguagePreference}...`);
      // Near completion
      Animated.timing(progressAnim, {
        toValue: 0.95,
        duration: 500,
        useNativeDriver: false,
      }).start();
    } else {
      setDisplayText(t('preparingInterface') || 'Preparing your personalized interface...');
    }
  }, [forcedInitialization, isLoading, userLanguagePreference, t, progressAnim]);

  useEffect(() => {
    // Check if initialization is complete - prevent multiple completions
    if (user?.uid && isInitialized && !isLoading && forcedInitialization && userLanguagePreference && minDisplayTime && !completionTriggeredRef.current) {
      console.log('✅ Language initialization completed:', userLanguagePreference);
      completionTriggeredRef.current = true;
      
      // Complete directly with fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        console.log('🏁 LanguageInitializationScreen: Completing initialization');
        onComplete();
      });
    }
  }, [user?.uid, isInitialized, isLoading, userLanguagePreference, forcedInitialization, minDisplayTime, fadeAnim, onComplete]);

  useEffect(() => {
    // Handle timeout completion - only once
    if (timeoutReached && minDisplayTime && !completionTriggeredRef.current) {
      completionTriggeredRef.current = true;
      console.log('⏰ Timeout reached, completing initialization');
      onComplete();
    }
  }, [timeoutReached, minDisplayTime, onComplete]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Desert Background */}
      <View style={styles.backgroundLayer}>
        {/* Desert dunes */}
        <View style={styles.dune1} />
        <View style={styles.dune2} />
        <View style={styles.dune3} />
        
        {/* Desert elements */}
        <Text style={styles.cactus}>🌵</Text>
        <Animated.Text style={[styles.sun, { opacity: sunGlow }]}>☀️</Animated.Text>
        <View style={styles.stars}>
          <Animated.Text style={[styles.star, { opacity: starTwinkle }]}>✨</Animated.Text>
          <Animated.Text style={[styles.star, styles.star2, { opacity: starTwinkle }]}>✨</Animated.Text>
          <Animated.Text style={[styles.star, styles.star3, { opacity: starTwinkle }]}>✨</Animated.Text>
        </View>
      </View>

      {/* Content overlay */}
      <View style={styles.contentOverlay}>
        <Animated.View style={[styles.content, { opacity: contentOpacity }]}>
          {/* Clean loading indicator */}
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <View style={styles.loadingRing} />
          </View>
          
          <Text style={styles.title}>Setting Up Experience</Text>
          <Text style={styles.subtitle}>{displayText}</Text>
          
          {/* Smooth progress indicator */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <Animated.View 
                style={[
                  styles.progressFill, 
                  { 
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  }
                ]} 
              />
            </View>
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  backgroundLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FF7F50', // Sunset orange sky
  },
  // Desert dunes
  dune1: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.35,
    backgroundColor: '#F4A460', // Sandy brown
    borderTopLeftRadius: width * 2,
    borderTopRightRadius: width * 2,
    transform: [{ scaleX: 2 }],
  },
  dune2: {
    position: 'absolute',
    bottom: 0,
    right: -50,
    width: width * 0.8,
    height: height * 0.25,
    backgroundColor: '#CD853F', // Darker sand
    borderTopLeftRadius: width,
    borderTopRightRadius: width,
    opacity: 0.9,
  },
  dune3: {
    position: 'absolute',
    bottom: 0,
    left: -30,
    width: width * 0.6,
    height: height * 0.18,
    backgroundColor: '#DEB887', // Light sand
    borderTopLeftRadius: width,
    borderTopRightRadius: width,
    opacity: 0.8,
  },
  // Desert elements
  sun: {
    position: 'absolute',
    top: height * 0.15,
    right: width * 0.15,
    fontSize: 60,
    textShadowColor: 'rgba(255, 255, 255, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  cactus: {
    position: 'absolute',
    bottom: height * 0.25,
    left: width * 0.1,
    fontSize: 40,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  stars: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.4,
  },
  star: {
    position: 'absolute',
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  star2: {
    top: height * 0.08,
    left: width * 0.3,
    fontSize: 12,
  },
  star3: {
    top: height * 0.12,
    right: width * 0.4,
    fontSize: 20,
  },
  // Content overlay
  contentOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)', // Subtle dark overlay
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
    maxWidth: width * 0.85,
  },
  // Loading indicator
  loadingContainer: {
    position: 'relative',
    marginBottom: 30,
  },
  loadingRing: {
    position: 'absolute',
    top: -15,
    left: -15,
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderTopColor: 'rgba(255, 255, 255, 0.8)',
  },
  // Text styles
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  // Progress indicator
  progressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressBar: {
    width: '80%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
});
