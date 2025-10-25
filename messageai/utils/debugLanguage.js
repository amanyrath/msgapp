/**
 * Debug utility for language preference issues
 * Use this to manually check and fix language preferences
 */

import { getUserProfileWithLanguage, updateUserLanguagePreference } from './firestore';
import { getSystemLanguage, getLanguageName } from './localization';
import logger from './logger';

/**
 * Debug current user's language preference
 * @param {string} userId - User ID
 */
export async function debugUserLanguage(userId) {
  logger.debug('=== LANGUAGE DEBUG REPORT ===');
  
  // 1. Check system language
  const systemLanguage = getSystemLanguage();
  const systemLanguageName = getLanguageName(systemLanguage);
  logger.language('System Language:', systemLanguage, '→', systemLanguageName);
  
  // 2. Check user profile in Firestore
  try {
    const profile = await getUserProfileWithLanguage(userId);
    logger.language('User Profile Language Data:', {
      languagePreference: profile?.languagePreference,
      systemLanguage: profile?.systemLanguage,
      hasLanguagePreference: !!profile?.languagePreference,
      fullProfile: profile
    });
  } catch (error) {
    logger.error('Error fetching user profile:', error);
  }
  
  logger.debug('=== END DEBUG REPORT ===');
}

/**
 * Manually set user language preference
 * @param {string} userId - User ID
 * @param {string} language - Language to set (e.g., 'Spanish', 'French')
 */
export async function setUserLanguageManually(userId, language) {
  logger.language(`Manually setting language preference to: ${language}`);
  
  try {
    const success = await updateUserLanguagePreference(userId, language);
    if (success) {
      logger.language(`Successfully set language preference to: ${language}`);
      logger.info('You may need to restart the app to see the changes');
    } else {
      logger.error('Failed to update language preference');
    }
    return success;
  } catch (error) {
    logger.error('Error setting language preference:', error);
    return false;
  }
}

/**
 * Force user language to match system language
 * @param {string} userId - User ID
 */
export async function forceSystemLanguage(userId) {
  const systemLanguage = getSystemLanguage();
  const systemLanguageName = getLanguageName(systemLanguage);
  
  logger.language(`Forcing user language to match system: ${systemLanguageName}`);
  
  return await setUserLanguageManually(userId, systemLanguageName);
}

// Quick access functions for debugging in console
if (typeof window !== 'undefined') {
  window.debugUserLanguage = debugUserLanguage;
  window.setUserLanguageManually = setUserLanguageManually;
  window.forceSystemLanguage = forceSystemLanguage;
}

export default {
  debugUserLanguage,
  setUserLanguageManually,
  forceSystemLanguage
};

