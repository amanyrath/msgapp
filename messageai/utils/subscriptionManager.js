/**
 * Centralized Subscription Manager
 * Prevents redundant Firebase subscriptions and optimizes performance
 */

class SubscriptionManager {
  constructor() {
    // Track active subscriptions by unique keys
    this.activeSubscriptions = new Map();
    // Track subscription reference counts for shared subscriptions
    this.subscriptionRefs = new Map();
    // Cache data to avoid redundant fetches
    this.dataCache = new Map();
    // Track subscribers for cached data updates
    this.cacheSubscribers = new Map();
    
    console.log('🔄 SubscriptionManager initialized');
  }

  /**
   * Subscribe to a data source with deduplication
   * @param {string} key - Unique subscription key
   * @param {Function} subscribeFn - Function that returns unsubscribe function
   * @param {Function} callback - Data callback function
   * @param {Object} options - Subscription options
   * @returns {Function} Unsubscribe function
   */
  subscribe(key, subscribeFn, callback, options = {}) {
    const { 
      cache = true, 
      shared = true,
      priority = 'normal' // 'high', 'normal', 'low'
    } = options;

    console.log(`📡 Subscription request: ${key} (cache: ${cache}, shared: ${shared})`);

    // If subscription already exists and is shared, increment ref count
    if (shared && this.activeSubscriptions.has(key)) {
      const existingSub = this.activeSubscriptions.get(key);
      const currentRefs = this.subscriptionRefs.get(key) || 0;
      this.subscriptionRefs.set(key, currentRefs + 1);

      // Add callback to cache subscribers for data updates
      if (cache) {
        const subscribers = this.cacheSubscribers.get(key) || [];
        subscribers.push(callback);
        this.cacheSubscribers.set(key, subscribers);

        // Send cached data immediately if available
        const cachedData = this.dataCache.get(key);
        if (cachedData) {
          console.log(`📦 Sending cached data for ${key}`);
          callback(cachedData);
        }
      }

      console.log(`♻️  Reusing existing subscription: ${key} (refs: ${currentRefs + 1})`);

      // Return unsubscribe function that decrements ref count
      return () => this.unsubscribe(key, callback);
    }

    // Create new subscription
    console.log(`🆕 Creating new subscription: ${key}`);

    let actualUnsubscribe;

    try {
      // Wrap the callback to handle caching and multiple subscribers
      const wrappedCallback = (data) => {
        // Cache the data
        if (cache) {
          this.dataCache.set(key, data);
          
          // Notify all subscribers
          const subscribers = this.cacheSubscribers.get(key) || [];
          subscribers.forEach(subscriberCallback => {
            try {
              subscriberCallback(data);
            } catch (error) {
              console.error(`Error in subscription callback for ${key}:`, error);
            }
          });
        } else {
          // Direct callback for non-cached subscriptions
          callback(data);
        }
      };

      // Create the actual subscription
      actualUnsubscribe = subscribeFn(wrappedCallback);

      // Store subscription
      this.activeSubscriptions.set(key, actualUnsubscribe);
      this.subscriptionRefs.set(key, 1);

      // Setup cache subscribers
      if (cache) {
        this.cacheSubscribers.set(key, [callback]);
      }

      console.log(`✅ Subscription created: ${key}`);

    } catch (error) {
      console.error(`❌ Failed to create subscription ${key}:`, error);
      throw error;
    }

    // Return unsubscribe function
    return () => this.unsubscribe(key, callback);
  }

  /**
   * Unsubscribe from a data source
   * @param {string} key - Subscription key
   * @param {Function} callback - Original callback (for shared subscriptions)
   */
  unsubscribe(key, callback = null) {
    if (!this.activeSubscriptions.has(key)) {
      console.warn(`⚠️  Attempted to unsubscribe from non-existent subscription: ${key}`);
      return;
    }

    const currentRefs = this.subscriptionRefs.get(key) || 1;
    const newRefs = currentRefs - 1;

    console.log(`📤 Unsubscribe request: ${key} (refs: ${currentRefs} → ${newRefs})`);

    // Remove callback from cache subscribers if provided
    if (callback && this.cacheSubscribers.has(key)) {
      const subscribers = this.cacheSubscribers.get(key) || [];
      const updatedSubscribers = subscribers.filter(cb => cb !== callback);
      this.cacheSubscribers.set(key, updatedSubscribers);
    }

    // Only actually unsubscribe when no more references
    if (newRefs <= 0) {
      const unsubscribeFn = this.activeSubscriptions.get(key);
      
      try {
        if (typeof unsubscribeFn === 'function') {
          unsubscribeFn();
          console.log(`🗑️  Subscription destroyed: ${key}`);
        }
      } catch (error) {
        console.error(`❌ Error unsubscribing from ${key}:`, error);
      }

      // Clean up all data
      this.activeSubscriptions.delete(key);
      this.subscriptionRefs.delete(key);
      this.dataCache.delete(key);
      this.cacheSubscribers.delete(key);
    } else {
      // Just decrement reference count
      this.subscriptionRefs.set(key, newRefs);
      console.log(`📝 Subscription reference decremented: ${key} (refs: ${newRefs})`);
    }
  }

  /**
   * Force unsubscribe regardless of reference count
   * @param {string} key - Subscription key
   */
  forceUnsubscribe(key) {
    if (this.activeSubscriptions.has(key)) {
      const unsubscribeFn = this.activeSubscriptions.get(key);
      
      try {
        if (typeof unsubscribeFn === 'function') {
          unsubscribeFn();
        }
      } catch (error) {
        console.error(`❌ Error force unsubscribing from ${key}:`, error);
      }

      this.activeSubscriptions.delete(key);
      this.subscriptionRefs.delete(key);
      this.dataCache.delete(key);
      this.cacheSubscribers.delete(key);
      
      console.log(`🔥 Force unsubscribed: ${key}`);
    }
  }

  /**
   * Get cached data without subscribing
   * @param {string} key - Cache key
   * @returns {*} Cached data or null
   */
  getCachedData(key) {
    return this.dataCache.get(key) || null;
  }

  /**
   * Check if subscription is active
   * @param {string} key - Subscription key
   * @returns {boolean}
   */
  isActive(key) {
    return this.activeSubscriptions.has(key);
  }

  /**
   * Get current subscription stats
   * @returns {Object} Stats object
   */
  getStats() {
    return {
      activeSubscriptions: this.activeSubscriptions.size,
      totalReferences: Array.from(this.subscriptionRefs.values()).reduce((sum, refs) => sum + refs, 0),
      cachedItems: this.dataCache.size,
      subscriptions: Array.from(this.activeSubscriptions.keys())
    };
  }

  /**
   * Clean up expired cache entries and unused subscriptions
   */
  cleanup() {
    const stats = this.getStats();
    console.log('🧹 Running subscription cleanup...', stats);

    // Remove subscriptions with 0 references (shouldn't happen, but safety)
    for (const [key, refs] of this.subscriptionRefs.entries()) {
      if (refs <= 0) {
        this.forceUnsubscribe(key);
      }
    }

    console.log('✨ Cleanup completed');
  }

  /**
   * Unsubscribe from all subscriptions (app cleanup)
   */
  unsubscribeAll() {
    console.log('🛑 Unsubscribing from all subscriptions...');
    
    const keys = Array.from(this.activeSubscriptions.keys());
    keys.forEach(key => this.forceUnsubscribe(key));
    
    // Clear all data
    this.activeSubscriptions.clear();
    this.subscriptionRefs.clear();
    this.dataCache.clear();
    this.cacheSubscribers.clear();
    
    console.log('🧽 All subscriptions cleared');
  }
}

// Create global singleton instance
const subscriptionManager = new SubscriptionManager();

export default subscriptionManager;

// Export helper functions for common subscription patterns
export const subscribeWithManager = (key, subscribeFn, callback, options) => {
  return subscriptionManager.subscribe(key, subscribeFn, callback, options);
};

export const unsubscribeFromManager = (key, callback) => {
  return subscriptionManager.unsubscribe(key, callback);
};

export const getSubscriptionStats = () => {
  return subscriptionManager.getStats();
};
