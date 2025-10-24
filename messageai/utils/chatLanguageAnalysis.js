import { translateText } from './aiService';
import { getCachedUserLanguagePreference } from './languageIntegration';

// Cache for chat language analysis (in-memory for now)
const chatLanguageCache = new Map();

/**
 * Simple heuristic to detect if text might be non-English
 * @param {string} text - Text to analyze
 * @returns {boolean} - True if likely non-English
 */
function isLikelyNonEnglish(text) {
  if (!text || text.trim().length < 10) return false;
  
  // Check for non-Latin characters (Chinese, Japanese, Korean, Arabic, etc.)
  const nonLatinRegex = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\u0600-\u06ff\u0590-\u05ff\u0400-\u04ff]/;
  if (nonLatinRegex.test(text)) return true;
  
  // Check for common non-English words/patterns
  const spanishPatterns = /\b(que|con|por|para|una|esta|pero|todo|muy|ser|tener|hacer|decir|año|vez|tiempo|día|hombre|mundo|vida|mano|parte|niño|ojo|momento)\b/gi;
  const frenchPatterns = /\b(que|avec|pour|une|cette|mais|tout|très|être|avoir|faire|dire|année|fois|temps|jour|homme|monde|vie|main|partie|enfant|œil|moment)\b/gi;
  const germanPatterns = /\b(das|mit|für|eine|diese|aber|alle|sehr|sein|haben|machen|sagen|jahr|mal|zeit|tag|mann|welt|leben|hand|teil|kind|auge|moment)\b/gi;
  
  const spanishMatches = (text.match(spanishPatterns) || []).length;
  const frenchMatches = (text.match(frenchPatterns) || []).length;
  const germanMatches = (text.match(germanPatterns) || []).length;
  
  const wordCount = text.split(/\s+/).length;
  const nonEnglishRatio = (spanishMatches + frenchMatches + germanMatches) / wordCount;
  
  return nonEnglishRatio > 0.3; // 30% non-English words threshold
}

/**
 * Analyze the dominant language of a chat based on recent messages
 * @param {Array} messages - Array of message objects
 * @param {string} currentUserId - Current user ID to exclude their messages from analysis
 * @param {object} options - Analysis options
 * @returns {Promise<object>} - Language analysis result
 */
export async function analyzeChatLanguage(messages, currentUserId, options = {}) {
  try {
    const { 
      maxMessages = 25,  // Analyze last 25 messages
      forceRefresh = false,
      cacheKey = null 
    } = options;
    
    // Check cache first (unless forced refresh)
    if (!forceRefresh && cacheKey && chatLanguageCache.has(cacheKey)) {
      const cached = chatLanguageCache.get(cacheKey);
      const cacheAge = Date.now() - cached.timestamp;
      
      // Cache valid for 30 minutes
      if (cacheAge < 30 * 60 * 1000) {
        console.log('🚀 Chat language loaded from cache:', cached.language);
        return cached;
      }
    }
    
    // Filter to recent messages from others (not current user)
    const recentMessages = messages
      .filter(msg => msg.senderId !== currentUserId && msg.type !== 'ai' && msg.text && msg.text.trim().length > 5)
      .slice(-maxMessages)
      .reverse(); // Most recent first
    
    if (recentMessages.length === 0) {
      const result = {
        language: 'English',
        confidence: 0.8,
        detectionMethod: 'default',
        timestamp: Date.now(),
        messageCount: 0
      };
      
      if (cacheKey) {
        chatLanguageCache.set(cacheKey, result);
      }
      
      return result;
    }
    
    // Quick heuristic check - if most messages seem English, skip API call
    const likelyNonEnglishCount = recentMessages.filter(msg => isLikelyNonEnglish(msg.text)).length;
    const nonEnglishRatio = likelyNonEnglishCount / recentMessages.length;
    
    if (nonEnglishRatio < 0.2) { // Less than 20% non-English
      const result = {
        language: 'English',
        confidence: 0.85,
        detectionMethod: 'heuristic',
        timestamp: Date.now(),
        messageCount: recentMessages.length,
        nonEnglishRatio
      };
      
      if (cacheKey) {
        chatLanguageCache.set(cacheKey, result);
      }
      
      console.log('🚀 Chat language detected via heuristics: English');
      return result;
    }
    
    // Use AI for more complex analysis
    const combinedText = recentMessages
      .slice(0, 15) // Limit to 15 most recent for API efficiency
      .map(msg => msg.text)
      .join('\n---\n');
    
    console.log('🤖 Analyzing chat language with AI...');
    
    const analysisResult = await analyzeTextLanguageWithAI(combinedText);
    
    const result = {
      language: analysisResult.language,
      confidence: analysisResult.confidence,
      detectionMethod: 'ai',  
      timestamp: Date.now(),
      messageCount: recentMessages.length,
      details: analysisResult.details
    };
    
    // Cache the result
    if (cacheKey) {
      chatLanguageCache.set(cacheKey, result);
    }
    
    console.log('🚀 Chat language detected via AI:', result.language, `(${Math.round(result.confidence * 100)}% confidence)`);
    return result;
    
  } catch (error) {
    console.error('Error analyzing chat language:', error);
    
    // Fallback to English
    const fallbackResult = {
      language: 'English',
      confidence: 0.5,
      detectionMethod: 'fallback',
      timestamp: Date.now(),
      error: error.message
    };
    
    return fallbackResult;
  }
}

/**
 * Use AI to analyze the language of combined text
 * @param {string} text - Combined text from messages
 * @returns {Promise<object>} - Language analysis result
 */
async function analyzeTextLanguageWithAI(text) {
  const systemPrompt = `You are a language detection expert. Analyze the provided text and determine the dominant language.

REQUIREMENTS:
1. Identify the primary language used across all the text
2. Provide confidence score (0-1)
3. Consider mixed-language conversations (pick the dominant one)
4. Account for slang, informal text, and code-switching
5. Ignore URLs, emojis, and technical terms

Response format (JSON):
{
  "language": "language name in English (e.g., 'Spanish', 'French', 'German')",
  "confidence": 0.95,
  "details": {
    "languageBreakdown": {"Spanish": 0.8, "English": 0.2},
    "reasoning": "explanation of detection",
    "mixedLanguage": false
  }
}`;

  const userPrompt = `Analyze the language of this conversation text:

${text}

What is the dominant language being used?`;

  try {
    const result = await translateText({
      text: userPrompt,
      targetLanguage: 'English', // We want the analysis in English
      sourceLanguage: null,
      formality: 'casual',
      culturalContext: {
        chatContext: 'Language detection analysis',
        systemPrompt
      }
    });
    
    // Parse the AI response to extract language info
    // Note: We're repurposing translateText but the AI will respond with language analysis
    if (result.success) {
      // Try to extract language from the response
      const responseText = result.translation || result.text || '';
      
      // Simple extraction - look for language names
      const languagePatterns = {
        'Spanish': /spanish|español|castellano/gi,
        'French': /french|français|francais/gi,
        'German': /german|deutsch/gi,
        'Italian': /italian|italiano/gi,
        'Portuguese': /portuguese|português/gi,
        'Chinese': /chinese|中文|mandarin/gi,
        'Japanese': /japanese|日本語|nihongo/gi,
        'Korean': /korean|한국어/gi,
        'Arabic': /arabic|العربية/gi,
        'Russian': /russian|русский/gi,
        'English': /english|inglés/gi
      };
      
      let detectedLanguage = 'English';
      let maxMatches = 0;
      
      for (const [language, pattern] of Object.entries(languagePatterns)) {
        const matches = (responseText.match(pattern) || []).length;
        if (matches > maxMatches) {
          maxMatches = matches;
          detectedLanguage = language;
        }
      }
      
      return {
        language: detectedLanguage,
        confidence: result.confidence || 0.8,
        details: {
          aiResponse: responseText,
          reasoning: 'AI-based language detection'
        }
      };
    }
    
    return {
      language: 'English',
      confidence: 0.6,
      details: { error: 'AI analysis failed', fallback: true }
    };
    
  } catch (error) {
    console.error('AI language analysis error:', error);
    return {
      language: 'English', 
      confidence: 0.5,
      details: { error: error.message, fallback: true }
    };
  }
}

/**
 * Determine if a user should see translation options for a chat
 * @param {string} chatId - Chat ID
 * @param {Array} messages - Chat messages
 * @param {string} userId - Current user ID
 * @param {object} options - Analysis options
 * @returns {Promise<object>} - Translation recommendation
 */
export async function shouldShowTranslationForChat(chatId, messages, userId, options = {}) {
  try {
    // Get user's language preference
    const userLanguage = await getCachedUserLanguagePreference(userId);
    console.log('👤 User language preference:', userLanguage);
    
    // Analyze chat language
    const chatAnalysis = await analyzeChatLanguage(messages, userId, {
      cacheKey: `chat-${chatId}`,
      ...options
    });
    
    console.log('💬 Chat language analysis:', chatAnalysis.language);
    
    // Compare languages (normalize)
    const normalizedUserLang = normalizeLanguageName(userLanguage);
    const normalizedChatLang = normalizeLanguageName(chatAnalysis.language);
    
    const languagesAreDifferent = normalizedUserLang !== normalizedChatLang;
    const confidenceThreshold = 0.7;
    const highConfidence = chatAnalysis.confidence >= confidenceThreshold;
    
    const shouldShow = languagesAreDifferent && highConfidence;
    
    const result = {
      shouldShow,
      userLanguage: normalizedUserLang,
      chatLanguage: normalizedChatLang,
      confidence: chatAnalysis.confidence,
      reason: shouldShow 
        ? `Chat is in ${normalizedChatLang}, user prefers ${normalizedUserLang}`
        : `Languages match or low confidence (${Math.round(chatAnalysis.confidence * 100)}%)`,
      chatAnalysis
    };
    
    console.log('🔍 Translation recommendation:', result);
    return result;
    
  } catch (error) {
    console.error('Error determining translation need:', error);
    return {
      shouldShow: false,
      error: error.message,
      userLanguage: 'English',
      chatLanguage: 'English'
    };
  }
}

/**
 * Normalize language names for comparison
 * @param {string} language - Language name
 * @returns {string} - Normalized language name
 */
function normalizeLanguageName(language) {
  if (!language) return 'English';
  
  const normalized = language.toLowerCase().trim();
  
  // Handle common variations
  const languageMap = {
    'english': 'English',
    'spanish': 'Spanish', 'español': 'Spanish', 'castellano': 'Spanish',
    'french': 'French', 'français': 'French', 'francais': 'French',
    'german': 'German', 'deutsch': 'German',
    'italian': 'Italian', 'italiano': 'Italian',
    'portuguese': 'Portuguese', 'português': 'Portuguese',
    'chinese': 'Chinese', 'mandarin': 'Chinese',
    'japanese': 'Japanese', 'nihongo': 'Japanese',
    'korean': 'Korean',
    'arabic': 'Arabic',
    'russian': 'Russian'
  };
  
  return languageMap[normalized] || language;
}

/**
 * Clear chat language cache (for testing or when needed)
 * @param {string} chatId - Optional specific chat ID to clear
 */
export function clearChatLanguageCache(chatId = null) {
  if (chatId) {
    chatLanguageCache.delete(`chat-${chatId}`);
    console.log('🗑️ Cleared language cache for chat:', chatId);
  } else {
    chatLanguageCache.clear();
    console.log('🗑️ Cleared all chat language cache');
  }
}
