import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated
} from 'react-native';
import { fastTranslateText, translateText, explainCulturalContext } from '../utils/aiService';
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
  console.log('🔄 InlineTranslation rendered for messageId:', messageId, 'messageText:', messageText?.substring(0, 50) + '...', 'autoExpand:', autoExpand, 'chatLanguage:', chatLanguage);
  
  const { t } = useLocalization();
  const [translationData, setTranslationData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  
  // Request deduplication - prevent multiple simultaneous calls
  const [translationRequest, setTranslationRequest] = useState(null);
  
  // NEW: Cultural context state
  const [culturalContextData, setCulturalContextData] = useState(null);
  const [culturalLoading, setCulturalLoading] = useState(false);
  const [culturalError, setCulturalError] = useState(null);
  
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
    console.log('🔄 InlineTranslation autoExpand useEffect - autoExpand:', autoExpand, 'currentStep:', currentStep, 'translateAllEnabled:', translateAllEnabled);
    if (autoExpand && currentStep === 0) {
      console.log('🔄 Auto-expanding to step 1');
      setCurrentStep(1); // Auto-show translation
    } else if (!autoExpand && translateAllEnabled === false && currentStep > 0) {
      // Reset when translate all is disabled (but not when just autoExpand is false)
      console.log('🔄 Resetting to step 0');
      setCurrentStep(0);
    }
  }, [autoExpand, translateAllEnabled]);

  // Load translation when needed (step 1 or 2)
  useEffect(() => {
    if (currentStep >= 1 && !translationData && !loading) {
      loadTranslation();
    }
  }, [currentStep]);
  
  // Load cultural context when needed (step 2)
  useEffect(() => {
    if (currentStep >= 2 && !culturalContextData && !culturalLoading) {
      loadCulturalContext();
    }
  }, [currentStep]);
  
  // Sync with parent translation state (only if translationState is provided)
  useEffect(() => {
    if (!translationState) return; // Don't interfere if no state is provided
    
    if (translationState.expanded && currentStep === 0) {
      setCurrentStep(1); // Show translation if parent says expanded
    } else if (!translationState.expanded && currentStep > 0) {
      setCurrentStep(0); // Hide if parent says not expanded
    }
  }, [translationState?.expanded]);

  const loadTranslation = async () => {
    if (!messageText || loading) return;

    // Request deduplication - reuse existing request if in progress
    if (translationRequest) {
      console.log('⏳ Reusing existing translation request');
      try {
        const result = await translationRequest;
        return result;
      } catch (error) {
        console.warn('⚠️ Existing translation request failed:', error);
      }
    }

    setLoading(true);
    setError(null);

    // Create and store the translation request for deduplication
    const request = (async () => {
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
      
      // Fallback 3: Generate new FAST translation via API (no cultural analysis)
      if (!result) {
        console.log('⚡ Generating FAST translation for message:', messageId);
        
        result = await fastTranslateText({
          text: messageText,
          targetLanguage: userLanguage,
          sourceLanguage: chatLanguage,
          formality: 'casual'
        });
      }

      if (result && result.success) {
        setTranslationData(result);
        const source = result.fromCache ? 'cached' : 'live API';
        console.log(`✅ Inline translation loaded successfully (${source})`);
        return result;
      } else {
        setError(result?.error || 'Translation failed');
        console.error('❌ Inline translation failed:', result?.error);
        throw new Error(result?.error || 'Translation failed');
      }
    })();

    // Store the request for deduplication
    setTranslationRequest(request);

    try {
      const result = await request;
      return result;
    } catch (err) {
      setError(err.message);
      console.error('❌ Inline translation error:', err);
    } finally {
      setLoading(false);
      setTranslationRequest(null); // Clear the request when done
    }
  };

  // NEW: Load detailed cultural context using GPT-4o
  const loadCulturalContext = async () => {
    if (!messageText || culturalLoading || culturalContextData) return;

    setCulturalLoading(true);
    setCulturalError(null);

    try {
      console.log('🏛️ Requesting detailed cultural context for ORIGINAL message:', messageText);
      console.log('🏛️ User language for response:', userLanguage);
      console.log('🏛️ Current step:', currentStep);
      console.log('🏛️ CRITICAL: Analyzing ORIGINAL text, not any translation');
      
      const result = await explainCulturalContext({
        text: messageText, // CRITICAL: Use ORIGINAL message text, never translation  
        userLanguage: userLanguage, // User's native language for the response
        interfaceLanguage: userLanguage, // Ensure response is in user's language
        context: {
          location: 'International chat message',
          conversationType: 'direct message',
          chatContext: 'Cultural context explanation for original message'
        }
      });

      if (result && result.success) {
        setCulturalContextData(result);
        console.log('✅ Cultural context loaded successfully');
      } else {
        setCulturalError(result?.error || 'Cultural context analysis failed');
        console.error('❌ Cultural context failed:', result?.error);
      }
    } catch (err) {
      setCulturalError(err.message);
      console.error('❌ Cultural context error:', err);
    } finally {
      setCulturalLoading(false);
    }
  };

  const handleToggle = () => {
    let nextStep;
    
    console.log('🔄 InlineTranslation handleToggle - currentStep:', currentStep);
    
    if (currentStep === 0) {
      // First click: Show translation
      nextStep = 1;
      console.log('🔄 Going to step 1 (show translation)');
      if (!translationData && !loading) {
        loadTranslation();
      }
    } else if (currentStep === 1) {
      // Second click: Show full cultural context - NEW: Load detailed context
      nextStep = 2;
      console.log('🔄 Going to step 2 (show cultural context)');
      if (!culturalContextData && !culturalLoading) {
        console.log('🔄 Loading cultural context...');
        loadCulturalContext(); // Make GPT-4o request for detailed cultural analysis
      }
    } else {
      // Third click: Hide everything
      nextStep = 0;
      console.log('🔄 Going to step 0 (hide)');
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
            <ActivityIndicator size="small" color="#CD853F" />
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

        {/* Detailed Cultural Context Section - Only shown in step 2 with GPT-4o analysis */}
        {currentStep >= 2 && (
          <View style={styles.culturalSection}>
            <Text style={styles.culturalHeaderText}>
              🏛️ {t('culturalContext')}
            </Text>
            
            {culturalLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#8E44AD" />
                <Text style={styles.loadingText}>{t('analyzingCulturalContext') || 'Analyzing cultural context...'}</Text>
              </View>
            )}
            
            {culturalError && (
              <Text style={styles.errorText}>
                {t('culturalAnalysisFailed') || 'Cultural analysis failed'}: {culturalError}
              </Text>
            )}
            
            {culturalContextData && culturalContextData.culturalContext && (
              <Text style={styles.culturalNote}>
                {culturalContextData.culturalContext}
                      </Text>
            )}
            
            {/* Fallback: Show basic cultural notes if detailed context fails */}
            {!culturalContextData && !culturalLoading && !culturalError && translationData.culturalNotes && translationData.culturalNotes.length > 0 && (
              <View>
                <Text style={styles.fallbackNote}>Basic cultural notes:</Text>
            {translationData.culturalNotes.map((note, index) => (
              <Text key={index} style={styles.culturalNote}>
                • {note}
              </Text>
            ))}
          </View>
        )}
          </View>
        )}
      </View>
    );
  };

  // Determine button text based on current step
  const getButtonText = () => {
    const buttonText = currentStep === 0 ? (t('seeTranslation') || 'See translation') :
                      currentStep === 1 ? (t('seeCulturalContext') || 'See cultural context') :
                      (t('hideTranslation') || 'Hide');
    
    console.log('🔄 InlineTranslation getButtonText - currentStep:', currentStep, 'buttonText:', buttonText);
    return buttonText;
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
    color: '#CD853F',
    fontSize: 13, // iOS caption size
    fontWeight: '500', // Lighter weight like iOS
  },
  translationContent: {
    marginTop: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
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
    color: '#CD853F',
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
    marginTop: 8,
  },
  culturalHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  culturalNote: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  formalitySection: {
    marginTop: 8,
  },
  formalityHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  formalityText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  regionalSection: {
    marginTop: 8,
  },
  regionalHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  regionalText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  fallbackNote: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 4,
  },
});
