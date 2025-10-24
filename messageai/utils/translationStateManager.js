import AsyncStorage from '@react-native-async-storage/async-storage';

// PRIVACY: Translation states are CLIENT-SIDE ONLY
// These are personal UI states and should NEVER be synced between users
// Each user's translation views are private and don't affect other users
const TRANSLATION_STATES_PREFIX = 'translation_states_';

/**
 * Get all translation states for a specific chat
 */
export async function getTranslationStates(chatId) {
  try {
    const key = `${TRANSLATION_STATES_PREFIX}${chatId}`;
    const stored = await AsyncStorage.getItem(key);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Error loading translation states:', error);
    return {};
  }
}

/**
 * Save a single translation state for a message
 */
export async function setTranslationState(chatId, messageId, isExpanded) {
  try {
    const key = `${TRANSLATION_STATES_PREFIX}${chatId}`;
    const currentStates = await getTranslationStates(chatId);
    
    if (isExpanded) {
      currentStates[messageId] = {
        expanded: true,
        timestamp: Date.now()
      };
    } else {
      delete currentStates[messageId];
    }
    
    await AsyncStorage.setItem(key, JSON.stringify(currentStates));
  } catch (error) {
    console.error('Error saving translation state:', error);
  }
}

/**
 * Check if a translation is currently expanded
 */
export async function isTranslationExpanded(chatId, messageId) {
  try {
    const states = await getTranslationStates(chatId);
    return states[messageId]?.expanded || false;
  } catch (error) {
    console.error('Error checking translation state:', error);
    return false;
  }
}

/**
 * Clear all translation states for a specific chat
 */
export async function clearAllTranslationStates(chatId) {
  try {
    const key = `${TRANSLATION_STATES_PREFIX}${chatId}`;
    await AsyncStorage.removeItem(key);
    console.log('🧹 Cleared AsyncStorage translation states for chat:', chatId);
  } catch (error) {
    console.error('Error clearing translation states:', error);
    throw error;
  }
}

/**
 * Clear all translation states across all chats (for maintenance)
 */
export async function clearAllTranslationStatesGlobally() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const translationKeys = keys.filter(key => key.startsWith(TRANSLATION_STATES_PREFIX));
    
    if (translationKeys.length > 0) {
      await AsyncStorage.multiRemove(translationKeys);
      console.log('🧹 Cleared all translation states globally:', translationKeys.length, 'chats');
    }
  } catch (error) {
    console.error('Error clearing all translation states:', error);
    throw error;
  }
}

/**
 * Get translation states summary for debugging
 */
export async function getTranslationStatesSummary() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const translationKeys = keys.filter(key => key.startsWith(TRANSLATION_STATES_PREFIX));
    
    const summary = {};
    for (const key of translationKeys) {
      const chatId = key.replace(TRANSLATION_STATES_PREFIX, '');
      const states = await getTranslationStates(chatId);
      summary[chatId] = Object.keys(states).length;
    }
    
    return summary;
  } catch (error) {
    console.error('Error getting translation states summary:', error);
    return {};
  }
}