/**
 * TRANSLATION PRIVACY GUARD
 * 
 * CRITICAL PRIVACY REQUIREMENT:
 * AI translations and cultural suggestions are CLIENT-SIDE ONLY
 * 
 * NEVER SYNC TO FIRESTORE:
 * - Translation states (expanded/collapsed)
 * - AI translation content
 * - Cultural context analysis
 * - Smart text suggestions
 * - Language detection results
 * 
 * PRIVACY PRINCIPLES:
 * 1. Each user's translation views are private and personal
 * 2. Translations are assistance tools, not shared conversation elements
 * 3. Users should not know if others viewed translations of their messages
 * 4. All translation data stays on the user's device
 * 
 * IMPLEMENTATION VERIFICATION:
 * ✅ Translation states: AsyncStorage only (translationStateManager.js)
 * ✅ Proactive translations: In-memory cache only (proactiveTranslation.js)
 * ✅ AI responses: Never sent to Firestore
 * ✅ Cultural context: Client-side display only
 * ✅ Language detection: No server storage
 * 
 * SAFEGUARDS:
 * - No sendMessage() calls in translation components
 * - No Firestore writes for translation data
 * - All storage uses AsyncStorage (local device)
 * - Cache expiry prevents data accumulation
 */

// Guard function to prevent accidental syncing
export function preventTranslationSync(data, context) {
  console.warn('🚨 PRIVACY GUARD: Attempted to sync translation data!', {
    data,
    context,
    message: 'Translation data must remain CLIENT-SIDE ONLY'
  });
  
  throw new Error(
    'PRIVACY VIOLATION: Translation data cannot be synced to server. ' +
    'Translations are personal assistance tools and must remain client-side only.'
  );
}

// Verify data is safe for Firestore (no translation data)
export function verifyFirestoreSafe(messageData, context) {
  const prohibitedFields = [
    'translation',
    'culturalNotes', 
    'translationState',
    'aiTranslation',
    'culturalContext',
    'languageDetection'
  ];
  
  for (const field of prohibitedFields) {
    if (messageData.hasOwnProperty(field)) {
      preventTranslationSync(messageData[field], `${context}: ${field}`);
    }
  }
  
  return true;
}

export default {
  preventTranslationSync,
  verifyFirestoreSafe
};
