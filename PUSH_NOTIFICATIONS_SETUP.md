# Push Notifications E2E Setup Guide

This guide provides complete end-to-end setup for push notifications in the MessageAI app using Expo Notifications and Firebase Cloud Messaging.

## Overview

The MessageAI app uses:
- **Expo Notifications** - Cross-platform notification handling
- **Firebase Cloud Messaging (FCM)** - Message delivery infrastructure
- **Apple Push Notification Service (APNs)** - iOS notifications (production)
- **Local notifications** - Development and foreground handling

## Current Implementation Status

### ✅ Currently Working
- **Foreground notifications** - Shows notifications when app is open
- **Local notification system** - Handles message alerts in-app
- **Smart filtering** - No notifications for own messages or current chat
- **Notification navigation** - Tap to open specific chat
- **Cross-platform support** - iOS and Android compatible

### 🔧 Production Setup Required
- **Background notifications** - Requires Firebase Cloud Functions
- **APNs certificates** - For iOS production builds
- **FCM server key** - For Android production notifications
- **Push token management** - Registration and updates

## Development Setup (Current)

### Expo Go Development
```javascript
// Already configured in app.json
"notification": {
  "icon": "./assets/icon.png",
  "color": "#007AFF",
  "androidMode": "default",
  "androidCollapsedTitle": "New messages"
}
```

### Local Notifications (Working)
The app currently uses local notifications for development:

```javascript
// messageai/utils/notifications.js
import * as Notifications from 'expo-notifications';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
```

## Production Setup Steps

### 1. Apple Developer Account Setup (iOS)

#### Required: Apple Developer Account ($99/year)
1. **Enroll in Apple Developer Program**
   - Visit: https://developer.apple.com/programs/
   - Cost: $99 USD per year
   - Required for: App Store distribution, push notifications

#### Generate APNs Authentication Key
1. **Login to Apple Developer Console**
   - Go to: https://developer.apple.com/account/
   
2. **Create APNs Key**
   - Navigate: Certificates, Identifiers & Profiles > Keys
   - Click: Create a key (+)
   - Name: "MessageAI Push Notifications"
   - Services: Check "Apple Push Notifications service (APNs)"
   - Register and Download the .p8 file
   
3. **Save Key Information**
   ```
   Key ID: ABC1234567 (from Apple Developer Console)
   Team ID: DEF7890123 (from Apple Developer Console)
   Bundle ID: com.amanyrath.messageai (from app.json)
   Auth Key File: AuthKey_ABC1234567.p8
   ```

#### Alternative: APNs Certificate (Legacy)
If you prefer certificates over keys:
1. Create Certificate Signing Request (CSR)
2. Generate Apple Push Notification SSL Certificate
3. Download and convert to .p12 format
4. Upload to Firebase Console

### 2. Firebase Cloud Messaging Setup

#### Upload APNs Credentials to Firebase
1. **Open Firebase Console**
   - Project: https://console.firebase.google.com/project/msgapp-74ca2
   - Navigate: Project Settings > Cloud Messaging > iOS app configuration

2. **Upload APNs Authentication Key (Recommended)**
   ```
   Upload: AuthKey_ABC1234567.p8
   Key ID: ABC1234567
   Team ID: DEF7890123
   ```
   
   OR upload APNs Certificate (.p12 file)

3. **Android FCM Setup**
   - No additional setup required
   - FCM works automatically with Firebase project

#### Get Server Credentials
```bash
# For server-side sending (Cloud Functions)
# Go to Firebase Console > Project Settings > Service Accounts
# Generate new private key for Firebase Admin SDK
# Download JSON file for Cloud Functions
```

### 3. Expo Application Services (EAS) Configuration

#### Update eas.json for Push Notifications
```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "buildConfiguration": "Release"
      }
    },
    "production": {
      "ios": {
        "buildConfiguration": "Release"
      },
      "android": {
        "buildType": "apk"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your.apple.id@email.com",
        "ascAppId": "1234567890",
        "appleTeamId": "DEF7890123"
      },
      "android": {
        "serviceAccountKeyPath": "path/to/google-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

#### Configure Push Notification Credentials
```bash
# Set up push notification credentials
eas credentials:configure

# For iOS, you'll be prompted to:
# - Upload APNs key or certificate
# - Provide Team ID and Key ID
# - Configure distribution certificate

# For Android:
# - FCM is automatically configured via Firebase
```

### 4. App Configuration Updates

#### Update app.json for Production
```json
{
  "expo": {
    "notification": {
      "icon": "./assets/icon.png", 
      "color": "#007AFF",
      "androidMode": "default",
      "androidCollapsedTitle": "New messages",
      "iosDisplayInForeground": true
    },
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/icon.png",
          "color": "#007AFF", 
          "sounds": ["notification_sound"],
          "mode": "production"
        }
      ]
    ]
  }
}
```

#### Notification Permission Handling
```javascript
// messageai/utils/notifications.js - Add permission request
export async function registerForPushNotificationsAsync() {
  let token;
  
  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      alert('Failed to get push token for push notification!');
      return;
    }
    
    token = (await Notifications.getExpoPushTokenAsync({
      projectId: '9a4e5f8e-5788-49cf-babe-ff1d1bf98ae6'
    })).data;
  } else {
    alert('Must use physical device for Push Notifications');
  }
  
  return token;
}
```

### 5. Firebase Cloud Functions (Background Notifications)

#### Required for Background Notifications
Background push notifications require server-side triggers. Here's the Cloud Function setup:

```javascript
// functions/src/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Expo } = require('expo-server-sdk');

admin.initializeApp();
const expo = new Expo();

exports.sendMessageNotification = functions.firestore
  .document('chats/{chatId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const chatId = context.params.chatId;
    
    // Get chat members
    const chatDoc = await admin.firestore()
      .collection('chats')
      .doc(chatId)
      .get();
    
    const chat = chatDoc.data();
    const recipientIds = chat.members.filter(id => id !== message.senderId);
    
    // Get push tokens for recipients  
    const userDocs = await admin.firestore()
      .collection('users')
      .where(admin.firestore.FieldPath.documentId(), 'in', recipientIds)
      .get();
    
    const notifications = [];
    
    userDocs.forEach(userDoc => {
      const user = userDoc.data();
      if (user.pushToken && Expo.isExpoPushToken(user.pushToken)) {
        notifications.push({
          to: user.pushToken,
          sound: 'default',
          title: chat.name || 'New Message',
          body: message.text,
          data: { chatId, messageId: snap.id }
        });
      }
    });
    
    // Send notifications
    const chunks = expo.chunkPushNotifications(notifications);
    const tickets = [];
    
    for (let chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Error sending notifications:', error);
      }
    }
    
    return { success: true, ticketsSent: tickets.length };
  });
```

#### Deploy Cloud Functions
```bash
# Navigate to functions directory
cd functions

# Install dependencies
npm install firebase-functions firebase-admin expo-server-sdk

# Deploy function
firebase deploy --only functions
```

### 6. Testing Push Notifications

#### Development Testing (Expo Go)
1. **Install Expo Go** on physical device
2. **Run development server**: `npx expo start`
3. **Scan QR code** to open app
4. **Test foreground notifications** - Already working
5. **Background notifications** require Cloud Functions

#### Production Testing (Standalone App)
1. **Build standalone app**: `eas build --platform ios --profile preview`
2. **Install on device** via TestFlight or direct install
3. **Test all notification scenarios**:
   - App in foreground
   - App in background  
   - App closed completely
   - Different message types

### 7. Notification Categories and Actions

#### Rich Notifications (Optional)
```javascript
// Configure notification categories
await Notifications.setNotificationCategoryAsync('message', [
  {
    identifier: 'reply',
    buttonTitle: 'Reply',
    options: {
      opensAppToForeground: true,
    },
  },
  {
    identifier: 'mark_read',
    buttonTitle: 'Mark as Read',
    options: {
      opensAppToForeground: false,
    },
  },
]);
```

## Environment Variables for Production

Add to your production environment:

```bash
# messageai/.env (production)
USE_EMULATORS=false
OPENAI_API_KEY=your_production_openai_key
EAS_PROJECT_ID=9a4e5f8e-5788-49cf-babe-ff1d1bf98ae6

# Firebase Cloud Functions environment
EXPO_ACCESS_TOKEN=your_expo_access_token
```

## Security Considerations

### Push Token Management
- **Store securely** - Push tokens in Firestore user documents
- **Update regularly** - Tokens can change, implement refresh logic
- **Validate tokens** - Check if tokens are valid before sending
- **Handle failures** - Remove invalid tokens from database

### Privacy and Compliance
- **User consent** - Request permission appropriately
- **Content filtering** - Don't send sensitive data in notifications
- **Delivery receipts** - Handle notification delivery failures
- **Unsubscribe** - Allow users to disable notifications

## Troubleshooting

### Common Issues

#### iOS Notifications Not Working
```bash
# Check APNs configuration
# Verify Bundle ID matches Apple Developer Console
# Ensure APNs key/certificate is valid
# Check device registration in Firebase Console
```

#### Android Notifications Not Working  
```bash
# Verify FCM configuration in Firebase
# Check Google Services JSON file
# Ensure app is built with production profile
# Test with Firebase Console messaging
```

#### Permission Denied
```javascript
// Handle permission gracefully
const { status } = await Notifications.getPermissionsAsync();
if (status !== 'granted') {
  // Show explanation and request again
  Alert.alert(
    'Notifications Disabled',
    'Enable notifications to receive new messages when the app is closed.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Settings', onPress: () => Linking.openSettings() }
    ]
  );
}
```

## Quick Reference

### Essential Commands
```bash
# Configure push credentials
eas credentials:configure

# Build with notifications
eas build --platform ios --profile production

# Test notification sending
firebase functions:shell
> sendMessageNotification({chatId: 'test', messageId: 'test'})

# View notification logs
firebase functions:log --only sendMessageNotification
```

### Key Files Modified
- `messageai/app.json` - Notification configuration
- `messageai/utils/notifications.js` - Notification handling
- `messageai/eas.json` - Build configuration  
- `functions/src/index.js` - Cloud Functions for background notifications

### Production Checklist
- [ ] Apple Developer Account active
- [ ] APNs key/certificate uploaded to Firebase
- [ ] Push token registration implemented
- [ ] Cloud Functions deployed for background notifications
- [ ] Notification permissions requested appropriately
- [ ] Production builds tested on physical devices
- [ ] Notification delivery and failure handling implemented

This setup enables full E2E push notifications for MessageAI in both development and production environments.
