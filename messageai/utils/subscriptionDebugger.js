/**
 * Subscription Debugger - Monitor and debug subscription performance
 */

import subscriptionManager from './subscriptionManager';

class SubscriptionDebugger {
  constructor() {
    this.enabled = __DEV__; // Only enable in development
    this.logHistory = [];
    this.maxHistorySize = 100;
    
    if (this.enabled) {
      console.log('🔧 SubscriptionDebugger initialized');
      this.startMonitoring();
    }
  }

  /**
   * Start monitoring subscription changes
   */
  startMonitoring() {
    // Log subscription stats periodically
    this.monitoringInterval = setInterval(() => {
      this.logSubscriptionStats();
    }, 10000); // Every 10 seconds
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }

  /**
   * Log current subscription statistics
   */
  logSubscriptionStats() {
    if (!this.enabled) return;

    const stats = subscriptionManager.getStats();
    const logEntry = {
      timestamp: new Date().toISOString(),
      stats,
      performanceScore: this.calculatePerformanceScore(stats)
    };

    this.addToHistory(logEntry);

    // Only log if there are active subscriptions
    if (stats.activeSubscriptions > 0) {
      console.log('📊 Subscription Stats:', {
        active: stats.activeSubscriptions,
        refs: stats.totalReferences,
        cached: stats.cachedItems,
        efficiency: `${Math.round(logEntry.performanceScore)}%`,
        subscriptions: stats.subscriptions
      });
    }
  }

  /**
   * Calculate performance efficiency score
   * @param {Object} stats - Subscription stats
   * @returns {number} Performance score 0-100
   */
  calculatePerformanceScore(stats) {
    if (stats.totalReferences === 0) return 100;

    // Efficiency = (References / Active Subscriptions) * 100
    // Higher is better (more sharing = fewer actual Firebase connections)
    const sharingRatio = stats.totalReferences / Math.max(stats.activeSubscriptions, 1);
    const baseScore = Math.min(sharingRatio * 20, 80); // Max 80 from sharing

    // Bonus points for caching
    const cachingBonus = stats.cachedItems > 0 ? 20 : 0;

    return Math.min(baseScore + cachingBonus, 100);
  }

  /**
   * Add log entry to history
   * @param {Object} entry - Log entry
   */
  addToHistory(entry) {
    this.logHistory.push(entry);
    
    // Maintain history size
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory = this.logHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get subscription analysis report
   * @returns {Object} Analysis report
   */
  getAnalysisReport() {
    const stats = subscriptionManager.getStats();
    const currentScore = this.calculatePerformanceScore(stats);
    
    // Calculate trend if we have history
    let trend = 'stable';
    if (this.logHistory.length >= 2) {
      const recent = this.logHistory.slice(-5).map(entry => entry.performanceScore);
      const avg = recent.reduce((sum, score) => sum + score, 0) / recent.length;
      
      if (currentScore > avg + 5) trend = 'improving';
      else if (currentScore < avg - 5) trend = 'degrading';
    }

    return {
      currentStats: stats,
      performanceScore: currentScore,
      trend,
      recommendations: this.getRecommendations(stats),
      comparedToBaseline: this.getBaselineComparison(),
      history: this.logHistory.slice(-10) // Last 10 entries
    };
  }

  /**
   * Get optimization recommendations
   * @param {Object} stats - Current subscription stats
   * @returns {Array} Array of recommendation strings
   */
  getRecommendations(stats) {
    const recommendations = [];

    // Check for potential issues
    if (stats.activeSubscriptions > 8) {
      recommendations.push('⚠️  High number of active subscriptions - consider more sharing');
    }

    if (stats.totalReferences < stats.activeSubscriptions * 1.5) {
      recommendations.push('💡 Low sharing ratio - look for duplicate subscriptions');
    }

    if (stats.cachedItems < stats.activeSubscriptions * 0.5) {
      recommendations.push('📦 Consider enabling caching for more subscriptions');
    }

    // Positive feedback
    if (stats.totalReferences > stats.activeSubscriptions * 2) {
      recommendations.push('✅ Great subscription sharing ratio!');
    }

    if (recommendations.length === 0) {
      recommendations.push('🎯 Subscription usage looks optimal');
    }

    return recommendations;
  }

  /**
   * Compare current performance to unoptimized baseline
   * @returns {Object} Comparison metrics
   */
  getBaselineComparison() {
    const stats = subscriptionManager.getStats();
    
    // Estimate what subscriptions would be without optimization
    // Based on original analysis: 5 subscriptions per ChatScreen + 3 in ChatListScreen + 1 in NotificationContext
    const estimatedUnoptimizedSubscriptions = 9; // Conservative estimate
    
    const reduction = Math.max(0, estimatedUnoptimizedSubscriptions - stats.activeSubscriptions);
    const reductionPercent = Math.round((reduction / estimatedUnoptimizedSubscriptions) * 100);

    return {
      estimatedOriginalSubscriptions: estimatedUnoptimizedSubscriptions,
      currentSubscriptions: stats.activeSubscriptions,
      reduction,
      reductionPercent,
      estimatedBatteryImprovement: `${Math.min(reductionPercent, 70)}%`, // Cap at 70%
      estimatedBandwidthSaving: `${Math.min(reductionPercent * 0.8, 60)}%` // Slightly lower
    };
  }

  /**
   * Print detailed analysis to console
   */
  printAnalysis() {
    if (!this.enabled) {
      console.log('🔧 Subscription debugging is disabled in production');
      return;
    }

    const report = this.getAnalysisReport();
    
    console.log('\n🔍 ====== SUBSCRIPTION ANALYSIS REPORT ======');
    console.log('📊 Current Stats:', report.currentStats);
    console.log('⚡ Performance Score:', `${Math.round(report.performanceScore)}%`);
    console.log('📈 Trend:', report.trend);
    console.log('\n💡 Recommendations:');
    report.recommendations.forEach(rec => console.log('  ', rec));
    
    console.log('\n📊 Optimization Impact:');
    const comparison = report.comparedToBaseline;
    console.log('  ', `🔥 Subscription Reduction: ${comparison.reduction} (${comparison.reductionPercent}%)`);
    console.log('  ', `🔋 Estimated Battery Improvement: ${comparison.estimatedBatteryImprovement}`);
    console.log('  ', `📡 Estimated Bandwidth Saving: ${comparison.estimatedBandwidthSaving}`);
    console.log('===============================================\n');
  }

  /**
   * Create performance monitoring hook for React components
   * @param {string} componentName - Name of component for tracking
   * @returns {Function} Hook function
   */
  createPerformanceHook(componentName) {
    return () => {
      if (!this.enabled) return;

      const startTime = performance.now();
      
      return {
        logSubscriptionCreated: (subscriptionKey) => {
          const endTime = performance.now();
          console.log(`🚀 ${componentName}: Subscription '${subscriptionKey}' created in ${Math.round(endTime - startTime)}ms`);
        },
        
        logCacheHit: (subscriptionKey) => {
          const endTime = performance.now();
          console.log(`⚡ ${componentName}: Cache hit for '${subscriptionKey}' in ${Math.round(endTime - startTime)}ms`);
        }
      };
    };
  }
}

// Create global debugger instance
const subscriptionDebugger = new SubscriptionDebugger();

// Export utility functions
export const printSubscriptionAnalysis = () => subscriptionDebugger.printAnalysis();
export const getSubscriptionReport = () => subscriptionDebugger.getAnalysisReport();
export const createSubscriptionHook = (componentName) => subscriptionDebugger.createPerformanceHook(componentName);

export default subscriptionDebugger;
