import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated
} from 'react-native';
import { translateText } from '../utils/aiService';
import { useLocalization } from '../context/LocalizationContext';
import { getPreGeneratedTranslation } from '../utils/proactiveTranslation';
import { getTranslationWithCache } from '../utils/simpleTranslationCache';

/**
 * InlineTranslation - Shows "See translation" link below messages
 * Supports progressive disclosure: translation first, then cultural context
 * 
 * PRIVACY: All translations are CLIENT-SIDE ONLY
 * - Translation views are personal and private to each user
 * - NO data is synced to Firestore or shared with other users
 * - Each user sees their own personal translation overlays only
 * Expands to show translation + cultural context when tapped
 */
export default function InlineTranslation({
  messageId,
  messageText,
  userLanguage = 'English',
  chatLanguage = 'Spanish',
  chatId,
  preGeneratedTranslations = {},
  translationState = null,
  onToggle,
  translateAllEnabled = false,
  autoExpand = false,
  style = {}
}) {
  const { t } = useLocalization();
  const [translationData, setTranslationData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  
  // Three-step disclosure states: hidden -> translation -> full context
  const [currentStep, setCurrentStep] = useState(autoExpand ? 1 : 0); // Auto-expand to translation if enabled

  // Animate in when component mounts
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  // Auto-expand when translate all mode is enabled
  useEffect(() => {
    if (autoExpand && currentStep === 0) {
      setCurrentStep(1); // Auto-show translation
    } else if (!autoExpand && translateAllEnabled === false && currentStep > 0) {
      // Reset when translate all is disabled (but not when just autoExpand is false)
      setCurrentStep(0);
    }
  }, [autoExpand, translateAllEnabled]);

  // Load translation when needed (step 1 or 2)
  useEffect(() => {
    if (currentStep >= 1 && !translationData && !loading) {
      loadTranslation();
    }
  }, [currentStep]);
  
  // Sync with parent translation state
  useEffect(() => {
    if (translationState?.expanded && currentStep === 0) {
      setCurrentStep(1); // Show translation if parent says expanded
    } else if (!translationState?.expanded && currentStep > 0) {
      setCurrentStep(0); // Hide if parent says not expanded
    }
  }, [translationState?.expanded]);

  const loadTranslation = async () => {
    if (!messageText || loading) return;

    setLoading(true);
    setError(null);

    try {
      let result = null;
      
      // 1. Check enhanced memory cache first
      try {
        result = await getTranslationWithCache(messageId, messageText, userLanguage, chatLanguage);
        if (result && result.success) {
          const cacheStatus = result.fromCache ? 'MEMORY CACHE' : 'LIVE API (cached)';
          console.log(`🚀 Translation loaded via ${cacheStatus} for message:`, messageId);
        }
      } catch (error) {
        console.warn('Enhanced cache failed, using fallback methods:', error);
      }
      
      // Fallback 1: Check client-side pre-generated translations
      if (!result && preGeneratedTranslations[messageId]) {
        result = preGeneratedTranslations[messageId];
        console.log('🚀 Using pre-generated translation from props for message:', messageId);
      }
      
      // Fallback 2: Check proactive translation cache  
      if (!result && chatId) {
        result = getPreGeneratedTranslation(chatId, messageId, userLanguage, translateAllEnabled);
        if (result) {
          console.log('🚀 Using pre-generated translation from cache for message:', messageId);
        }
      }
      
      // Fallback 3: Generate new translation via API
      if (!result) {
        console.log('🌐 Generating new inline translation for message:', messageId);
        
        result = await translateText({
          text: messageText,
          targetLanguage: userLanguage,
          sourceLanguage: chatLanguage,
          formality: 'casual',
          culturalContext: {
            chatContext: 'Inline message translation',
            inline: true,
            onDemand: true,
            responseLanguage: userLanguage, // Ensure AI responds in user's language
            userInterfaceLanguage: userLanguage // Cultural context in user's language
          }
        });
      }

      if (result && result.success) {
        setTranslationData(result);
        const source = result.fromCache ? 'cached' : 'live API';
        console.log(`✅ Inline translation loaded successfully (${source})`);
      } else {
        setError(result?.error || 'Translation failed');
        console.error('❌ Inline translation failed:', result?.error);
      }
    } catch (err) {
      setError(err.message);
      console.error('❌ Inline translation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    let nextStep;
    
    if (currentStep === 0) {
      // First click: Show translation
      nextStep = 1;
      if (!translationData && !loading) {
        loadTranslation();
      }
    } else if (currentStep === 1) {
      // Second click: Show full cultural context  
      nextStep = 2;
    } else {
      // Third click: Hide everything
      nextStep = 0;
    }
    
    setCurrentStep(nextStep);
    
    // Update parent state for persistence
    if (onToggle) {
      onToggle(messageId, nextStep > 0);
    }
  };

  const renderTranslationContent = () => {
    if (loading) {
      return (
        <View style={styles.translationContent}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.loadingText}>{t('translating')}...</Text>
          </View>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.translationContent}>
          <Text style={styles.errorText}>
            {t('translationFailed')}: {error}
          </Text>
        </View>
      );
    }

    if (!translationData) {
      return null;
    }

    return (
      <View style={styles.translationContent}>
        {/* Translation Section - Always shown when expanded */}
        <View style={styles.translationSection}>
          <View style={styles.translationHeader}>
            <Text style={styles.translationHeaderText}>
              🌐 {t('translation')} ({chatLanguage} → {userLanguage})
            </Text>
            {translationData.confidence && (
              <Text style={styles.confidenceText}>
                {Math.round(translationData.confidence * 100)}%
              </Text>
            )}
          </View>
          <Text style={styles.translationText}>
            {translationData.translation}
          </Text>
        </View>

        {/* Cultural Context Section - Only shown in step 2 (full context mode) */}
        {currentStep >= 2 && translationData.culturalNotes && translationData.culturalNotes.length > 0 && (
          <View style={styles.culturalSection}>
            <Text style={styles.culturalHeaderText}>
              🏛️ {t('culturalContext')}
            </Text>
            {translationData.culturalNotes.map((note, index) => (
              <Text key={index} style={styles.culturalNote}>
                • {note}
              </Text>
            ))}
          </View>
        )}

        {/* Formality Adjustment - Only shown in step 2 */}
        {currentStep >= 2 && translationData.formalityAdjustment && (
          <View style={styles.formalitySection}>
            <Text style={styles.formalityHeaderText}>
              🎩 {t('formalityNote')}
            </Text>
            <Text style={styles.formalityText}>
              {translationData.formalityAdjustment}
            </Text>
          </View>
        )}

        {/* Regional Considerations - Only shown in step 2 */}
        {currentStep >= 2 && translationData.regionalConsiderations && (
          <View style={styles.regionalSection}>
            <Text style={styles.regionalHeaderText}>
              🗺️ {t('regionalNotes')}
            </Text>
            <Text style={styles.regionalText}>
              {translationData.regionalConsiderations}
            </Text>
          </View>
        )}
      </View>
    );
  };

  // Determine button text based on current step
  const getButtonText = () => {
    if (currentStep === 0) {
      return t('seeTranslation') || 'See translation';
    } else if (currentStep === 1) {
      return t('seeCulturalContext') || 'See cultural context';
    } else {
      return t('hideTranslation') || 'Hide';
    }
  };

  return (
    <Animated.View style={[styles.container, style, { opacity: fadeAnim }]}>
      {/* See Translation Button - Now styled to appear underneath message */}
      <TouchableOpacity 
        style={styles.toggleButton} 
        onPress={handleToggle}
        activeOpacity={0.7}
      >
        <Text style={styles.toggleButtonText}>
          {getButtonText()}
        </Text>
      </TouchableOpacity>

      {/* Translation Content - Show when step >= 1 */}
      {currentStep >= 1 && renderTranslationContent()}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
    marginBottom: 8,
    width: '100%', // Full width to appear clearly below message
  },
  toggleButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14, // Better touch target
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 122, 255, 0.1)', // Slightly more visible background
    borderRadius: 16,
    marginLeft: 0, // No left margin for better alignment below message
    marginTop: 2,
  },
  toggleButtonText: {
    color: '#007AFF',
    fontSize: 13, // iOS caption size
    fontWeight: '500', // Lighter weight like iOS
  },
  translationContent: {
    marginTop: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: '#666',
    fontSize: 14,
    fontStyle: 'italic',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    fontStyle: 'italic',
  },
  translationSection: {
    marginBottom: 12,
  },
  translationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  translationHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  confidenceText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  translationText: {
    fontSize: 16, // Slightly larger for better readability
    color: '#1a1a1a', // Darker for better contrast
    lineHeight: 22,
    fontWeight: '400',
  },
  culturalSection: {
    marginBottom: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  culturalHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E44AD',
    marginBottom: 4,
  },
  culturalNote: {
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
    marginBottom: 2,
  },
  formalitySection: {
    marginBottom: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  formalityHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E67E22',
    marginBottom: 4,
  },
  formalityText: {
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
  },
  regionalSection: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  regionalHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#27AE60',
    marginBottom: 4,
  },
  regionalText: {
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
  },
});
