import OpenAI from 'openai';
import Constants from 'expo-constants';

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
    const systemPrompt = `You are an expert translator and cultural consultant for international communication.

Instructions:
1. Translate the given text to ${targetLanguage}
2. Match the ${formality} tone requested
3. Detect the source language if not provided
4. Provide cultural context hints if the text contains slang, idioms, or cultural references
5. Adjust formality appropriately for the target culture

Response format (JSON):
{
  "translation": "translated text",
  "detectedLanguage": "detected source language",
  "confidence": 0.95,
  "culturalNotes": ["note about cultural context", "explanation of slang/idioms"],
  "formalityAdjustment": "explanation of tone changes made"
}`;

    const userPrompt = `Text to translate: "${text}"
${sourceLanguage ? `Source language: ${sourceLanguage}` : ''}
Target language: ${targetLanguage}
Formality level: ${formality}
${culturalContext.chatContext ? `Chat context: ${culturalContext.chatContext}` : ''}
${culturalContext.userLocation ? `User location: ${culturalContext.userLocation}` : ''}`;

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
    return {
      success: true,
      ...result,
      usage: response.usage
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
 * @param {object} context - Additional context about conversation
 * @returns {Promise<object>} Cultural explanation result
 */
export async function explainCulturalContext({ text, userLanguage, context = {} }) {
  try {
    const systemPrompt = `You are a cultural consultant helping international communicators understand slang, idioms, and cultural references.

Analyze the text and provide explanations for:
1. Slang terms and their meanings
2. Cultural references (places, events, celebrities, etc.)
3. Idioms and expressions
4. Context-specific meanings (like music/rave terminology)

Response format (JSON):
{
  "explanations": [
    {
      "term": "word or phrase",
      "explanation": "what it means",
      "category": "slang|idiom|cultural_reference|technical_term",
      "culturalContext": "additional cultural background"
    }
  ],
  "overallContext": "general explanation of the conversation context",
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
 * @param {string} formality - Desired formality level
 * @param {object} culturalContext - Cultural context information
 * @returns {Promise<object>} Smart reply suggestions
 */
export async function generateSmartReplies({
  conversationHistory,
  targetLanguage,
  formality = 'casual',
  culturalContext = {}
}) {
  try {
    const systemPrompt = `You are an AI assistant helping with culturally appropriate communication.

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
 * Process AI chat message - handles general AI assistant interactions
 * @param {string} userMessage - User's message to the AI
 * @param {array} chatContext - Recent chat messages for context
 * @param {object} userPreferences - User's language preferences and settings
 * @returns {Promise<object>} AI response
 */
export async function processChatMessage({ userMessage, chatContext, userPreferences }) {
  try {
    const systemPrompt = `You are an AI assistant specialized in international communication and cultural understanding.

You can help with:
- Translation and language detection
- Cultural context explanations  
- Smart reply suggestions
- Communication tips
- Slang and idiom explanations

Available commands:
- "translate [timeframe]" - translate messages from specified timeframe
- "explain [text]" - explain cultural context or slang
- "suggest replies" - generate culturally appropriate responses
- "analyze conversation" - provide cultural insights

Be conversational, helpful, and culturally aware. Always consider the international communication context.`;

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
  processChatMessage
};
