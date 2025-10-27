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

/**
 * AITranslationMessage - Renders AI translation as a message bubble from the sender
 * Appears below the original message and looks like it's from the same person
 */
export default function AITranslationMessage({
  originalMessage,
  senderName,
  isFromCurrentUser = false,
  userLanguage = 'English',
  targetLanguage, // NEW: explicit target language prop
  chatLanguage = 'Spanish',
  chatId,
  preGeneratedTranslations = {},
  onHide,
  style = {}
}) {
  // Use targetLanguage if provided, fallback to userLanguage
  const translationTargetLang = targetLanguage || userLanguage;
  const { t } = useLocalization();
  const [translationData, setTranslationData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  
  // Two-step disclosure states
  const [showFullContext, setShowFullContext] = useState(false);

  // Animate in when component mounts
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  // Load translation when component mounts
  useEffect(() => {
    if (!translationData && !loading) {
      loadTranslation();
    }
  }, []);

  const loadTranslation = async () => {
    if (!originalMessage?.text || loading) return;

    setLoading(true);
    setError(null);

    try {
      // First, check for pre-generated translation
      let result = null;
      
      if (preGeneratedTranslations[originalMessage.id]) {
        result = preGeneratedTranslations[originalMessage.id];
        console.log('🚀 Using pre-generated translation for AI message:', originalMessage.id);
      } else if (chatId) {
        result = getPreGeneratedTranslation(chatId, originalMessage.id, translationTargetLang);
        if (result) {
          console.log('🚀 Using cached translation for AI message:', originalMessage.id);
        }
      }
      
      // If no pre-generated translation, generate one now
      if (!result) {
        console.log('🌐 Generating new translation for AI message:', originalMessage.id);
        
        result = await translateText({
          text: originalMessage.text,
          targetLanguage: translationTargetLang, // Use the correct target language
          sourceLanguage: chatLanguage,
          formality: 'casual',
          culturalContext: {
            chatContext: 'AI message translation',
            messageId: originalMessage.id,
            responseLanguage: translationTargetLang, // Ensure AI responses are in target language
            userInterfaceLanguage: translationTargetLang
          }
        });
      }

      if (result && result.success) {
        setTranslationData(result);
        console.log('✅ AI translation message loaded successfully');
      } else {
        setError(result?.error || 'Translation failed');
        console.error('❌ AI translation message failed:', result?.error);
      }
    } catch (err) {
      setError(err.message);
      console.error('❌ AI translation message error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCulturalContext = () => {
    setShowFullContext(!showFullContext);
  };

  const formatTime = (timestamp) => {
    if (!timestamp?.toDate) return '';
    const date = timestamp.toDate();
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={isFromCurrentUser ? "#fff" : "#CD853F"} />
          <Text style={[styles.loadingText, { color: isFromCurrentUser ? "#fff" : "#333" }]}>
            {t('translating')}...
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <Text style={[styles.errorText, { color: isFromCurrentUser ? "#fff" : "#FF3B30" }]}>
          ⚠️ {t('translationFailed')}: {error}
        </Text>
      );
    }

    if (!translationData) return null;

    return (
      <View style={styles.contentContainer}>
        {/* AI Indicator and Translation */}
        <View style={styles.translationSection}>
          <View style={styles.aiHeader}>
            <Text style={[styles.aiIndicator, { color: isFromCurrentUser ? "rgba(255,255,255,0.8)" : "#CD853F" }]}>
              🤖 {t('translation')}
            </Text>
            {translationData.confidence && (
              <Text style={[styles.confidenceText, { color: isFromCurrentUser ? "rgba(255,255,255,0.6)" : "#666" }]}>
                {Math.round(translationData.confidence * 100)}%
              </Text>
            )}
          </View>
          
          <Text style={[styles.translationText, { color: isFromCurrentUser ? "#fff" : "#000" }]}>
            {translationData.translation}
          </Text>

          {/* See cultural context button */}
          {(translationData.culturalNotes?.length > 0 || 
            translationData.formalityAdjustment || 
            translationData.regionalConsiderations) && (
            <TouchableOpacity 
              style={[styles.contextButton, { 
                backgroundColor: isFromCurrentUser ? "rgba(255,255,255,0.2)" : "rgba(0,122,255,0.1)" 
              }]} 
              onPress={handleToggleCulturalContext}
              activeOpacity={0.7}
            >
              <Text style={[styles.contextButtonText, { 
                color: isFromCurrentUser ? "#fff" : "#CD853F" 
              }]}>
                {showFullContext ? t('hideCulturalContext') || 'Hide cultural context' : t('seeCulturalContext') || 'See cultural context'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Cultural Context Section - Only shown when expanded */}
        {showFullContext && (
          <View style={styles.culturalContextSection}>
            {translationData.culturalNotes && translationData.culturalNotes.length > 0 && (
              <View style={styles.culturalNotes}>
                <Text style={[styles.sectionHeader, { color: isFromCurrentUser ? "rgba(255,255,255,0.9)" : "#8E44AD" }]}>
                  🏛️ {t('culturalContext')}
                </Text>
                {translationData.culturalNotes.map((note, index) => (
                  <Text key={index} style={[styles.noteText, { color: isFromCurrentUser ? "rgba(255,255,255,0.85)" : "#555" }]}>
                    • {note}
                  </Text>
                ))}
              </View>
            )}

            {translationData.formalityAdjustment && (
              <View style={styles.formalityNote}>
                <Text style={[styles.sectionHeader, { color: isFromCurrentUser ? "rgba(255,255,255,0.9)" : "#E67E22" }]}>
                  🎩 {t('formalityNote')}
                </Text>
                <Text style={[styles.noteText, { color: isFromCurrentUser ? "rgba(255,255,255,0.85)" : "#555" }]}>
                  {translationData.formalityAdjustment}
                </Text>
              </View>
            )}

            {translationData.regionalConsiderations && (
              <View style={styles.regionalNote}>
                <Text style={[styles.sectionHeader, { color: isFromCurrentUser ? "rgba(255,255,255,0.9)" : "#27AE60" }]}>
                  🗺️ {t('regionalNotes')}
                </Text>
                <Text style={[styles.noteText, { color: isFromCurrentUser ? "rgba(255,255,255,0.85)" : "#555" }]}>
                  {translationData.regionalConsiderations}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Message Footer */}
        <View style={styles.messageFooter}>
          <Text style={[styles.timeText, { color: isFromCurrentUser ? "rgba(255,255,255,0.7)" : "#666" }]}>
            {formatTime(originalMessage.timestamp)}
          </Text>
          <TouchableOpacity 
            style={styles.hideButton} 
            onPress={onHide}
            activeOpacity={0.7}
          >
            <Text style={[styles.hideButtonText, { color: isFromCurrentUser ? "rgba(255,255,255,0.8)" : "#666" }]}>
              ✕
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Animated.View style={[styles.container, style, { opacity: fadeAnim }]}>
      <View style={[
        styles.messageContainer,
        isFromCurrentUser ? styles.myMessageContainer : styles.theirMessageContainer,
      ]}>
        <View style={[
          styles.messageBubble,
          isFromCurrentUser ? styles.myMessageBubble : styles.theirMessageBubble,
        ]}>
          {renderContent()}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    flexDirection: 'row',
  },
  messageContainer: {
    flexDirection: 'row',
  },
  myMessageContainer: {
    justifyContent: 'flex-end',
  },
  theirMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  myMessageBubble: {
    backgroundColor: '#CD853F',
    borderBottomRightRadius: 4,
  },
  theirMessageBubble: {
    backgroundColor: '#E5E5EA',
    borderBottomLeftRadius: 4,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  contentContainer: {
    width: '100%',
  },
  translationSection: {
    marginBottom: 8,
  },
  aiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiIndicator: {
    fontSize: 13,
    fontWeight: '600',
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '500',
  },
  translationText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400',
  },
  contextButton: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  contextButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  culturalContextSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  culturalNotes: {
    marginBottom: 8,
  },
  formalityNote: {
    marginBottom: 8,
  },
  regionalNote: {
    marginBottom: 8,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  noteText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 2,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  timeText: {
    fontSize: 11,
  },
  hideButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  hideButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
