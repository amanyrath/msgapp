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
  try {
    // Try to get from cached user profiles first (much faster)
    const cachedProfiles = subscriptionManager.getCachedData('user-profiles');
    
    if (cachedProfiles) {
      const userProfile = cachedProfiles.find(profile => profile.id === userId);
      
      if (userProfile) {
        // Return language preference or default to English if not set
        const language = userProfile.languagePreference || 'English';
        console.log('🚀 Language preference loaded from cache:', language);
        return language;
      }
    }

    // Fallback to original function if not in cache
    console.log('📦 Language preference not in cache, using direct Firestore call');
    const { getUserLanguagePreference } = await import('./firestore');
    return await getUserLanguagePreference(userId);
    
  } catch (error) {
    console.error('Error getting cached language preference:', error);
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
  try {
    // Update in Firestore (original functionality)
    const success = await updateUserLanguagePreference(userId, language);
    
    if (success) {
      // OPTIMIZATION: Update cached user profile if it exists
      const cachedProfiles = subscriptionManager.getCachedData('user-profiles');
      
      if (cachedProfiles) {
        const profileIndex = cachedProfiles.findIndex(profile => profile.id === userId);
        
        if (profileIndex !== -1) {
          // Update the cached profile
          cachedProfiles[profileIndex] = {
            ...cachedProfiles[profileIndex],
            languagePreference: language,
            updatedAt: new Date()
          };
          
          // Update the cache (this will notify all subscribers)
          const cacheSubscribers = subscriptionManager.cacheSubscribers?.get('user-profiles') || [];
          cacheSubscribers.forEach(callback => {
            try {
              callback(cachedProfiles);
            } catch (error) {
              console.error('Error updating cache subscriber:', error);
            }
          });
          
          console.log('✨ Language preference updated in cache and Firestore');
        }
      }
    }
    
    return success;
  } catch (error) {
    console.error('Error updating cached language preference:', error);
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

export default {
  getCachedUserLanguagePreference,
  updateCachedUserLanguagePreference,
  isUserProfilesCached,
  getLanguageIntegrationStats
};
