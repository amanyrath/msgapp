import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { processChatMessage, translateText } from '../utils/aiService';
import { buildAIContext, filterMessagesByTimeRange } from '../utils/aiContext';
import { sendTranslationMessage, processBulkTranslation } from '../utils/aiFirestore';

/**
 * AIAssistant - Modal interface for AI interactions
 * Provides chat interface with AI and quick action suggestions
 */
export default function AIAssistant({
  visible,
  onClose,
  chatId,
  messages = [],
  userProfiles = [],
  currentUser
}) {
  const [aiMessages, setAiMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef(null);

  // Initialize AI conversation with context
  useEffect(() => {
    if (visible && messages.length > 0) {
      initializeAIContext();
    }
  }, [visible, messages]);

  const initializeAIContext = async () => {
    // Create welcome message with context-aware suggestions
    const contextualSuggestions = getContextualSuggestions();
    
    const welcomeMessage = {
      id: `ai-welcome-${Date.now()}`,
      text: `Hi! I'm your AI assistant for international communication. I can help you with:

${contextualSuggestions.map(s => `• ${s}`).join('\n')}

What would you like me to help you with?`,
      sender: 'ai',
      timestamp: new Date()
    };

    setAiMessages([welcomeMessage]);
  };

  const getContextualSuggestions = () => {
    const suggestions = [
      'Translate messages (last hour, day, or starting now)',
      'Explain cultural context and slang',
      'Suggest appropriate responses',
      'Analyze conversation patterns'
    ];

    // Add context-specific suggestions based on recent messages
    const recentText = messages.slice(-5).map(m => m.text).join(' ').toLowerCase();
    
    if (recentText.includes('rave') || recentText.includes('dj') || recentText.includes('music')) {
      suggestions.push('Explain music/rave terminology');
    }
    
    if (recentText.match(/[¿¡ñáéíóúü]/)) {
      suggestions.push('Help with Spanish communication');
    }

    return suggestions.slice(0, 5); // Limit to 5 suggestions
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      text: inputText.trim(),
      sender: 'user',
      timestamp: new Date()
    };

    setAiMessages(prev => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      // Build context for AI
      const aiContext = buildAIContext({
        messages,
        chatInfo: { id: chatId, type: messages.length > 2 ? 'group' : 'direct' },
        participants: userProfiles,
        currentUser,
        operation: 'chat'
      });

      // Get AI response
      const response = await processChatMessage({
        userMessage: userMessage.text,
        chatContext: messages.slice(-10), // Last 10 messages for context
        userPreferences: aiContext.userPreferences
      });

      if (response.success) {
        const aiResponse = {
          id: `ai-${Date.now()}`,
          text: response.message,
          sender: 'ai',
          timestamp: new Date()
        };

        setAiMessages(prev => [...prev, aiResponse]);

        // Check if this is a translation request
        await handleSpecialCommands(userMessage.text, response.message);
      } else {
        throw new Error(response.error || 'AI response failed');
      }
    } catch (error) {
      console.error('AI Assistant error:', error);
      const errorMessage = {
        id: `ai-error-${Date.now()}`,
        text: 'Sorry, I encountered an error. Please try again.',
        sender: 'ai',
        timestamp: new Date(),
        isError: true
      };
      setAiMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleSpecialCommands = async (userText, aiResponse) => {
    const lowerText = userText.toLowerCase();
    
    // Check if user is asking for translation
    if (lowerText.includes('translate')) {
      // Check for specific timeframes
      if (lowerText.includes('hour ago') || lowerText.includes('last hour')) {
        await handleTranslationRequest('hour');
      } else if (lowerText.includes('day ago') || lowerText.includes('last day') || lowerText.includes('24')) {
        await handleTranslationRequest('day');
      } else if (lowerText.includes('starting now') || lowerText.includes('from now')) {
        await handleTranslationRequest('now');
      } else {
        // AI should ask for timeframe clarification
        const clarificationMessage = {
          id: `ai-clarify-${Date.now()}`,
          text: 'I can translate messages for you! Please specify the timeframe:\n\n• Last hour\n• Last 24 hours\n• Starting from now\n\nWhich would you like?',
          sender: 'ai',
          timestamp: new Date()
        };
        setAiMessages(prev => [...prev, clarificationMessage]);
      }
    }
  };

  const handleTranslationRequest = async (timeRange) => {
    try {
      setLoading(true);
      
      // Filter messages by time range
      const messagesToTranslate = filterMessagesByTimeRange(messages, timeRange);
      
      if (messagesToTranslate.length === 0) {
        const noMessagesResponse = {
          id: `ai-no-messages-${Date.now()}`,
          text: `No messages found in the specified timeframe (${timeRange}).`,
          sender: 'ai',
          timestamp: new Date()
        };
        setAiMessages(prev => [...prev, noMessagesResponse]);
        return;
      }

      // Start bulk translation
      const startMessage = {
        id: `ai-translation-start-${Date.now()}`,
        text: `Starting translation of ${messagesToTranslate.length} messages from ${timeRange}. This may take a moment...`,
        sender: 'ai',
        timestamp: new Date()
      };
      setAiMessages(prev => [...prev, startMessage]);

      // Process translations in the background
      const results = await processBulkTranslation(
        chatId,
        messagesToTranslate,
        'English', // Default target language - could be made configurable
        'casual',
        currentUser,
        (progress, total) => {
          // Update progress in real-time
          const progressMessage = {
            id: `ai-progress-${Date.now()}`,
            text: `Translating... ${progress}/${total} messages processed.`,
            sender: 'ai',
            timestamp: new Date()
          };
          setAiMessages(prev => {
            const filtered = prev.filter(m => !m.id.startsWith('ai-progress-'));
            return [...filtered, progressMessage];
          });
        }
      );

      const successCount = results.filter(r => r.success).length;
      const completionMessage = {
        id: `ai-translation-complete-${Date.now()}`,
        text: `Translation complete! Successfully translated ${successCount} out of ${messagesToTranslate.length} messages. Check your chat for the translations.`,
        sender: 'ai',
        timestamp: new Date()
      };
      
      setAiMessages(prev => {
        const filtered = prev.filter(m => !m.id.startsWith('ai-progress-'));
        return [...filtered, completionMessage];
      });
      
    } catch (error) {
      console.error('Translation request error:', error);
      const errorMessage = {
        id: `ai-translation-error-${Date.now()}`,
        text: 'Sorry, I encountered an error while processing the translation. Please try again.',
        sender: 'ai',
        timestamp: new Date(),
        isError: true
      };
      setAiMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleFormalityAdjustment = async (userText) => {
    try {
      setLoading(true);
      
      const recentMessages = messages.slice(-5).filter(msg => msg.type !== 'ai');
      if (recentMessages.length === 0) {
        const noMessagesResponse = {
          id: `ai-no-messages-${Date.now()}`,
          text: 'No recent messages to adjust for formality.',
          sender: 'ai',
          timestamp: new Date()
        };
        setAiMessages(prev => [...prev, noMessagesResponse]);
        return;
      }

      const formalityLevel = userText.toLowerCase().includes('formal') ? 'formal' : 'casual';
      
      const { translateText } = await import('../utils/aiService');
      
      const adjustmentPromises = recentMessages.map(async (msg) => {
        if (!msg.text) return null;
        
        const result = await translateText({
          text: msg.text,
          targetLanguage: 'Same language',
          formality: formalityLevel,
          culturalContext: {
            chatContext: 'formality adjustment'
          }
        });
        
        return {
          original: msg.text,
          adjusted: result.translation || msg.text,
          sender: msg.senderName || 'User'
        };
      });
      
      const adjustments = (await Promise.all(adjustmentPromises)).filter(Boolean);
      
      let responseText = `🎩 Formality Adjustment (${formalityLevel}):\n\n`;
      adjustments.forEach((adj) => {
        responseText += `**${adj.sender}**: "${adj.original}"\n`;
        responseText += `→ "${adj.adjusted}"\n\n`;
      });
      
      const adjustmentMessage = {
        id: `ai-formality-${Date.now()}`,
        text: responseText,
        sender: 'ai',
        timestamp: new Date()
      };
      
      setAiMessages(prev => [...prev, adjustmentMessage]);
      
    } catch (error) {
      console.error('Formality adjustment error:', error);
      const errorMessage = {
        id: `ai-formality-error-${Date.now()}`,
        text: 'Sorry, I encountered an error adjusting formality. Please try again.',
        sender: 'ai',
        timestamp: new Date(),
        isError: true
      };
      setAiMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleCulturalExplanation = async () => {
    try {
      setLoading(true);
      
      const recentMessages = messages.slice(-10).filter(msg => msg.type !== 'ai');
      if (recentMessages.length === 0) {
        const noMessagesResponse = {
          id: `ai-no-cultural-${Date.now()}`,
          text: 'No recent messages to analyze for cultural context.',
          sender: 'ai',
          timestamp: new Date()
        };
        setAiMessages(prev => [...prev, noMessagesResponse]);
        return;
      }

      const { explainCulturalContext } = await import('../utils/aiService');
      
      const conversationText = recentMessages.map(msg => msg.text).join(' ');
      
      const result = await explainCulturalContext({
        text: conversationText,
        userLanguage: currentUser?.nativeLanguage || 'English',
        context: {
          location: 'International chat',
          conversationType: messages.length > 2 ? 'group' : 'direct'
        }
      });
      
      if (result.success && result.explanations && result.explanations.length > 0) {
        let explanationText = '🌍 Cultural Context Analysis:\n\n';
        
        result.explanations.forEach(exp => {
          explanationText += `• **${exp.term}** (${exp.category}):\n  ${exp.explanation}\n`;
          if (exp.culturalContext) {
            explanationText += `  🎆 ${exp.culturalContext}\n`;
          }
          explanationText += '\n';
        });
        
        if (result.overallContext) {
          explanationText += `💬 **Overall Context**: ${result.overallContext}\n\n`;
        }
        
        if (result.suggestions && result.suggestions.length > 0) {
          explanationText += '💡 **Tips for Better Communication**:\n';
          result.suggestions.forEach(tip => {
            explanationText += `• ${tip}\n`;
          });
        }
        
        const culturalMessage = {
          id: `ai-cultural-${Date.now()}`,
          text: explanationText,
          sender: 'ai',
          timestamp: new Date()
        };
        
        setAiMessages(prev => [...prev, culturalMessage]);
      } else {
        const noContextMessage = {
          id: `ai-no-cultural-context-${Date.now()}`,
          text: 'I didn\'t detect any specific cultural references or slang in the recent messages. The conversation appears to use standard language. Feel free to ask about specific words or phrases!',
          sender: 'ai',
          timestamp: new Date()
        };
        
        setAiMessages(prev => [...prev, noContextMessage]);
      }
      
    } catch (error) {
      console.error('Cultural explanation error:', error);
      const errorMessage = {
        id: `ai-cultural-error-${Date.now()}`,
        text: 'Sorry, I encountered an error analyzing cultural context. Please try again.',
        sender: 'ai',
        timestamp: new Date(),
        isError: true
      };
      setAiMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = async (action) => {
    let message = '';
    
    switch (action) {
      case 'translate_hour':
        message = 'Please translate messages from the last hour';
        break;
      case 'translate_day':
        message = 'Please translate messages from the last day';
        break;
      case 'translate_now':
        message = 'Please translate messages starting now';
        break;
      case 'explain_context':
        message = 'Can you explain any cultural context or slang in recent messages?';
        break;
      case 'suggest_replies':
        await handleSmartReplies();
        return;
      case 'formality_casual':
        message = 'Please adjust the tone of recent messages to be more casual';
        break;
      case 'formality_formal':
        message = 'Please adjust the tone of recent messages to be more formal';
        break;
      case 'cultural_tips':
        message = 'Can you give me cultural tips for better communication in this conversation?';
        break;
      default:
        return;
    }

    setInputText(message);
  };

  const handleSmartReplies = async () => {
    try {
      setLoading(true);
      
      const recentMessages = messages.slice(-10).filter(msg => msg.type !== 'ai');
      if (recentMessages.length === 0) {
        const noMessagesResponse = {
          id: `ai-no-replies-${Date.now()}`,
          text: 'No recent messages to generate replies for.',
          sender: 'ai',
          timestamp: new Date()
        };
        setAiMessages(prev => [...prev, noMessagesResponse]);
        return;
      }

      const { generateSmartReplies } = await import('../utils/aiService');
      
      const culturalContext = {
        location: 'International conversation',
        recentTopics: extractTopicsFromMessages(recentMessages),
        conversationStyle: analyzeConversationStyle(recentMessages)
      };
      
      const result = await generateSmartReplies({
        conversationHistory: recentMessages,
        targetLanguage: 'English',
        formality: 'casual',
        culturalContext
      });
      
      if (result.success && result.replies && result.replies.length > 0) {
        let repliesText = '💡 Smart Reply Suggestions:\n\n';
        
        result.replies.forEach((reply, index) => {
          repliesText += `**Option ${index + 1}** (${reply.tone}):\n`;
          repliesText += `"${reply.text}"\n`;
          if (reply.explanation) {
            repliesText += `→ ${reply.explanation}\n`;
          }
          repliesText += '\n';
        });
        
        if (result.culturalTips && result.culturalTips.length > 0) {
          repliesText += '🌍 **Cultural Communication Tips:**\n';
          result.culturalTips.forEach(tip => {
            repliesText += `• ${tip}\n`;
          });
        }
        
        const repliesMessage = {
          id: `ai-smart-replies-${Date.now()}`,
          text: repliesText,
          sender: 'ai',
          timestamp: new Date()
        };
        
        setAiMessages(prev => [...prev, repliesMessage]);
      } else {
        const noRepliesMessage = {
          id: `ai-no-smart-replies-${Date.now()}`,
          text: 'I couldn\'t generate appropriate reply suggestions for this conversation. The context might be too complex or I might need more information.',
          sender: 'ai',
          timestamp: new Date()
        };
        
        setAiMessages(prev => [...prev, noRepliesMessage]);
      }
      
    } catch (error) {
      console.error('Smart replies error:', error);
      const errorMessage = {
        id: `ai-smart-replies-error-${Date.now()}`,
        text: 'Sorry, I encountered an error generating smart replies. Please try again.',
        sender: 'ai',
        timestamp: new Date(),
        isError: true
      };
      setAiMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const extractTopicsFromMessages = (msgs) => {
    const allText = msgs.map(m => m.text).join(' ').toLowerCase();
    const topics = [];
    
    if (allText.includes('rave') || allText.includes('dj') || allText.includes('techno') || allText.includes('music')) {
      topics.push('music/events');
    }
    if (allText.includes('work') || allText.includes('meeting') || allText.includes('project')) {
      topics.push('professional');
    }
    if (allText.includes('food') || allText.includes('restaurant') || allText.includes('dinner')) {
      topics.push('food/dining');
    }
    
    return topics;
  };

  const analyzeConversationStyle = (msgs) => {
    const allText = msgs.map(m => m.text).join(' ');
    const avgLength = allText.length / msgs.length;
    const hasEmojis = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(allText);
    const hasSlang = /\b(lol|omg|btw|imo|tbh|ngl)\b/i.test(allText);
    
    if (hasSlang && hasEmojis) return 'very_casual';
    if (hasEmojis || avgLength < 50) return 'casual';
    if (avgLength > 100) return 'formal';
    return 'neutral';
  };

  const renderMessage = ({ item }) => (
    <View style={[
      styles.messageContainer,
      item.sender === 'user' ? styles.userMessage : styles.aiMessage,
      item.isError && styles.errorMessage
    ]}>
      <Text style={[
        styles.messageText,
        item.sender === 'user' ? styles.userMessageText : styles.aiMessageText
      ]}>
        {item.text}
      </Text>
      <Text style={styles.timestamp}>
        {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );

  const scrollToBottom = () => {
    if (flatListRef.current && aiMessages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [aiMessages]);

  if (!visible) return null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI Assistant</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>Done</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickActions}>
        <TouchableOpacity 
          style={styles.quickActionButton}
          onPress={() => handleQuickAction('translate_hour')}
        >
          <Text style={styles.quickActionText}>🕐 Translate 1h</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.quickActionButton}
          onPress={() => handleQuickAction('translate_day')}
        >
          <Text style={styles.quickActionText}>📅 Translate 24h</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.quickActionButton}
          onPress={() => handleQuickAction('explain_context')}
        >
          <Text style={styles.quickActionText}>🌍 Explain</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.quickActionButton}
          onPress={() => handleQuickAction('suggest_replies')}
        >
          <Text style={styles.quickActionText}>💡 Suggest</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.quickActionButton}
          onPress={() => handleQuickAction('formality_casual')}
        >
          <Text style={styles.quickActionText}>😊 Casual</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.quickActionButton}
          onPress={() => handleQuickAction('formality_formal')}
        >
          <Text style={styles.quickActionText}>🎩 Formal</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.quickActionButton}
          onPress={() => handleQuickAction('cultural_tips')}
        >
          <Text style={styles.quickActionText}>🌟 Tips</Text>
        </TouchableOpacity>
      </ScrollView>

      <KeyboardAvoidingView 
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <FlatList
          ref={flatListRef}
          data={aiMessages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={scrollToBottom}
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Ask me anything..."
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || loading) && styles.sendButtonDisabled
            ]}
            onPress={handleSendMessage}
            disabled={!inputText.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={styles.sendButtonText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
    backgroundColor: 'white',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  closeButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  quickActions: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  quickActionButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
  },
  quickActionText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  messageContainer: {
    marginVertical: 4,
    maxWidth: '85%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    borderRadius: 16,
    borderBottomRightRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'white',
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e1e5e9',
  },
  errorMessage: {
    backgroundColor: '#ffebee',
    borderColor: '#f44336',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  userMessageText: {
    color: 'white',
  },
  aiMessageText: {
    color: '#333',
  },
  timestamp: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e1e5e9',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});
