import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Animated,
} from 'react-native';
import { detectLanguage } from '../utils/aiService';

/**
 * SmartTextInput - Enhanced text input with language detection (no visual overlay)
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
  const [detectedLanguage, setDetectedLanguage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const heightAnim = useRef(new Animated.Value(44)).current;
  const detectionTimeoutRef = useRef(null);


  // Debounced language detection (no visual indicators)
  useEffect(() => {
    console.log('🔤 SmartTextInput analyzing text:', value?.length, 'chars, userNativeLanguage:', userNativeLanguage);
    
    if (!value?.trim() || value.length < 10) {
      console.log('❌ Text too short, clearing detection');
      setDetectedLanguage(null);
      
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
        } else {
          setDetectedLanguage(null);
          
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
  };


  return (
    <View style={styles.container}>
      <Animated.View style={styles.inputWrapper}>
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
});
