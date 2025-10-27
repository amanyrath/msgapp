/**
 * Language Integration Utilities
 * Optimizes localization system by using cached user profiles from subscription manager
 */

import subscriptionManager from './subscriptionManager';
import { updateUserLanguagePreference } from './firestore';

/**
 * Get user's language preference from cached data (optimization)
 * Falls back to direct Firestore call if not cached
 * @param {string} userId - User ID
 * @returns {Promise<string>} User's preferred language
 */
export async function getCachedUserLanguagePreference(userId) {
  if (!userId) {
    console.warn('No userId provided to getCachedUserLanguagePreference');
    return 'English';
  }

  try {
    // Strategy 1: Try cached profiles first (fastest)
    let cachedLanguage = null;
    
    try {
      const cachedProfiles = subscriptionManager.getCachedData('user-profiles');
      
      if (Array.isArray(cachedProfiles) && cachedProfiles.length > 0) {
        const userProfile = cachedProfiles.find(profile => profile && profile.id === userId);
        
        if (userProfile?.languagePreference) {
          cachedLanguage = userProfile.languagePreference;
          console.log('🚀 Language preference loaded from cache:', cachedLanguage);
          
          // Validate cached language is supported
          const supportedLanguages = [
            'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese',
            'Japanese', 'Chinese', 'Korean', 'Arabic', 'Russian', 'Dutch',
            'Swedish', 'Norwegian', 'Finnish', 'Polish', 'Czech', 'Hungarian',
            'Turkish', 'Thai', 'Vietnamese', 'Hindi'
          ];
          
          if (supportedLanguages.includes(cachedLanguage)) {
            return cachedLanguage;
          } else {
            console.warn('Cached language not supported:', cachedLanguage, 'defaulting to English');
            return 'English';
          }
        } else {
          console.log('📦 User profile found in cache but no languagePreference set');
        }
      } else {
        console.log('📦 No cached profiles available or empty cache');
      }
    } catch (cacheError) {
      console.warn('Cache lookup failed:', cacheError);
    }

    // Strategy 2: Fallback to Firestore call with retries
    console.log('📡 Fetching language preference from Firestore for user:', userId);
    
    let firestoreAttempts = 0;
    const maxAttempts = 2;
    
    while (firestoreAttempts < maxAttempts) {
      try {
        const { getUserLanguagePreference } = await import('./firestore');
        const firestoreLanguage = await getUserLanguagePreference(userId);
        
        if (firestoreLanguage) {
          console.log('📡 Language preference fetched from Firestore:', firestoreLanguage);
          return firestoreLanguage;
        } else {
          console.log('📡 No language preference found in Firestore');
          return 'English';
        }
      } catch (firestoreError) {
        firestoreAttempts++;
        console.warn(`Firestore attempt ${firestoreAttempts}/${maxAttempts} failed:`, firestoreError);
        
        if (firestoreAttempts < maxAttempts) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
    
    // Strategy 3: Final fallback to English
    console.log('⚠️ All strategies failed, defaulting to English');
    return 'English';
    
  } catch (error) {
    console.error('Critical error in getCachedUserLanguagePreference:', error);
    return 'English'; // Safe fallback
  }
}

/**
 * Update user's language preference with cache invalidation
 * @param {string} userId - User ID  
 * @param {string} language - New language preference
 * @returns {Promise<boolean>} Success status
 */
export async function updateCachedUserLanguagePreference(userId, language) {
  if (!userId || !language) {
    console.error('Invalid parameters for updateCachedUserLanguagePreference:', { userId, language });
    return false;
  }

  // Validate language is supported
  const supportedLanguages = [
    'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese',
    'Japanese', 'Chinese', 'Korean', 'Arabic', 'Russian', 'Dutch',
    'Swedish', 'Norwegian', 'Finnish', 'Polish', 'Czech', 'Hungarian',
    'Turkish', 'Thai', 'Vietnamese', 'Hindi', 'Khmer'
  ];
  
  if (!supportedLanguages.includes(language)) {
    console.error('Unsupported language for update:', language);
    return false;
  }

  try {
    console.log(`🔄 Updating language preference: ${userId} → ${language}`);
    
    // Update in Firestore with retry logic
    let firestoreSuccess = false;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (!firestoreSuccess && attempts < maxAttempts) {
      attempts++;
      try {
        firestoreSuccess = await updateUserLanguagePreference(userId, language);
        if (firestoreSuccess) {
          console.log(`✅ Firestore update successful on attempt ${attempts}`);
        } else {
          console.warn(`⚠️ Firestore update failed on attempt ${attempts}`);
        }
      } catch (firestoreError) {
        console.error(`❌ Firestore update error on attempt ${attempts}:`, firestoreError);
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts)); // Exponential backoff
        }
      }
    }
    
    if (!firestoreSuccess) {
      console.error('Failed to update Firestore after all attempts');
      return false;
    }
    
    // Update cache if Firestore update succeeded
    try {
      const cachedProfiles = subscriptionManager.getCachedData('user-profiles');
      
      if (Array.isArray(cachedProfiles)) {
        const profileIndex = cachedProfiles.findIndex(profile => profile && profile.id === userId);
        
        if (profileIndex !== -1) {
          // Update the existing cached profile
          cachedProfiles[profileIndex] = {
            ...cachedProfiles[profileIndex],
            languagePreference: language,
            updatedAt: new Date()
          };
          
          console.log('✨ Updated existing cached profile');
        } else {
          // Add new cached profile if user not found
          cachedProfiles.push({
            id: userId,
            languagePreference: language,
            updatedAt: new Date()
          });
          
          console.log('✨ Added new cached profile');
        }
        
        // Notify cache subscribers with error handling
        try {
          const cacheSubscribers = subscriptionManager.cacheSubscribers?.get('user-profiles') || [];
          let successfulNotifications = 0;
          
          cacheSubscribers.forEach(callback => {
            try {
              callback(cachedProfiles);
              successfulNotifications++;
            } catch (error) {
              console.error('Error updating cache subscriber:', error);
            }
          });
          
          console.log(`📡 Notified ${successfulNotifications}/${cacheSubscribers.length} cache subscribers`);
        } catch (notificationError) {
          console.warn('Error during cache notifications:', notificationError);
        }
        
        console.log('✅ Language preference updated in both cache and Firestore');
      } else {
        console.log('📦 No cached profiles array, Firestore updated only');
      }
    } catch (cacheError) {
      console.warn('Cache update failed but Firestore succeeded:', cacheError);
      // Still return true since Firestore succeeded
    }
    
    return true;
  } catch (error) {
    console.error('Critical error updating cached language preference:', error);
    return false;
  }
}

/**
 * Check if user profiles are cached (for conditional optimization)
 * @returns {boolean} True if user profiles are cached
 */
export function isUserProfilesCached() {
  const cachedProfiles = subscriptionManager.getCachedData('user-profiles');
  return Array.isArray(cachedProfiles) && cachedProfiles.length > 0;
}

/**
 * Get subscription manager statistics for language integration monitoring
 * @returns {Object} Statistics including cache status
 */
export function getLanguageIntegrationStats() {
  const stats = subscriptionManager.getStats();
  const cachedProfiles = subscriptionManager.getCachedData('user-profiles');
  
  return {
    ...stats,
    userProfilesCached: Array.isArray(cachedProfiles) ? cachedProfiles.length : 0,
    languageOptimizationActive: isUserProfilesCached(),
    cacheHitPotential: isUserProfilesCached() ? 'High' : 'None'
  };
}

/**
 * Verify language persistence for debugging
 * Tests both cache and Firestore to ensure language settings persist correctly
 * @param {string} userId - User ID to verify
 * @returns {Promise<Object>} Verification results
 */
export async function verifyLanguagePersistence(userId) {
  if (!userId) {
    return {
      success: false,
      error: 'No user ID provided',
      details: {}
    };
  }

  const verification = {
    userId,
    timestamp: new Date().toISOString(),
    cache: { available: false, language: null, error: null },
    firestore: { available: false, language: null, error: null },
    consistency: { matches: false, recommendation: '' }
  };

  // Test cache
  try {
    const cachedProfiles = subscriptionManager.getCachedData('user-profiles');
    verification.cache.available = Array.isArray(cachedProfiles) && cachedProfiles.length > 0;
    
    if (verification.cache.available) {
      const userProfile = cachedProfiles.find(profile => profile && profile.id === userId);
      verification.cache.language = userProfile?.languagePreference || null;
    } else {
      verification.cache.error = 'No cached profiles available';
    }
  } catch (cacheError) {
    verification.cache.error = cacheError.message;
  }

  // Test Firestore
  try {
    const { getUserLanguagePreference } = await import('./firestore');
    verification.firestore.language = await getUserLanguagePreference(userId);
    verification.firestore.available = true;
  } catch (firestoreError) {
    verification.firestore.error = firestoreError.message;
  }

  // Check consistency
  const cacheLanguage = verification.cache.language || 'English';
  const firestoreLanguage = verification.firestore.language || 'English';
  
  verification.consistency.matches = cacheLanguage === firestoreLanguage;
  
  if (!verification.consistency.matches) {
    verification.consistency.recommendation = 
      'Cache and Firestore have different language preferences. ' +
      `Cache: ${cacheLanguage}, Firestore: ${firestoreLanguage}. ` +
      'Consider clearing cache or updating language preference.';
  } else if (cacheLanguage === 'English' && firestoreLanguage === 'English') {
    verification.consistency.recommendation = 
      'Both cache and Firestore show English. If user expects different language, ' +
      'they may need to update their profile language preference.';
  } else {
    verification.consistency.recommendation = 
      `Language preference consistent across cache and Firestore: ${cacheLanguage}`;
  }

  // Overall success
  verification.success = verification.cache.available && verification.firestore.available && 
                        verification.consistency.matches;

  return verification;
}

/**
 * Clear cached language preference for a user (force fresh fetch on next access)
 * @param {string} userId - User ID to clear cache for
 * @returns {boolean} Success status
 */
export function clearCachedUserLanguagePreference(userId) {
  if (!userId) {
    console.warn('No userId provided to clearCachedUserLanguagePreference');
    return false;
  }

  try {
    const cachedProfiles = subscriptionManager.getCachedData('user-profiles');
    
    if (Array.isArray(cachedProfiles)) {
      const profileIndex = cachedProfiles.findIndex(profile => profile && profile.id === userId);
      
      if (profileIndex !== -1) {
        // Remove the user's cached profile to force fresh fetch
        cachedProfiles.splice(profileIndex, 1);
        console.log('🧹 Cleared cached language preference for user:', userId);
        
        // Notify cache subscribers about the change
        try {
          const cacheSubscribers = subscriptionManager.cacheSubscribers?.get('user-profiles') || [];
          cacheSubscribers.forEach(callback => {
            try {
              callback(cachedProfiles);
            } catch (error) {
              console.error('Error notifying cache subscriber after clear:', error);
            }
          });
        } catch (notificationError) {
          console.warn('Error during cache clear notifications:', notificationError);
        }
        
        return true;
      } else {
        console.log('📦 No cached profile found for user, nothing to clear:', userId);
        return true; // Not an error, just nothing to clear
      }
    } else {
      console.log('📦 No cached profiles array, nothing to clear');
      return true;
    }
  } catch (error) {
    console.error('Error clearing cached language preference:', error);
    return false;
  }
}

export default {
  getCachedUserLanguagePreference,
  updateCachedUserLanguagePreference,
  clearCachedUserLanguagePreference,
  isUserProfilesCached,
  getLanguageIntegrationStats,
  verifyLanguagePersistence
};
