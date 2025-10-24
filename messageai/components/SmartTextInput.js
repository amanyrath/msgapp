import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { detectLanguage } from '../utils/aiService';
import { useTranslation } from '../context/LocalizationContext';

/**
 * SmartTextInput - Enhanced text input with real-time language detection
 * Detects non-native language and notifies parent component
 */
export default function SmartTextInput({
  value,
  onChangeText,
  onLanguageDetected, // Callback to notify parent of language detection
  userNativeLanguage = 'English',
  placeholder,
  style,
  ...otherProps
}) {
  const t = useTranslation();
  const [detectedLanguage, setDetectedLanguage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showHighlight, setShowHighlight] = useState(false);
  const [inputHeight, setInputHeight] = useState(44); // Dynamic height - better default
  const heightAnim = useRef(new Animated.Value(44)).current;
  const detectionTimeoutRef = useRef(null);
  const highlightAnim = useRef(new Animated.Value(0)).current;

  // Debounced language detection
  useEffect(() => {
    console.log('🔤 SmartTextInput analyzing text:', value?.length, 'chars, userNativeLanguage:', userNativeLanguage);
    
    if (!value?.trim() || value.length < 10) {
      console.log('❌ Text too short, clearing detection');
      setDetectedLanguage(null);
      setShowHighlight(false);
      
      // Notify parent that no language detected
      if (onLanguageDetected) {
        onLanguageDetected({
          detected: false,
          language: null,
          confidence: 0,
          text: value
        });
      }
      return;
    }

    // Clear previous timeout
    if (detectionTimeoutRef.current) {
      clearTimeout(detectionTimeoutRef.current);
    }

    // Set new timeout for debounced detection
    detectionTimeoutRef.current = setTimeout(async () => {
      setIsAnalyzing(true);
      
      try {
        const result = await detectLanguage(value);
        
        if (result.success && result.confidence > 0.7) {
          console.log('🎯 Language detection result:', result);
          setDetectedLanguage(result);
          
          // Check if detected language is different from user's native language
          const isDifferentLanguage = result.language !== userNativeLanguage;
          
          console.log('🔍 Language comparison:', {
            detected: result.language,
            userNative: userNativeLanguage,
            isDifferent: isDifferentLanguage
          });
          
          setShowHighlight(isDifferentLanguage);
          
          // Notify parent component about language detection
          if (onLanguageDetected) {
            console.log('📢 Notifying parent of language detection:', {
              detected: isDifferentLanguage,
              language: result.language,
              confidence: result.confidence,
              text: value
            });
            onLanguageDetected({
              detected: isDifferentLanguage,
              language: result.language,
              confidence: result.confidence,
              text: value
            });
          }
          
          if (isDifferentLanguage) {
            // Animate highlight appearance
            Animated.timing(highlightAnim, {
              toValue: 1,
              duration: 300,
              useNativeDriver: false,
            }).start();
          }
        } else {
          setDetectedLanguage(null);
          setShowHighlight(false);
          
          // Notify parent that no different language detected
          if (onLanguageDetected) {
            onLanguageDetected({
              detected: false,
              language: null,
              confidence: 0,
              text: value
            });
          }
        }
      } catch (error) {
        console.error('Language detection error:', error);
        setDetectedLanguage(null);
        setShowHighlight(false);
        
        // Notify parent of detection failure
        if (onLanguageDetected) {
          onLanguageDetected({
            detected: false,
            language: null,
            confidence: 0,
            text: value,
            error: error.message
          });
        }
      } finally {
        setIsAnalyzing(false);
      }
    }, 1500); // 1.5 second delay for typing pause

    return () => {
      if (detectionTimeoutRef.current) {
        clearTimeout(detectionTimeoutRef.current);
      }
    };
  }, [value, userNativeLanguage]);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (detectionTimeoutRef.current) {
        clearTimeout(detectionTimeoutRef.current);
      }
    };
  }, []);

  // Handle content size change for dynamic height
  const handleContentSizeChange = (event) => {
    const { height } = event.nativeEvent.contentSize;
    // More generous sizing: Min 44px (better touch target), max 140px (more room)
    const newHeight = Math.max(44, Math.min(140, height + 24));
    
    // Smooth animation for height changes
    Animated.timing(heightAnim, {
      toValue: newHeight,
      duration: 150,
      useNativeDriver: false,
    }).start();
    
    setInputHeight(newHeight);
  };

  // Create highlight style
  const highlightStyle = {
    backgroundColor: highlightAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['transparent', 'rgba(255, 193, 7, 0.2)'], // Amber highlight
    }),
    borderColor: highlightAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['#e0e0e0', '#FFC107'], // Amber border
    }),
    borderWidth: highlightAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 2],
    }),
  };

  return (
    <View style={styles.container}>
      {/* Language detection indicator - now above the input */}
      {(isAnalyzing || showHighlight) && (
        <View style={styles.languageIndicator}>
          {isAnalyzing ? (
            <Text style={styles.indicatorText}>
              {t('detectingLanguage') || 'Detecting language...'}
            </Text>
          ) : showHighlight && detectedLanguage ? (
            <Text style={styles.indicatorText}>
              Language detected: {detectedLanguage.language}
            </Text>
          ) : null}
        </View>
      )}
      
      <Animated.View style={[styles.inputWrapper, highlightStyle]}>
        <Animated.View style={{ height: heightAnim }}>
          <TextInput
            style={[styles.input, style, { height: '100%' }]}
            placeholder={placeholder}
            value={value}
            onChangeText={onChangeText}
            onContentSizeChange={handleContentSizeChange}
            textAlignVertical="top"
            {...otherProps}
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inputWrapper: {
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  input: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    minHeight: 44,
    maxHeight: 140,
    fontSize: 16,
    backgroundColor: 'transparent',
    lineHeight: 20, // Better line spacing
  },
  languageIndicator: {
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.3)',
  },
  indicatorText: {
    fontSize: 12,
    color: '#B8860B',
    fontWeight: '600',
  },
});
