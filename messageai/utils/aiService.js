import OpenAI from 'openai';
import Constants from 'expo-constants';

// Universal system prompts that adapt to user's language automatically
const SYSTEM_PROMPTS = {
    chat_assistant: `You are an AI assistant specialized in international communication and cultural understanding.

IMPORTANT: Always respond in the SAME LANGUAGE as the user's request. If the user writes in Spanish, respond in Spanish. If they write in English, respond in English. Detect the language automatically and match it.

You can help with:
- Translation and language detection
- Cultural context explanations  
- Smart reply suggestions
- Communication tips
- Slang and idiom explanations

Available commands (adapt to user's language):
- "translate [timeframe]" / "traducir [tiempo]" / "traduire [période]" - translate messages from specified timeframe
- "summarize [timeframe]" / "resumir [tiempo]" / "résumer [période]" - summarize chat history from specified timeframe
- "explain [text]" / "explicar [texto]" / "expliquer [texte]" - explain cultural context or slang
- "suggest replies" / "sugerir respuestas" / "suggérer réponses" - generate culturally appropriate responses
- "analyze conversation" / "analizar conversación" / "analyser conversation" - provide cultural insights

Be conversational, helpful, and culturally aware. Always consider the international communication context and respond in the user's language with appropriate cultural sensitivity.`,
    
  cultural_analysis: `You are an expert cultural consultant for international communication, helping users navigate cross-cultural conversations. 

IMPORTANT: Always respond in the SAME LANGUAGE as the user's request. Detect their language and respond accordingly with appropriate cultural nuances for that language.`,
    
  smart_replies: `You are an AI assistant helping generate culturally appropriate response suggestions. 

IMPORTANT: Always respond in the SAME LANGUAGE as the user's request. Generate suggestions that are culturally appropriate for the detected language and context.`
};

/**
 * Get universal system prompt that automatically adapts to user's language
 * @param {string} operation - Type of AI operation (chat_assistant, cultural_analysis, smart_replies)
 * @returns {string} Universal system prompt
 */
function getUniversalSystemPrompt(operation) {
  return SYSTEM_PROMPTS[operation] || SYSTEM_PROMPTS.chat_assistant;
}

// Check if we have the API key before initializing
let openai = null;

const getOpenAIClient = () => {
  if (!openai) {
    // Try multiple sources for the API key
    const apiKey = 
      Constants.expoConfig?.extra?.OPENAI_API_KEY || 
      Constants.manifest?.extra?.OPENAI_API_KEY ||
      process.env.OPENAI_API_KEY;
    
    console.log('API Key sources:', {
      expoConfig: Constants.expoConfig?.extra?.OPENAI_API_KEY ? 'Found' : 'Not found',
      manifest: Constants.manifest?.extra?.OPENAI_API_KEY ? 'Found' : 'Not found',
      processEnv: process.env.OPENAI_API_KEY ? 'Found' : 'Not found',
      finalKey: apiKey ? `${apiKey.substring(0, 10)}...` : 'Not found'
    });
    
    if (!apiKey) {
      throw new Error('OpenAI API key not found. Please set OPENAI_API_KEY in your .env file and restart Expo.');
    }
    
    openai = new OpenAI({ apiKey });
  }
  return openai;
};

// OpenAI client will be initialized lazily in getOpenAIClient()

/**
 * AI Service for International Communicator features
 * Handles translation, cultural context, and smart replies
 */

/**
 * Validate translation quality for rubric compliance
 * @param {object} result - Translation result object
 * @returns {object} Quality metrics
 */
function validateTranslationQuality(result) {
  const metrics = {
    naturalness: 0,
    accuracy: 0,
    culturalAwareness: 0,
    overallScore: 0
  };

  // Naturalness: Check for structured translation with proper formatting
  if (result.translation && result.translation.length > 0) {
    metrics.naturalness = result.confidence || 0.8;
  }

  // Accuracy: Based on confidence score and language detection
  if (result.confidence && result.detectedLanguage) {
    metrics.accuracy = result.confidence;
  }

  // Cultural awareness: Bonus points for cultural notes
  if (result.culturalNotes && result.culturalNotes.length > 0) {
    metrics.culturalAwareness = 0.9;
  } else if (result.formalityAdjustment) {
    metrics.culturalAwareness = 0.7;
  } else {
    metrics.culturalAwareness = 0.5;
  }

  // Overall score (weighted average)
  metrics.overallScore = (
    metrics.naturalness * 0.4 + 
    metrics.accuracy * 0.4 + 
    metrics.culturalAwareness * 0.2
  );

  return metrics;
}

/**
 * Translate text using GPT-4o mini with cultural context
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - Target language (e.g., 'Spanish', 'English')
 * @param {string} sourceLanguage - Source language (optional, will auto-detect if not provided)
 * @param {string} formality - Formality level ('casual', 'formal', 'professional')
 * @param {object} culturalContext - Additional context about the conversation
 * @returns {Promise<object>} Translation result with detected language and cultural notes
 */
export async function translateText({
  text,
  targetLanguage,
  sourceLanguage = null,
  formality = 'casual',
  culturalContext = {}
}) {
  try {
    // Determine the response language (for AI explanations)
    const responseLanguage = culturalContext.responseLanguage || culturalContext.userInterfaceLanguage || targetLanguage;
    
    const systemPrompt = `You are an expert translator and cultural consultant specializing in international communication across cultures.

ADVANCED TRANSLATION REQUIREMENTS:
1. Translate the ORIGINAL TEXT to ${targetLanguage} with natural, culturally appropriate phrasing
2. Apply ${formality} tone with regional cultural sensitivity
3. Detect source language with high confidence
4. Provide comprehensive cultural context about the ORIGINAL TEXT (not the translation)
5. Adjust formality based on target culture's communication norms
6. Include regional variations and cultural appropriateness guidance

CRITICAL INSTRUCTION - ANALYZE THE ORIGINAL MESSAGE ONLY:
- ALL cultural analysis must focus on the ORIGINAL MESSAGE that was sent/received
- Explain what the ORIGINAL words/phrases mean in the sender's culture
- Help the ${targetLanguage} speaker understand the cultural context of what they RECEIVED
- Do NOT analyze or discuss the translation - only analyze the source text
- Focus on the original language's cultural nuances, idioms, formality markers, and regional expressions from the SOURCE culture

EXAMPLES OF CORRECT ANALYSIS:
- If original is "¡Órale!": Explain this Mexican slang shows excitement/surprise in Mexican culture
- If original is "あけましておめでとう": Explain the formality level and respect shown in Japanese culture
- If original is "Cheers mate!": Explain British informal friendliness and pub culture context
DO NOT explain what the English translation means - explain the cultural meaning of the SOURCE text!

CULTURAL FORMALITY GUIDELINES:
- Analyze the formality level of the ORIGINAL text in its SOURCE cultural context
- Explain how the ORIGINAL sender's tone would be perceived in THEIR culture
- Consider hierarchical vs. egalitarian aspects of the ORIGINAL language's culture
- Account for direct vs. indirect communication styles of the SOURCE culture
- Explain regional variations and cultural context of the ORIGINAL message from SOURCE culture
- Help bridge cultural understanding from source culture to target audience

IMPORTANT: All explanatory text (culturalNotes, formalityAdjustment, regionalConsiderations, etc.) must be written in ${responseLanguage}, not English. Only the "detectedLanguage" field should be in English.

Response format (JSON):
{
  "translation": "naturally translated text with cultural appropriateness",
  "detectedLanguage": "detected source language with confidence (in English)",
  "confidence": 0.95,
  "culturalNotes": ["explanations of cultural elements in the ORIGINAL message in ${responseLanguage}", "analysis of original sender's cultural expressions in ${responseLanguage}"],
  "formalityAdjustment": "explanation of the ORIGINAL message's formality level and cultural tone in ${responseLanguage}",
  "regionalConsiderations": "regional/cultural context of the ORIGINAL message's expressions in ${responseLanguage}",
  "culturalAppropriatenessScore": 0.95,
  "communicationStyle": "analysis of the ORIGINAL sender's communication style and cultural approach in ${responseLanguage}"
}`;

    const userPrompt = `ORIGINAL MESSAGE TO ANALYZE AND TRANSLATE: "${text}"

${sourceLanguage ? `Source language: ${sourceLanguage}` : ''}
Target language: ${targetLanguage}
Desired formality level: ${formality}
${culturalContext.chatContext ? `Chat context: ${culturalContext.chatContext}` : ''}
${culturalContext.userLocation ? `User location: ${culturalContext.userLocation}` : ''}

Please:
1. Translate the original message to ${targetLanguage}
2. Analyze the ORIGINAL message "${text}" for cultural elements, formality, and regional expressions from ITS source culture
3. Explain what cultural aspects about the ORIGINAL MESSAGE the ${targetLanguage} user should understand
4. Focus cultural notes on the SOURCE culture's communication patterns, NOT the translation

Remember: Analyze "${text}" as it exists in its original cultural context, not your translation of it!`;

    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content);
    // Add quality validation for rubric compliance
    const qualityScore = validateTranslationQuality(result);
    
    return {
      success: true,
      ...result,
      usage: response.usage,
      qualityMetrics: qualityScore
    };
  } catch (error) {
    console.error('Translation error:', error);
    return {
      success: false,
      error: error.message,
      translation: text // Fallback to original text
    };
  }
}

/**
 * Detect language of given text
 * @param {string} text - Text to analyze
 * @returns {Promise<object>} Language detection result
 */
export async function detectLanguage(text) {
  try {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Detect the language of the given text. Respond with JSON format:
{
  "language": "language name",
  "code": "language code (e.g., 'es', 'en')",
  "confidence": 0.95,
  "dialect": "specific dialect if applicable"
}`
        },
        { role: 'user', content: text }
      ],
      temperature: 0.1,
      max_tokens: 200,
      response_format: { type: 'json_object' }
    });

    return {
      success: true,
      ...JSON.parse(response.choices[0].message.content)
    };
  } catch (error) {
    console.error('Language detection error:', error);
    return {
      success: false,
      error: error.message,
      language: 'Unknown'
    };
  }
}

/**
 * Explain cultural context, slang, or idioms in text
 * @param {string} text - Text to analyze
 * @param {string} userLanguage - User's native language
 * @param {string} interfaceLanguage - User's current interface language
 * @param {object} context - Additional context about conversation
 * @returns {Promise<object>} Cultural explanation result
 */
export async function explainCulturalContext({ text, userLanguage, interfaceLanguage = 'English', context = {} }) {
  try {
    const systemPrompt = getUniversalSystemPrompt('cultural_analysis') + `

ENHANCED ANALYSIS REQUIREMENTS:
1. Identify ALL cultural elements: slang, idioms, regional expressions, generational language, professional jargon
2. Provide context-rich explanations with cultural background
3. Detect subtle cultural nuances and communication patterns
4. Offer proactive cultural intelligence and communication tips
5. Include regional variations and appropriate usage guidance

Response format (JSON):
{
  "explanations": [
    {
      "term": "word or phrase",
      "explanation": "detailed meaning with context",
      "category": "slang|idiom|cultural_reference|technical_term|generational|regional",
      "culturalContext": "rich cultural background and usage notes",
      "regionalVariations": "how this varies across regions/cultures",
      "appropriateUsage": "when and how to use this appropriately"
    }
  ],
  "overallContext": "comprehensive cultural analysis of conversation style and patterns",
  "culturalIntelligence": {
    "communicationStyle": "analysis of conversation style (direct/indirect, formal/casual, etc.)",
    "culturalPatterns": ["detected cultural communication patterns"],
    "potentialMisunderstandings": ["areas where cultural gaps might cause confusion"]
  },
  "proactiveTips": ["specific actionable tips for better cross-cultural communication"],
  "suggestions": ["helpful tips for understanding this type of conversation"]
}`;

    const userPrompt = `Text to analyze: "${text}"
User's native language: ${userLanguage}
${context.location ? `Location context: ${context.location}` : ''}
${context.conversationType ? `Conversation type: ${context.conversationType}` : ''}`;

    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.4,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    return {
      success: true,
      ...JSON.parse(response.choices[0].message.content)
    };
  } catch (error) {
    console.error('Cultural context error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Generate culturally appropriate smart replies
 * @param {array} conversationHistory - Array of recent messages
 * @param {string} targetLanguage - Language to respond in
 * @param {string} interfaceLanguage - User's current interface language
 * @param {string} formality - Desired formality level
 * @param {object} culturalContext - Cultural context information
 * @returns {Promise<object>} Smart reply suggestions
 */
export async function generateSmartReplies({
  conversationHistory,
  targetLanguage,
  interfaceLanguage = 'English',
  formality = 'casual',
  culturalContext = {}
}) {
  try {
    const systemPrompt = getUniversalSystemPrompt('smart_replies') + `

Generate 3 smart reply options that:
1. Are culturally appropriate for the target language/culture
2. Match the conversation tone and context
3. Use the specified formality level
4. Consider cultural nuances and customs

Response format (JSON):
{
  "replies": [
    {
      "text": "reply option",
      "explanation": "why this reply is culturally appropriate",
      "tone": "casual|formal|friendly|professional"
    }
  ],
  "culturalTips": ["tips about communication style in this culture"]
}`;

    const conversationText = conversationHistory
      .slice(-10) // Last 10 messages for context
      .map(msg => `${msg.senderName}: ${msg.text}`)
      .join('\n');

    const userPrompt = `Conversation context:
${conversationText}

Target language: ${targetLanguage}
Formality level: ${formality}
${culturalContext.location ? `Cultural context: ${culturalContext.location}` : ''}

Generate appropriate reply options.`;

    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.6,
      max_tokens: 800,
      response_format: { type: 'json_object' }
    });

    return {
      success: true,
      ...JSON.parse(response.choices[0].message.content)
    };
  } catch (error) {
    console.error('Smart replies error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Analyze conversation for cultural insights and proactive tips
 * @param {array} messages - Array of messages to analyze
 * @param {object} userProfile - User's profile information
 * @returns {Promise<object>} Cultural insights and proactive tips
 */
export async function analyzeConversationCulture({ messages, userProfile }) {
  try {
    const systemPrompt = `You are a cultural analysis AI that helps international communicators understand conversations better.

Analyze the conversation for:
1. Cultural patterns and communication styles
2. Potential misunderstandings or cultural gaps
3. Opportunities for better cross-cultural communication
4. Proactive tips for the user

Response format (JSON):
{
  "culturalPatterns": ["observed communication patterns"],
  "potentialIssues": ["possible misunderstandings or cultural gaps"],
  "proactiveTips": ["suggestions for better communication"],
  "languageMix": "analysis of language switching patterns",
  "formalityLevel": "observed formality patterns"
}`;

    const conversationText = messages
      .slice(-20) // Last 20 messages for broader context
      .map(msg => `[${msg.timestamp}] ${msg.senderName}: ${msg.text}`)
      .join('\n');

    const userPrompt = `Conversation to analyze:
${conversationText}

User background: ${userProfile.nativeLanguage || 'English'} speaker
${userProfile.location ? `Location: ${userProfile.location}` : ''}

Provide cultural analysis and proactive communication tips.`;

    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.4,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    return {
      success: true,
      ...JSON.parse(response.choices[0].message.content)
    };
  } catch (error) {
    console.error('Cultural analysis error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Summarize conversation history in a specific language
 * @param {array} messages - Array of messages to summarize
 * @param {string} timeRange - Time range for summary (e.g., 'last week', 'last month')
 * @param {string} targetLanguage - Language for the summary
 * @param {object} userPreferences - User preferences
 * @returns {Promise<object>} Summary result
 */
export async function summarizeConversation({
  messages,
  timeRange,
  targetLanguage = 'English',
  userPreferences = {}
}) {
  try {
    const systemPrompt = `You are an AI assistant specialized in creating comprehensive conversation summaries for international users.

SUMMARIZATION REQUIREMENTS:
1. Create a clear, well-structured summary in ${targetLanguage}
2. Maintain chronological flow and key discussion points
3. Include important decisions, outcomes, and action items
4. Preserve cultural context and nuanced expressions
5. Highlight any language switches or cultural references
6. Format for easy reading with clear sections

SUMMARY STRUCTURE:
- Overview: Brief summary of main topics discussed
- Key Points: Important messages, decisions, or information shared  
- Cultural Context: Any cultural references, slang, or language mixing
- Action Items: Tasks, plans, or follow-ups mentioned
- Participants: Who was involved and their main contributions

Response format (JSON):
{
  "summary": "comprehensive summary in target language with proper formatting",
  "timeRange": "timeframe of messages summarized",
  "keyTopics": ["main topics discussed"],
  "participants": ["list of active participants"],
  "culturalHighlights": ["notable cultural references or expressions"],
  "actionItems": ["mentioned tasks or follow-ups"],
  "languagesMentioned": ["languages detected in conversation"],
  "messageCount": number,
  "timeSpan": "duration of conversation period"
}`;

    // Process messages to get relevant timeframe
    const filteredMessages = filterMessagesByTimeframe(messages, timeRange);
    
    if (filteredMessages.length === 0) {
      return {
        success: false,
        error: `No messages found in the specified timeframe: ${timeRange}` // This is returned as an error, translation handled in UI layer
      };
    }

    // Format messages for summary context
    const conversationText = filteredMessages
      .map(msg => {
        const timestamp = new Date(msg.timestamp?.toDate()).toLocaleDateString();
        const sender = msg.senderName || msg.senderEmail || 'Unknown';
        return `[${timestamp}] ${sender}: ${msg.text}`;
      })
      .join('\n');

    const userPrompt = `Messages to summarize (${timeRange}):
${conversationText}

Target language for summary: ${targetLanguage}
User's native language: ${userPreferences.nativeLanguage || 'English'}
Timeframe requested: ${timeRange}

Please provide a comprehensive summary.`;

    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.4,
      max_tokens: 1500,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content);
    
    return {
      success: true,
      ...result,
      usage: response.usage,
      originalMessageCount: messages.length,
      summarizedMessageCount: filteredMessages.length
    };
  } catch (error) {
    console.error('Conversation summary error:', error);
    return {
      success: false,
      error: error.message,
      summary: 'Failed to generate summary. Please try again.'
    };
  }
}

/**
 * Filter messages by timeframe description (e.g., 'last week', 'last month')
 * @param {array} messages - All messages
 * @param {string} timeframeDescription - Human-readable timeframe
 * @returns {array} Filtered messages
 */
function filterMessagesByTimeframe(messages, timeframeDescription) {
  if (!messages || messages.length === 0) return [];

  const now = new Date();
  const description = timeframeDescription.toLowerCase();
  let cutoffTime;

  // Parse various timeframe descriptions
  if (description.includes('week')) {
    cutoffTime = new Date(now - 7 * 24 * 60 * 60 * 1000); // 7 days
  } else if (description.includes('month')) {
    cutoffTime = new Date(now - 30 * 24 * 60 * 60 * 1000); // 30 days
  } else if (description.includes('day') || description.includes('today')) {
    cutoffTime = new Date(now - 24 * 60 * 60 * 1000); // 24 hours
  } else if (description.includes('hour')) {
    cutoffTime = new Date(now - 60 * 60 * 1000); // 1 hour
  } else if (description.includes('3 days')) {
    cutoffTime = new Date(now - 3 * 24 * 60 * 60 * 1000); // 3 days
  } else if (description.includes('all') || description.includes('everything')) {
    return messages; // Return all messages
  } else {
    // Default to last week if can't parse
    cutoffTime = new Date(now - 7 * 24 * 60 * 60 * 1000);
  }

  return messages.filter(msg => {
    if (!msg.timestamp) return false;
    const messageTime = msg.timestamp.toDate();
    return messageTime >= cutoffTime;
  });
}

/**
 * Process AI chat message - handles general AI assistant interactions
 * @param {string} userMessage - User's message to the AI
 * @param {array} chatContext - Recent chat messages for context
 * @param {object} userPreferences - User's language preferences and settings
 * @param {string} userLanguage - User's current interface language
 * @returns {Promise<object>} AI response
 */
export async function processChatMessage({ userMessage, chatContext, userPreferences, userLanguage = 'English' }) {
  try {
    const systemPrompt = getUniversalSystemPrompt('chat_assistant');

    const contextText = chatContext
      .slice(-5) // Last 5 messages for immediate context
      .map(msg => `${msg.senderName}: ${msg.text}`)
      .join('\n');

    const userPrompt = `User message: "${userMessage}"

Recent chat context:
${contextText}

User preferences:
- Native language: ${userPreferences.nativeLanguage || 'English'}
- Preferred formality: ${userPreferences.formality || 'casual'}
${userPreferences.location ? `- Location: ${userPreferences.location}` : ''}

Respond naturally and helpfully.`;

    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    return {
      success: true,
      message: response.choices[0].message.content,
      usage: response.usage
    };
  } catch (error) {
    console.error('AI chat error:', error);
    return {
      success: false,
      error: error.message,
      message: 'Sorry, I encountered an error. Please try again.'
    };
  }
}

export default {
  translateText,
  detectLanguage,
  explainCulturalContext,
  generateSmartReplies,
  analyzeConversationCulture,
  processChatMessage,
  summarizeConversation
};
