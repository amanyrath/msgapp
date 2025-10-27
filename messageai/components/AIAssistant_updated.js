import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Platform,
  TouchableWithoutFeedback
} from 'react-native';
import { processChatMessage, translateText, summarizeConversation } from '../utils/aiService';
import { buildAIContext } from '../utils/aiContext';
import { useLocalization } from '../context/LocalizationContext';
import { subscribeToConversationInsights } from '../utils/firestore';
import { 
  loadAIConversation, 
  saveAIConversation, 
  addMessageToAIConversation,
  cleanupOldAIConversations 
} from '../utils/aiConversationStorage';

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
  currentUser,
  autoTranslateSettings = { enabled: false, targetLanguage: 'English', formality: 'casual' },
  onNavigateToMessage // New prop to handle navigation to source message from insights
}) {
  const { languageName: userLanguage, t } = useLocalization();
  const [aiMessages, setAiMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const flatListRef = useRef(null);
  
  // Auto-translation state
  const [autoTranslateEnabled, setAutoTranslateEnabled] = useState(autoTranslateSettings.enabled);
  const [autoTranslateLanguage, setAutoTranslateLanguage] = useState(autoTranslateSettings.targetLanguage);
  const [autoTranslateFormality, setAutoTranslateFormality] = useState(autoTranslateSettings.formality);
  
  // Dropdown state
  const [showDropdown, setShowDropdown] = useState(false);
  
  // Tab state
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'insights'
  
  // Conversation insights state
  const [insights, setInsights] = useState([]);
  const [insightsLoading, setInsightsLoading] = useState(false);

  // Load AI conversation history when modal becomes visible
  useEffect(() => {
    if (visible && currentUser?.uid) {
      loadConversationHistory();
    }
  }, [visible, chatId, currentUser?.uid]);

  // Save conversation and cleanup when modal closes
  useEffect(() => {
    if (!visible) {
      // Save current conversation before closing
      if (aiMessages.length > 0 && currentUser?.uid) {
        saveConversationHistory();
      }
      
      setShowDropdown(false);
      setActiveTab('chat');
      setInsights([]);
      
      // Run cleanup periodically (only when closing modal to avoid performance impact)
      if (currentUser?.uid) {
        cleanupOldAIConversations(currentUser.uid).catch(error => {
          console.warn('⚠️ Cleanup error:', error);
        });
      }
    }
  }, [visible, aiMessages, currentUser?.uid, chatId]);

  // Subscribe to conversation insights when modal is visible
  useEffect(() => {
    if (!visible || !chatId) return;

    setInsightsLoading(true);
    
    // Process existing messages for insights if this is the first time opening
    const processBulkMessagesForInsights = async () => {
      if (messages.length > 0 && userProfiles.length > 0 && currentUser?.uid) {
        console.log('📊 Checking for bulk insights processing on', messages.length, 'messages');
        
        // Import the bulk processor
        const { processBulkMessages } = await import('../utils/insightsProcessor');
        
        // Process up to 15 most recent messages from other users
        await processBulkMessages(messages, chatId, currentUser.uid, userProfiles, 15);
      }
    };

    // Start bulk processing (non-blocking)
    processBulkMessagesForInsights().catch(error => {
      console.error('❌ Error in bulk insights processing:', error);
    });

    const unsubscribe = subscribeToConversationInsights(
      chatId,
      (insightsData) => {
        // Sort insights chronologically (most recent first)
        const sortedInsights = insightsData.sort((a, b) => 
          new Date(b.createdAt) - new Date(a.createdAt)
        );
        console.log('📊 Insights subscription updated:', sortedInsights.length, 'total insights');
        setInsights(sortedInsights);
        setInsightsLoading(false);
      }
    );

    return unsubscribe;
  }, [visible, chatId, messages.length, userProfiles.length, currentUser?.uid]);

  // Load conversation history from persistent storage
  const loadConversationHistory = useCallback(async () => {
    if (!chatId || !currentUser?.uid) return;
    
    setLoadingHistory(true);
    try {
      const savedMessages = await loadAIConversation(chatId, currentUser.uid);
      
      if (savedMessages && savedMessages.length > 0) {
        console.log('📱 Loaded AI conversation history:', savedMessages.length, 'messages');
        setAiMessages(savedMessages);
      } else {
        // No existing history, initialize with welcome message
        initializeAIContext();
      }
    } catch (error) {
      console.error('❌ Error loading AI conversation history:', error);
      // Fallback to fresh initialization
      initializeAIContext();
    } finally {
      setLoadingHistory(false);
    }
  }, [chatId, currentUser?.uid]);

  // Save conversation history to persistent storage
  const saveConversationHistory = useCallback(async () => {
    if (!chatId || !currentUser?.uid || aiMessages.length === 0) return;
    
    try {
      const success = await saveAIConversation(chatId, currentUser.uid, aiMessages);
      if (success) {
        console.log('📱 Saved AI conversation history:', aiMessages.length, 'messages');
      }
    } catch (error) {
      console.error('❌ Error saving AI conversation history:', error);
    }
  }, [chatId, currentUser?.uid, aiMessages]);

  // Save conversation history whenever messages change (debounced)
  useEffect(() => {
    if (aiMessages.length > 0 && currentUser?.uid && visible) {
      // Debounce saving to avoid too frequent writes
      const timeoutId = setTimeout(() => {
        saveConversationHistory();
      }, 2000); // Save 2 seconds after last message

      return () => clearTimeout(timeoutId);
    }
  }, [aiMessages, currentUser?.uid, visible, saveConversationHistory]);

  const initializeAIContext = useCallback(async () => {
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
  }, [getContextualSuggestions]); // Depend on the memoized function

  const getContextualSuggestions = useCallback(() => {
    const suggestions = [
      'Summarize chat history (last week, month, or all messages)',
      'Explain cultural context and slang',
      'Suggest appropriate responses',
      'Analyze conversation patterns',
      'Generate smart reply suggestions'
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
  }, [messages]);

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
        userPreferences: aiContext.userPreferences,
        userLanguage: userLanguage
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
    
    // Check if user is asking for summarization
    if (lowerText.includes('summarize') || lowerText.includes('summary')) {
      // Check for specific timeframes
      if (lowerText.includes('week')) {
        await handleSummaryRequest('last week');
      } else if (lowerText.includes('month')) {
        await handleSummaryRequest('last month');
      } else if (lowerText.includes('day') || lowerText.includes('today')) {
        await handleSummaryRequest('today');
      } else if (lowerText.includes('all') || lowerText.includes('everything')) {
        await handleSummaryRequest('all messages');
      } else {
        // AI should ask for timeframe clarification
        const clarificationMessage = {
          id: `ai-summary-clarify-${Date.now()}`,
          text: 'I can summarize the chat history for you! How long back would you like me to summarize?\n\n• The last week\n• The last month\n• Today only\n• All messages\n\nPlease let me know your preference.',
          sender: 'ai',
          timestamp: new Date()
        };
        setAiMessages(prev => [...prev, clarificationMessage]);
      }
    }
  };


  const handleSummaryRequest = async (timeRange) => {
    try {
      setLoading(true);
      
      // Filter messages by time range (use all messages for summary)
      let messagesToSummarize = messages.filter(msg => msg.type !== 'ai' && msg.text);
      
      if (messagesToSummarize.length === 0) {
        const noMessagesResponse = {
          id: `ai-no-messages-summary-${Date.now()}`,
          text: t('noMessagesSummaryTimeframe', { timeRange }) || `No messages found to summarize for the timeframe: ${timeRange}.`,
          sender: 'ai',
          timestamp: new Date()
        };
        setAiMessages(prev => [...prev, noMessagesResponse]);
        return;
      }

      // Start summary generation
      const startMessage = {
        id: `ai-summary-start-${Date.now()}`,
        text: `Starting to summarize chat history for ${timeRange}. This may take a moment...`,
        sender: 'ai',
        timestamp: new Date()
      };
      setAiMessages(prev => [...prev, startMessage]);

      // Determine target language - could be made configurable
      const targetLanguage = currentUser?.nativeLanguage || 'English';

      // Generate summary
      const result = await summarizeConversation({
        messages: messagesToSummarize,
        timeRange,
        targetLanguage,
        userPreferences: {
          nativeLanguage: targetLanguage,
          formality: 'casual'
        }
      });

      if (result.success) {
        let summaryText = `📋 **Chat Summary (${result.timeRange})**\n\n`;
        
        // Main summary
        summaryText += `${result.summary}\n\n`;
        
        // Key statistics
        summaryText += `📊 **Summary Statistics**:\n`;
        summaryText += `• Messages analyzed: ${result.summarizedMessageCount}\n`;
        summaryText += `• Time period: ${result.timeSpan || timeRange}\n`;
        summaryText += `• Active participants: ${result.participants?.join(', ') || 'Multiple users'}\n\n`;
        
        // Key topics if available
        if (result.keyTopics && result.keyTopics.length > 0) {
          summaryText += `🎯 **Main Topics Discussed**:\n`;
          result.keyTopics.forEach(topic => {
            summaryText += `• ${topic}\n`;
          });
          summaryText += '\n';
        }
        
        // Cultural highlights if available
        if (result.culturalHighlights && result.culturalHighlights.length > 0) {
          summaryText += `🌍 **Cultural Highlights**:\n`;
          result.culturalHighlights.forEach(highlight => {
            summaryText += `• ${highlight}\n`;
          });
          summaryText += '\n';
        }
        
        // Action items if available
        if (result.actionItems && result.actionItems.length > 0) {
          summaryText += `✅ **Action Items & Follow-ups**:\n`;
          result.actionItems.forEach(item => {
            summaryText += `• ${item}\n`;
          });
          summaryText += '\n';
        }
        
        // Languages mentioned if available
        if (result.languagesMentioned && result.languagesMentioned.length > 0) {
          summaryText += `🗣️ **Languages Detected**: ${result.languagesMentioned.join(', ')}\n`;
        }
        
        const summaryMessage = {
          id: `ai-summary-complete-${Date.now()}`,
          text: summaryText,
          sender: 'ai',
          timestamp: new Date()
        };
        
        setAiMessages(prev => {
          const filtered = prev.filter(m => !m.id.startsWith('ai-summary-start-'));
          return [...filtered, summaryMessage];
        });
        
      } else {
        const errorMessage = {
          id: `ai-summary-error-${Date.now()}`,
          text: `Sorry, I encountered an error while generating the summary: ${result.error}. Please try again.`,
          sender: 'ai',
          timestamp: new Date(),
          isError: true
        };
        setAiMessages(prev => {
          const filtered = prev.filter(m => !m.id.startsWith('ai-summary-start-'));
          return [...filtered, errorMessage];
        });
      }
      
    } catch (error) {
      console.error('Summary request error:', error);
      const errorMessage = {
        id: `ai-summary-error-${Date.now()}`,
        text: 'Sorry, I encountered an error while processing the summary. Please try again.',
        sender: 'ai',
        timestamp: new Date(),
        isError: true
      };
      setAiMessages(prev => {
        const filtered = prev.filter(m => !m.id.startsWith('ai-summary-start-'));
        return [...filtered, errorMessage];
      });
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
        let explanationText = '🌍 **Enhanced Cultural Analysis**:\n\n';
        
        result.explanations.forEach(exp => {
          explanationText += `🔍 **${exp.term}** (${exp.category})\n`;
          explanationText += `${exp.explanation}\n`;
          if (exp.culturalContext) {
            explanationText += `🏛️ **Cultural Background**: ${exp.culturalContext}\n`;
          }
          if (exp.regionalVariations) {
            explanationText += `🗺️ **Regional Notes**: ${exp.regionalVariations}\n`;
          }
          if (exp.appropriateUsage) {
            explanationText += `✅ **Usage Guide**: ${exp.appropriateUsage}\n`;
          }
          explanationText += '\n';
        });
        
        if (result.overallContext) {
          explanationText += `💬 **Overall Context**: ${result.overallContext}\n\n`;
        }
        
        // Enhanced cultural intelligence display
        if (result.culturalIntelligence) {
          explanationText += `🧠 **Cultural Intelligence**:\n`;
          if (result.culturalIntelligence.communicationStyle) {
            explanationText += `📊 Style: ${result.culturalIntelligence.communicationStyle}\n`;
          }
          if (result.culturalIntelligence.culturalPatterns?.length > 0) {
            explanationText += `🎭 Patterns: ${result.culturalIntelligence.culturalPatterns.join(', ')}\n`;
          }
          if (result.culturalIntelligence.potentialMisunderstandings?.length > 0) {
            explanationText += `⚠️ Watch for: ${result.culturalIntelligence.potentialMisunderstandings.join(', ')}\n`;
          }
          explanationText += '\n';
        }
        
        if (result.proactiveTips && result.proactiveTips.length > 0) {
          explanationText += '🎯 **Proactive Communication Tips**:\n';
          result.proactiveTips.forEach(tip => {
            explanationText += `• ${tip}\n`;
          });
          explanationText += '\n';
        }
        
        if (result.suggestions && result.suggestions.length > 0) {
          explanationText += '💡 **Additional Insights**:\n';
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
      case 'summarize_week':
        message = 'Please summarize the chat history from the last week';
        break;
      case 'summarize_day':
        message = 'Please summarize today\'s chat history';
        break;
      case 'summarize_all':
        message = 'Please summarize all our chat history';
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
      case 'rubric_demo':
        await handleRubricDemo();
        return;
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

  const handleRubricDemo = async () => {
    try {
      setLoading(true);
      
      const demoMessage = {
        id: `ai-rubric-demo-${Date.now()}`,
        text: `🎯 **International Communicator - AI Analysis Features**

This AI assistant provides advanced conversation analysis:

✅ **1. Cultural Context Analysis (Deep Insights)**
• Proactive analysis of slang, idioms, and cultural references
• Regional variations and appropriate usage guidance  
• Cultural intelligence analysis of communication patterns
• Context-specific explanations (music, professional, regional)

✅ **2. Formality Adjustment (Tone Optimization)**
• Casual ↔ Formal tone conversion with cultural sensitivity
• Regional cultural considerations (hierarchical vs. egalitarian)
• Direct vs. indirect communication style adaptation
• Before/after comparisons with detailed explanations

✅ **3. Slang/Idiom Explanations (Crystal Clear)**
• Enhanced visual displays with rich cultural background
• Categorized explanations: slang|idiom|cultural_reference|generational
• Regional variations and appropriate usage contexts
• Proactive communication improvement suggestions

✅ **4. Smart Reply Generation (Context-Aware)**
• Culturally appropriate response suggestions
• Conversation style analysis and tone matching
• Multiple options with cultural explanations

✅ **5. Conversation Summarization (Intelligent Overview)**
• Comprehensive chat history analysis
• Key topics, cultural highlights, and action items
• Timeframe-specific summaries (week, month, all messages)

🚀 **Advanced AI Capability**: Cross-cultural communication optimization with conversation analysis and cultural intelligence.

*Note: Real-time translation is handled by the app's dedicated localization system.*

Try any feature using the buttons above or natural language commands!`,
        sender: 'ai',
        timestamp: new Date()
      };
      
      setAiMessages(prev => [...prev, demoMessage]);
      
    } catch (error) {
      console.error('Rubric demo error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Memoized message component for better performance
  const renderMessage = useCallback(({ item }) => (
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
  ), []); // No dependencies - pure component

  const scrollToBottom = () => {
    if (flatListRef.current && aiMessages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [aiMessages]);

  // Handle navigation to source message from insight
  const handleInsightNavigation = (messageId) => {
    // Close the AI Assistant modal
    onClose();
    
    // Navigate to the source message (this will be handled by parent component)
    if (onNavigateToMessage) {
      onNavigateToMessage(messageId);
    }
  };

  // Format insight text for display
  const formatInsightText = (extraction) => {
    const typeEmoji = {
      'date': '📅',
      'location': '📍', 
      'action': '✅'
    };
    
    const urgencyColor = {
      'high': '#FF4444',
      'medium': '#FF9500',
      'low': '#34C759'
    };
    
    return {
      emoji: typeEmoji[extraction.type] || '💡',
      text: extraction.text,
      urgency: extraction.urgency,
      urgencyColor: urgencyColor[extraction.urgency] || '#666',
      sourceSnippet: extraction.sourceSnippet
    };
  };

  // Render insights content
  const renderInsightsContent = () => {
    if (insightsLoading) {
      return (
        <View style={styles.insightsContainer}>
          <ActivityIndicator size="large" color="#CD853F" />
          <Text style={styles.loadingText}>{t('loadingInsights') || 'Loading insights...'}</Text>
        </View>
      );
    }

    if (insights.length === 0) {
      return (
        <View style={styles.emptyInsightsContainer}>
          <Text style={styles.emptyInsightsIcon}>🔍</Text>
          <Text style={styles.emptyInsightsTitle}>{t('noInsightsYet') || 'No Insights Yet'}</Text>
          <Text style={styles.emptyInsightsText}>
            {t('insightsExplanation') || 'As your conversation grows, I\'ll automatically extract dates, locations, and action items to help you stay organized.'}
          </Text>
          
          {/* Test button for development */}
          {__DEV__ && (
            <TouchableOpacity
              style={styles.testButton}
              onPress={async () => {
                console.log('🧪 Testing structured data extraction...');
                const { extractStructuredData } = await import('../utils/aiService');
                const testMessage = "Let's meet tomorrow at 2 PM at Central Park for the birthday party. Don't forget to bring the cake!";
                
                const result = await extractStructuredData(testMessage, {
                  senderName: 'Test User',
                  timestamp: new Date(),
                  chatId: chatId
                });
                
                console.log('🧪 Test result:', result);
                Alert.alert(t('testResult') || 'Test Result', JSON.stringify(result, null, 2));
              }}
            >
              <Text style={styles.testButtonText}>🧪 {t('testAIExtraction') || 'Test AI Extraction'}</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    // Flatten all extractions from all insights with metadata
    const allExtractions = [];
    insights.forEach(insight => {
      insight.extractions?.forEach(extraction => {
        allExtractions.push({
          ...extraction,
          messageId: insight.messageId,
          senderName: insight.senderName,
          messageTimestamp: insight.messageTimestamp,
          insightId: insight.id
        });
      });
    });

    return (
      <FlatList
        data={allExtractions}
        keyExtractor={(item, index) => `${item.insightId}-${index}`}
        style={styles.insightsList}
        contentContainerStyle={styles.insightsContent}
        renderItem={({ item }) => {
          const formatted = formatInsightText(item);
          return (
            <TouchableOpacity
              style={styles.insightItem}
              onPress={() => handleInsightNavigation(item.messageId)}
              activeOpacity={0.7}
            >
              <View style={styles.insightHeader}>
                <Text style={styles.insightEmoji}>{formatted.emoji}</Text>
                <View style={styles.insightHeaderText}>
                  <Text style={styles.insightText}>{formatted.text}</Text>
                  <Text style={styles.insightMeta}>
                    {item.senderName} • {new Date(item.messageTimestamp).toLocaleDateString()}
                  </Text>
                </View>
                <View style={[styles.urgencyBadge, { backgroundColor: formatted.urgencyColor }]}>
                  <Text style={styles.urgencyText}>{t(item.urgency) || item.urgency}</Text>
                </View>
              </View>
              {formatted.sourceSnippet && (
                <Text style={styles.sourceSnippet}>"{formatted.sourceSnippet}"</Text>
              )}
            </TouchableOpacity>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.insightSeparator} />}
      />
    );
  };

  if (!visible) return null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('aiAssistant')}</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>{t('done')}</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'chat' && styles.activeTab]}
          onPress={() => setActiveTab('chat')}
        >
          <Text style={[styles.tabText, activeTab === 'chat' && styles.activeTabText]}>
            💬 {t('chat') || 'Chat'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'insights' && styles.activeTab]}
          onPress={() => setActiveTab('insights')}
        >
          <Text style={[styles.tabText, activeTab === 'insights' && styles.activeTabText]}>
            📊 {t('insights') || 'Insights'}
          </Text>
          {insights.length > 0 && (
            <View style={styles.insightsBadge}>
              <Text style={styles.insightsBadgeText}>{insights.reduce((count, insight) => count + (insight.extractions?.length || 0), 0)}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Quick Actions Dropdown - only show on chat tab */}
      {activeTab === 'chat' && (
      <View style={styles.quickActionsContainer}>
        <TouchableOpacity 
          style={styles.dropdownButton}
          onPress={() => setShowDropdown(!showDropdown)}
        >
          <Text style={styles.dropdownButtonText}>⚡ {t('quickActions') || 'Quick Actions'}</Text>
          <Text style={styles.dropdownArrow}>{showDropdown ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        
        {showDropdown && (
          <View style={styles.dropdownMenu}>
            <TouchableOpacity 
              style={styles.dropdownItem}
              activeOpacity={0.7}
              onPress={() => {
                handleQuickAction('summarize_week');
                setShowDropdown(false);
              }}
            >
              <Text style={styles.dropdownItemIcon}>📋</Text>
              <Text style={styles.dropdownItemText}>Summarize Week</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.dropdownItem}
              activeOpacity={0.7}
              onPress={() => {
                handleQuickAction('summarize_day');
                setShowDropdown(false);
              }}
            >
              <Text style={styles.dropdownItemIcon}>📊</Text>
              <Text style={styles.dropdownItemText}>Summarize Today</Text>
            </TouchableOpacity>
            
            <View style={styles.dropdownSeparator} />
            
            <TouchableOpacity 
              style={styles.dropdownItem}
              activeOpacity={0.7}
              onPress={() => {
                handleQuickAction('explain_context');
                setShowDropdown(false);
              }}
            >
              <Text style={styles.dropdownItemIcon}>🌍</Text>
              <Text style={styles.dropdownItemText}>{t('explain') || 'Explain Culture'}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.dropdownItem}
              activeOpacity={0.7}
              onPress={() => {
                handleQuickAction('suggest_replies');
                setShowDropdown(false);
              }}
            >
              <Text style={styles.dropdownItemIcon}>💡</Text>
              <Text style={styles.dropdownItemText}>{t('suggest') || 'Smart Replies'}</Text>
            </TouchableOpacity>
            
            <View style={styles.dropdownSeparator} />
            
            <TouchableOpacity 
              style={styles.dropdownItem}
              activeOpacity={0.7}
              onPress={() => {
                handleQuickAction('formality_casual');
                setShowDropdown(false);
              }}
            >
              <Text style={styles.dropdownItemIcon}>😊</Text>
              <Text style={styles.dropdownItemText}>{t('casual') || 'Make Casual'}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.dropdownItem}
              activeOpacity={0.7}
              onPress={() => {
                handleQuickAction('formality_formal');
                setShowDropdown(false);
              }}
            >
              <Text style={styles.dropdownItemIcon}>🎩</Text>
              <Text style={styles.dropdownItemText}>{t('formal') || 'Make Formal'}</Text>
            </TouchableOpacity>
            
            <View style={styles.dropdownSeparator} />
            
            <TouchableOpacity 
              style={styles.dropdownItem}
              activeOpacity={0.7}
              onPress={() => {
                handleQuickAction('cultural_tips');
                setShowDropdown(false);
              }}
            >
              <Text style={styles.dropdownItemIcon}>🌟</Text>
              <Text style={styles.dropdownItemText}>{t('tips') || 'Cultural Tips'}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.dropdownItem, styles.demoItem]}
              activeOpacity={0.7}
              onPress={() => {
                handleQuickAction('rubric_demo');
                setShowDropdown(false);
              }}
            >
              <Text style={styles.dropdownItemIcon}>🎯</Text>
              <Text style={[styles.dropdownItemText, styles.demoItemText]}>{t('demo') || 'Rubric Demo'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Auto-Translation Toggle Section */}
        <View style={styles.autoTranslateSection}>
          <View style={styles.autoTranslateHeader}>
            <Text style={styles.autoTranslateTitle}>{t('autoTranslate')}</Text>
            <TouchableOpacity 
              style={[
                styles.toggleButton, 
                autoTranslateEnabled && styles.toggleButtonActive
              ]}
              onPress={() => {
                const newEnabled = !autoTranslateEnabled;
                setAutoTranslateEnabled(newEnabled);
                console.log('🔄 Auto translate toggle changed:', newEnabled);
              }}
            >
              <Text style={[
                styles.toggleButtonText,
                autoTranslateEnabled && styles.toggleButtonTextActive
              ]}>
                {autoTranslateEnabled ? t('on') : t('off')}
              </Text>
            </TouchableOpacity>
          </View>
          
          {autoTranslateEnabled && (
            <View style={styles.translationSettings}>
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>{t('language')}:</Text>
                <View style={styles.languageSelector}>
                  {['English', 'Spanish', 'French', 'German', 'Italian'].map(lang => (
                    <TouchableOpacity
                      key={lang}
                      style={[
                        styles.languageOption,
                        autoTranslateLanguage === lang && styles.languageOptionActive
                      ]}
                      onPress={() => {
                        setAutoTranslateLanguage(lang);
                        console.log('🔄 Auto translate language changed:', lang);
                      }}
                    >
                      <Text style={[
                        styles.languageOptionText,
                        autoTranslateLanguage === lang && styles.languageOptionTextActive
                      ]}>
                        {lang.substring(0, 2).toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>{t('tone')}:</Text>
                <View style={styles.formalitySelector}>
                  {[
                    { key: 'casual', label: t('casual') },
                    { key: 'formal', label: t('formal') }
                  ].map(option => (
                    <TouchableOpacity
                      key={option.key}
                      style={[
                        styles.formalityOption,
                        autoTranslateFormality === option.key && styles.formalityOptionActive
                      ]}
                      onPress={() => {
                        setAutoTranslateFormality(option.key);
                        console.log('🔄 Auto translate formality changed:', option.key);
                      }}
                    >
                      <Text style={[
                        styles.formalityOptionText,
                        autoTranslateFormality === option.key && styles.formalityOptionTextActive
                      ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              <Text style={styles.autoTranslateStatus}>
                {t('autoTranslating')} {autoTranslateLanguage.toLowerCase()} ({autoTranslateFormality})
              </Text>
            </View>
          )}
        </View>
      </View>
      )}

      <TouchableWithoutFeedback onPress={() => setShowDropdown(false)}>
        <View style={styles.content}>
          {activeTab === 'chat' ? (
            <KeyboardAvoidingView 
              style={styles.chatContent}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
              {/* Show loading indicator when loading history */}
              {loadingHistory && (
                <View style={styles.loadingHistoryContainer}>
                  <ActivityIndicator size="small" color="#CD853F" />
                  <Text style={styles.loadingHistoryText}>
                    {t('loadingConversation') || 'Loading conversation...'}
                  </Text>
                </View>
              )}

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
                  placeholder={t('askMeAnything')}
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
                  onPress={() => handleSendMessage()}
                  disabled={!inputText.trim() || loading}
                >
                  {loading ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text style={styles.sendButtonText}>{t('send')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          ) : (
            renderInsightsContent()
          )}
        </View>
      </TouchableWithoutFeedback>

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
    color: '#CD853F',
    fontSize: 16,
    fontWeight: '500',
  },
  quickActionsContainer: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e1e5e9',
  },
  dropdownButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#666',
    fontWeight: 'bold',
  },
  dropdownMenu: {
    marginTop: 8,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e1e5e9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    paddingVertical: 8,
    maxHeight: 300,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
  },
  dropdownItemIcon: {
    fontSize: 20,
    marginRight: 12,
    width: 24,
    textAlign: 'center',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  dropdownSeparator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 16,
    marginVertical: 4,
  },
  demoItem: {
    backgroundColor: 'rgba(0, 122, 255, 0.05)',
  },
  demoItemText: {
    color: '#CD853F',
    fontWeight: '600',
  },
  // Auto-translation styles
  autoTranslateSection: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e1e5e9',
  },
  autoTranslateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  autoTranslateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  toggleButton: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    minWidth: 50,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#4CAF50',
  },
  toggleButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 12,
  },
  toggleButtonTextActive: {
    color: 'white',
  },
  translationSettings: {
    marginTop: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  settingLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 12,
    minWidth: 80,
  },
  languageSelector: {
    flexDirection: 'row',
    flex: 1,
  },
  languageOption: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
    minWidth: 40,
    alignItems: 'center',
  },
  languageOptionActive: {
    backgroundColor: '#CD853F',
  },
  languageOptionText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  languageOptionTextActive: {
    color: 'white',
  },
  formalitySelector: {
    flexDirection: 'row',
    flex: 1,
  },
  formalityOption: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
    alignItems: 'center',
  },
  formalityOptionActive: {
    backgroundColor: '#CD853F',
  },
  formalityOptionText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  formalityOptionTextActive: {
    color: 'white',
  },
  autoTranslateStatus: {
    fontSize: 12,
    color: '#4CAF50',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
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
    backgroundColor: '#CD853F',
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
    backgroundColor: '#CD853F',
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
  // Loading history styles
  loadingHistoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  loadingHistoryText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  // Tab bar styles
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    flexDirection: 'row',
  },
  activeTab: {
    borderBottomColor: '#CD853F',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#CD853F',
    fontWeight: '600',
  },
  insightsBadge: {
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  insightsBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Chat content styles
  chatContent: {
    flex: 1,
  },
  // Insights styles
  insightsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyInsightsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyInsightsIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyInsightsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyInsightsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  insightsList: {
    flex: 1,
  },
  insightsContent: {
    padding: 16,
  },
  insightItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e1e5e9',
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  insightEmoji: {
    fontSize: 20,
    marginRight: 12,
  },
  insightHeaderText: {
    flex: 1,
  },
  insightText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  insightMeta: {
    fontSize: 13,
    color: '#666',
  },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  urgencyText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  sourceSnippet: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  insightSeparator: {
    height: 12,
  },
  // Test button styles (development only)
  testButton: {
    backgroundColor: '#CD853F',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  testButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
