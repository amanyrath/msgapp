/**
 * AI Context Management - RAG Pipeline for MessageAI
 * Handles conversation context, message history, and user preferences for AI features
 */

/**
 * Format chat messages for AI context
 * @param {array} messages - Array of chat messages
 * @param {number} maxMessages - Maximum number of messages to include
 * @returns {string} Formatted context string
 */
export function formatMessagesForContext(messages, maxMessages = 50) {
  if (!messages || messages.length === 0) {
    return 'No previous messages in this conversation.';
  }

  const recentMessages = messages
    .slice(-maxMessages)
    .map(msg => {
      const timestamp = new Date(msg.timestamp?.toDate()).toLocaleTimeString();
      const sender = msg.senderName || msg.senderEmail || 'Unknown';
      
      if (msg.type === 'photo') {
        return `[${timestamp}] ${sender}: [Sent a photo]`;
      } else if (msg.type === 'ai') {
        return `[${timestamp}] AI Assistant: ${msg.text}`;
      } else {
        return `[${timestamp}] ${sender}: ${msg.text}`;
      }
    })
    .join('\n');

  return recentMessages;
}

/**
 * Get cultural context for a conversation
 * @param {array} messages - Chat messages
 * @param {object} chatInfo - Chat metadata
 * @param {array} participants - Chat participants
 * @returns {object} Cultural context information
 */
export function getCulturalContext({ messages, chatInfo, participants }) {
  const context = {
    conversationType: chatInfo?.type === 'group' ? 'group' : 'direct',
    participantCount: participants?.length || 2,
    languages: [],
    culturalPatterns: [],
    timeframe: null
  };

  if (messages && messages.length > 0) {
    // Analyze time span of conversation
    const oldestMessage = messages[0];
    const newestMessage = messages[messages.length - 1];
    
    if (oldestMessage?.timestamp && newestMessage?.timestamp) {
      const timeSpan = newestMessage.timestamp.toDate() - oldestMessage.timestamp.toDate();
      const hours = timeSpan / (1000 * 60 * 60);
      
      if (hours < 1) {
        context.timeframe = 'recent';
      } else if (hours < 24) {
        context.timeframe = 'today';
      } else if (hours < 168) {
        context.timeframe = 'this_week';
      } else {
        context.timeframe = 'older';
      }
    }

    // Detect language patterns in messages
    const textMessages = messages.filter(msg => msg.type !== 'photo');
    
    // Simple heuristics for language detection (could be enhanced with actual detection)
    const hasSpanishMarkers = textMessages.some(msg => 
      msg.text && /\b(hola|gracias|por favor|buenos|buenas|cómo|qué tal|sí|no)\b/i.test(msg.text)
    );
    const hasEnglishMarkers = textMessages.some(msg => 
      msg.text && /\b(hello|thanks|please|good|how|what|yes|no|the|and|you)\b/i.test(msg.text)
    );
    
    if (hasSpanishMarkers) context.languages.push('Spanish');
    if (hasEnglishMarkers) context.languages.push('English');
    
    // Detect potential cultural patterns
    const allText = textMessages.map(msg => msg.text).join(' ').toLowerCase();
    
    if (allText.includes('rave') || allText.includes('dj') || allText.includes('techno')) {
      context.culturalPatterns.push('music_events');
    }
    
    if (allText.includes('zurich') || allText.includes('switzerland')) {
      context.culturalPatterns.push('swiss_context');
    }
    
    if (allText.includes('work') || allText.includes('meeting') || allText.includes('project')) {
      context.culturalPatterns.push('professional');
    }
  }

  // Add participant information
  if (participants) {
    context.participants = participants.map(p => ({
      name: p.nickname || p.displayName || p.email,
      icon: p.icon,
      id: p.uid
    }));
  }

  return context;
}

/**
 * Filter messages by time range for bulk operations
 * @param {array} messages - All messages
 * @param {string} timeRange - 'hour', 'day', or 'now' (starting from now)
 * @returns {array} Filtered messages
 */
export function filterMessagesByTimeRange(messages, timeRange) {
  if (!messages || messages.length === 0) {
    return [];
  }

  const now = new Date();
  let cutoffTime;

  switch (timeRange) {
    case 'hour':
      cutoffTime = new Date(now - 60 * 60 * 1000); // 1 hour ago
      break;
    case 'day':
      cutoffTime = new Date(now - 24 * 60 * 60 * 1000); // 24 hours ago
      break;
    case 'now':
      // Return all messages as we'll start translating from now
      return messages;
    default:
      return messages;
  }

  return messages.filter(msg => {
    if (!msg.timestamp) return false;
    const messageTime = msg.timestamp.toDate();
    return messageTime >= cutoffTime;
  });
}

/**
 * Extract conversation metadata for AI context
 * @param {object} chatInfo - Chat document from Firestore
 * @param {array} participants - Chat participants with profiles
 * @param {object} currentUser - Current user information
 * @returns {object} Conversation metadata
 */
export function getConversationMetadata({ chatInfo, participants, currentUser }) {
  const metadata = {
    chatId: chatInfo?.id,
    chatType: chatInfo?.type || 'direct',
    chatName: chatInfo?.name,
    participantCount: participants?.length || 2,
    currentUserId: currentUser?.uid,
    currentUserLanguage: currentUser?.nativeLanguage || 'English',
    createdAt: chatInfo?.createdAt
  };

  // Add participant languages and preferences if available
  if (participants) {
    metadata.participantLanguages = participants
      .map(p => p.nativeLanguage || p.preferredLanguage)
      .filter(Boolean);
    
    metadata.participantLocations = participants
      .map(p => p.location)
      .filter(Boolean);
  }

  return metadata;
}

/**
 * Build comprehensive context for AI operations
 * @param {object} params - Context parameters
 * @returns {object} Complete AI context
 */
export function buildAIContext({
  messages,
  chatInfo,
  participants,
  currentUser,
  operation = 'general'
}) {
  const conversationMetadata = getConversationMetadata({ chatInfo, participants, currentUser });
  const culturalContext = getCulturalContext({ messages, chatInfo, participants });
  const messageContext = formatMessagesForContext(messages);

  return {
    metadata: conversationMetadata,
    cultural: culturalContext,
    messages: messageContext,
    operation,
    timestamp: new Date().toISOString(),
    userPreferences: {
      nativeLanguage: currentUser?.nativeLanguage || 'English',
      formality: currentUser?.preferredFormality || 'casual',
      location: currentUser?.location
    }
  };
}

/**
 * Create system prompt for AI operations with full context
 * @param {object} context - AI context object
 * @param {string} specificTask - Specific task instructions
 * @returns {string} Complete system prompt
 */
export function createSystemPrompt(context, specificTask) {
  const basePrompt = `You are an AI assistant specialized in international communication and cultural understanding for the MessageAI app.

CONVERSATION CONTEXT:
- Chat Type: ${context.metadata.chatType}
- Participants: ${context.metadata.participantCount}
- User's Language: ${context.metadata.currentUserLanguage}
- Detected Languages: ${context.cultural.languages.join(', ') || 'Unknown'}
- Cultural Patterns: ${context.cultural.culturalPatterns.join(', ') || 'None detected'}
- Conversation Timeframe: ${context.cultural.timeframe || 'Unknown'}

RECENT MESSAGES:
${context.messages}

USER PREFERENCES:
- Native Language: ${context.userPreferences.nativeLanguage}
- Formality Level: ${context.userPreferences.formality}
${context.userPreferences.location ? `- Location: ${context.userPreferences.location}` : ''}

SPECIFIC TASK:
${specificTask}

Always consider cultural nuances, maintain appropriate tone, and provide helpful international communication assistance.`;

  return basePrompt;
}

export default {
  formatMessagesForContext,
  getCulturalContext,
  filterMessagesByTimeRange,
  getConversationMetadata,
  buildAIContext,
  createSystemPrompt
};
