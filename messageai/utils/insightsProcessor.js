import { extractStructuredData } from './aiService';
import { storeConversationInsights, isMessageProcessedForInsights } from './firestore';

/**
 * Background processor for extracting structured data from messages
 * Processes messages automatically as they arrive to extract dates, locations, action items
 */

// Queue to batch process messages and avoid excessive API calls
let processingQueue = [];
let processingTimer = null;
const BATCH_DELAY = 2000; // Wait 2 seconds before processing batch

/**
 * Process a new message for structured data extraction
 * @param {object} message - The message object
 * @param {string} chatId - Chat ID
 * @param {string} currentUserId - Current user's ID (to skip own messages)
 * @param {object} senderProfile - Sender's profile information
 */
export const processMessageForInsights = async (message, chatId, currentUserId, senderProfile = {}) => {
  try {
    // Skip processing own messages
    if (message.senderId === currentUserId) {
      console.log('📊 Skipping own message for insights:', message.id);
      return;
    }

    // Skip non-text messages
    if (message.type !== 'text' || !message.text || message.text.trim().length < 10) {
      console.log('📊 Skipping non-text/short message for insights:', message.id, 'type:', message.type, 'length:', message.text?.length);
      return;
    }

    // Skip AI messages
    if (message.type === 'ai' || message.senderId === 'ai') {
      console.log('📊 Skipping AI message for insights:', message.id);
      return;
    }

    // Check if already processed
    const alreadyProcessed = await isMessageProcessedForInsights(chatId, message.id);
    if (alreadyProcessed) {
      console.log('📊 Message already processed for insights:', message.id);
      return;
    }

    console.log('📊 Queuing message for insights processing:', message.id, 'text preview:', message.text.substring(0, 50) + '...');

    // Add to processing queue
    queueForProcessing({
      message,
      chatId,
      senderProfile
    });

  } catch (error) {
    console.error('❌ Error queuing message for insights processing:', error);
  }
};

/**
 * Add a message to the processing queue
 * @param {object} item - Processing item with message, chatId, senderProfile
 */
const queueForProcessing = (item) => {
  processingQueue.push(item);
  
  // Clear existing timer
  if (processingTimer) {
    clearTimeout(processingTimer);
  }

  // Set new timer to process batch
  processingTimer = setTimeout(processBatch, BATCH_DELAY);
};

/**
 * Process the current batch of messages
 */
const processBatch = async () => {
  if (processingQueue.length === 0) {
    return;
  }

  console.log('📊 Processing insights batch:', processingQueue.length, 'messages');
  
  const currentBatch = [...processingQueue];
  processingQueue = []; // Clear queue

  // Process each message in the batch
  for (const item of currentBatch) {
    await processMessageItem(item);
  }
};

/**
 * Process individual message item for structured data
 * @param {object} item - Processing item
 */
const processMessageItem = async ({ message, chatId, senderProfile }) => {
  try {
    console.log('📊 🚀 Starting AI extraction for message:', message.id);
    console.log('📊 📝 Message text:', message.text);

    // Prepare context for AI
    const context = {
      senderName: senderProfile.displayName || senderProfile.nickname || message.senderEmail,
      timestamp: message.timestamp,
      chatId: chatId
    };

    console.log('📊 🔧 Context prepared:', context);

    // Extract structured data using AI
    const result = await extractStructuredData(message.text, context);

    console.log('📊 🤖 AI extraction result:', {
      success: result.success,
      hasData: result.hasData,
      extractionsCount: result.extractions?.length || 0,
      error: result.error
    });

    if (result.success && result.hasData && result.extractions.length > 0) {
      console.log('📊 ✨ Found extractions:', result.extractions);
      
      // Store insights in Firestore
      const metadata = {
        senderName: context.senderName,
        senderEmail: message.senderEmail,
        messageTimestamp: message.timestamp,
        messageText: message.text
      };

      await storeConversationInsights(chatId, message.id, result.extractions, metadata);
      
      console.log('✅ 🎉 Successfully stored', result.extractions.length, 'insights for message:', message.id);
    } else {
      console.log('📊 🤷 No structured data found in message:', message.id, '- Reason:', result.error || 'No extractions returned');
    }

  } catch (error) {
    console.error('❌ 💥 Error processing message for insights:', error);
  }
};

/**
 * Process existing messages in bulk (for initial setup or backfill)
 * @param {Array} messages - Array of messages to process
 * @param {string} chatId - Chat ID
 * @param {string} currentUserId - Current user's ID
 * @param {Array} userProfiles - Array of user profiles
 * @param {number} maxMessages - Maximum number of messages to process (default: 20)
 */
export const processBulkMessages = async (messages, chatId, currentUserId, userProfiles = [], maxMessages = 20) => {
  try {
    // Filter and sort messages (most recent first)
    const messagesToProcess = messages
      .filter(msg => 
        msg.senderId !== currentUserId && 
        msg.type === 'text' && 
        msg.text && 
        msg.text.trim().length >= 10
      )
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, maxMessages);

    console.log('📊 Bulk processing', messagesToProcess.length, 'messages for insights');

    // Create profile lookup
    const profileMap = {};
    userProfiles.forEach(profile => {
      profileMap[profile.id] = profile;
    });

    // Process each message
    for (const message of messagesToProcess) {
      // Check if already processed
      const alreadyProcessed = await isMessageProcessedForInsights(chatId, message.id);
      if (!alreadyProcessed) {
        const senderProfile = profileMap[message.senderId] || {};
        await processMessageItem({ message, chatId, senderProfile });
        
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log('✅ Bulk insights processing complete');

  } catch (error) {
    console.error('❌ Error in bulk insights processing:', error);
  }
};

/**
 * Clear the processing queue (useful for cleanup)
 */
export const clearProcessingQueue = () => {
  processingQueue = [];
  if (processingTimer) {
    clearTimeout(processingTimer);
    processingTimer = null;
  }
};

export default {
  processMessageForInsights,
  processBulkMessages,
  clearProcessingQueue
};

