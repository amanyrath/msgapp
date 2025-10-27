import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTranslation } from '../context/LocalizationContext';
import { translateText, detectLanguage, rewriteTone } from '../utils/aiService';

/**
 * SmartTextAssistant - Modal for tone adjustment and text improvement suggestions
 * Appears when user clicks on highlighted non-native language text
 */
export default function SmartTextAssistant({
  visible,
  onClose,
  textData, // { text, detectedLanguage, userNativeLanguage }
  onTextUpdate, // Callback when user selects improved text
}) {
  const t = useTranslation();
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError] = useState(null);

  // Generate suggestions when modal opens
  useEffect(() => {
    if (visible && textData?.text) {
      generateSuggestions();
    }
  }, [visible, textData]);

  const generateSuggestions = async () => {
    if (!textData?.text) return;

    setLoading(true);
    setError(null);
    setSuggestions([]);

    try {
      const { text, detectedLanguage, userNativeLanguage } = textData;

      // Generate multiple suggestions
      const suggestionPromises = [
        // 1. Make more casual
        generateToneSuggestion(text, detectedLanguage.language, 'casual'),
        
        // 2. Make more formal
        generateToneSuggestion(text, detectedLanguage.language, 'formal'),
        
        // 3. Make more natural
        generateNaturalnessSuggestion(text, detectedLanguage.language),
        
        // 4. Show equivalent in native language for tone understanding
        generateNativeLanguageEquivalent(text, detectedLanguage.language, userNativeLanguage),
      ];

      const results = await Promise.allSettled(suggestionPromises);
      
      const newSuggestions = results
        .map((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            return result.value;
          }
          return null;
        })
        .filter(Boolean);

      setSuggestions(newSuggestions);

      if (newSuggestions.length === 0) {
        setError(t('noSuggestionsAvailable') || 'No suggestions available at the moment.');
      }

    } catch (error) {
      console.error('Error generating suggestions:', error);
      setError(t('errorGeneratingSuggestions') || 'Error generating suggestions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Generate tone-adjusted suggestion
  const generateToneSuggestion = async (text, language, tone) => {
    try {
      const result = await rewriteTone({
        text: text,
        targetTone: tone,
        language: language
      });

      if (result.success) {
        return {
          type: 'tone',
          label: tone === 'casual' ? 
            (t('makeCasual') || '😊 Make more casual') : 
            (t('makeFormal') || '🎩 Make more formal'),
          originalText: text,
          suggestedText: result.rewrittenText,
          explanation: tone === 'casual' ? 
            (t('casualExplanation') || 'This version sounds more relaxed and friendly') :
            (t('formalExplanation') || 'This version sounds more professional and polite'),
          confidence: 0.95, // High confidence for focused rewriting
        };
      }
    } catch (error) {
      console.error(`Error generating ${tone} suggestion:`, error);
    }
    return null;
  };

  // Generate naturalness suggestion
  const generateNaturalnessSuggestion = async (text, language) => {
    try {
      // Use rewriteTone with 'casual' to make text more natural
      const result = await rewriteTone({
        text: text,
        targetTone: 'casual', // Casual tone tends to be more natural
        language: language
      });

      if (result.success && result.rewrittenText !== text) {
        return {
          type: 'natural',
          label: t('makeNatural') || '🌟 Make more natural',
          originalText: text,
          suggestedText: result.rewrittenText,
          explanation: t('naturalExplanation') || 'This version sounds more natural for native speakers',
          confidence: 0.90,
        };
      }
    } catch (error) {
      console.error('Error generating naturalness suggestion:', error);
    }
    return null;
  };

  // Generate native language equivalent for tone understanding
  const generateNativeLanguageEquivalent = async (text, sourceLanguage, nativeLanguage) => {
    if (sourceLanguage === nativeLanguage) return null;

    try {
      const result = await translateText({
        text: text,
        targetLanguage: nativeLanguage,
        sourceLanguage: sourceLanguage,
        formality: 'casual',
        culturalContext: {
          operation: 'tone_equivalent_translation',
          preserveTone: true,
          showFormality: true
        }
      });

      if (result.success) {
        return {
          type: 'equivalent',
          label: t('seeInYourLanguage', { language: nativeLanguage }) || 
                 `🌍 See in ${nativeLanguage}`,
          originalText: text,
          suggestedText: result.translation,
          explanation: t('equivalentExplanation') || 
                      'This shows how your message sounds in your native language',
          confidence: result.confidence,
          isTranslation: true,
        };
      }
    } catch (error) {
      console.error('Error generating native language equivalent:', error);
    }
    return null;
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion) => {
    if (suggestion.isTranslation) {
      // For translations, just show the equivalent - don't replace the original
      Alert.alert(
        t('toneReference') || 'Tone Reference',
        t('toneReferenceMessage') || 'This translation helps you understand the tone of your message. Your original text will remain unchanged.',
        [{ text: t('ok') || 'OK' }]
      );
    } else {
      // For improvements, ask if user wants to replace
      Alert.alert(
        t('replaceText') || 'Replace Text?',
        t('replaceTextMessage') || 'Would you like to replace your text with this suggestion?',
        [
          { text: t('cancel') || 'Cancel', style: 'cancel' },
          {
            text: t('replace') || 'Replace',
            onPress: () => {
              onTextUpdate(suggestion.suggestedText);
              onClose();
            }
          }
        ]
      );
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {t('smartTextAssistant') || '🤖 Smart Text Assistant'}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Original text */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('yourText') || 'Your Text'}
            </Text>
            <View style={styles.textContainer}>
              <Text style={styles.originalText}>{textData?.text}</Text>
              <Text style={styles.languageLabel}>
                {t('detectedAs') || 'Detected as'}: {textData?.detectedLanguage?.language}
              </Text>
            </View>
          </View>

          {/* Loading state */}
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#CD853F" />
              <Text style={styles.loadingText}>
                {t('analyzingText') || 'Analyzing your text...'}
              </Text>
            </View>
          )}

          {/* Error state */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={generateSuggestions} style={styles.retryButton}>
                <Text style={styles.retryButtonText}>
                  {t('tryAgain') || 'Try Again'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t('suggestions') || 'Suggestions'}
              </Text>
              {suggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionCard}
                  onPress={() => handleSuggestionSelect(suggestion)}
                >
                  <Text style={styles.suggestionLabel}>{suggestion.label}</Text>
                  <Text style={styles.suggestionText}>{suggestion.suggestedText}</Text>
                  <Text style={styles.explanationText}>{suggestion.explanation}</Text>
                  {suggestion.confidence && (
                    <Text style={styles.confidenceText}>
                      {t('confidence') || 'Confidence'}: {Math.round(suggestion.confidence * 100)}%
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  textContainer: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  originalText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#333',
    marginBottom: 8,
  },
  languageLabel: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff5f5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fed7d7',
  },
  errorText: {
    fontSize: 14,
    color: '#e53e3e',
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#CD853F',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  suggestionCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  suggestionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#CD853F',
    marginBottom: 8,
  },
  suggestionText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#333',
    marginBottom: 8,
  },
  explanationText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  confidenceText: {
    fontSize: 11,
    color: '#999',
  },
});
