const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

// Import and export all functions
const { 
  sendInstantMessageNotification, 
  cleanupPushTokens 
} = require('./pushNotifications');

// Export functions for Firebase Functions
exports.sendInstantMessageNotification = sendInstantMessageNotification;
exports.cleanupPushTokens = cleanupPushTokens;
