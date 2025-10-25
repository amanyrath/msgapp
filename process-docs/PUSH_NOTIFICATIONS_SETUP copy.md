# Push Notifications Setup Guide

This guide covers setting up push notifications for MessageAI across all platforms.

## Overview

MessageAI uses Expo's push notification service for cross-platform notifications. The app supports:
- ✅ Foreground notifications (working)
- ⚠️ Background notifications (requires setup)
- ✅ Notification tap-to-navigate (working)
- ✅ Smart notification filtering (working)

## Quick Setup (5 minutes)

### 1. Expo Push Notifications (Free)

The app is already configured for Expo Push Notifications. No additional setup needed for basic functionality.

```bash
# Test push notifications in development
cd messageai
npx expo start
```

### 2. Test Notifications

1. **Open app in Expo Go or development build**
2. **Sign up/login** - notifications auto-request permissions
3. **Send a message from another account**
4. **Switch to a different chat** - you should receive a notification

## Production Setup

### iOS (Apple Push Notification Service)

#### Prerequisites
- Apple Developer Account ($99/year)
- Access to Apple Developer Console
- Xcode installed (for key generation)

#### Steps

1. **Generate APNs Key**
   ```bash
   # In Apple Developer Console > Certificates, Identifiers & Profiles
   # 1. Go to Keys section
   # 2. Create new key with Apple Push Notifications service enabled
   # 3. Download the .p8 key file
   # 4. Note the Key ID and Team ID
   ```

2. **Upload to Expo**
   ```bash
   # Install EAS CLI
   npm install -g eas-cli
   
   # Login to Expo
   eas login
   
   # Upload APNs key
   eas credentials:configure --platform ios
   # Follow prompts to upload your .p8 file
   ```

3. **Build with Push Notifications**
   ```bash
   cd messageai
   eas build --platform ios --profile production
   ```

#### Configuration Files

Add to `app.json`:
```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.amanyrath.messageai",
      "supportsTablet": true
    },
    "notification": {
      "icon": "./assets/icon.png",
      "color": "#007AFF",
      "iosDisplayInForeground": true
    }
  }
}
```

### Android (Firebase Cloud Messaging)

#### Prerequisites
- Google Cloud Platform account (free)
- Firebase project (already configured)

#### Steps

1. **Enable FCM in Firebase Console**
   ```bash
   # 1. Go to Firebase Console > Project Settings
   # 2. Cloud Messaging tab
   # 3. Generate new key pair if needed
   # 4. Copy the Server Key
   ```

2. **Upload to Expo**
   ```bash
   eas credentials:configure --platform android
   # Upload your Firebase server key when prompted
   ```

3. **Build with Push Notifications**
   ```bash
   cd messageai
   eas build --platform android --profile production
   ```

#### Configuration Files

Ensure `google-services.json` is in the project root (already done).

## Background Notifications (Advanced)

For full background notification support, you'll need Cloud Functions:

### 1. Enable Cloud Functions

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Initialize Cloud Functions
firebase init functions

# Choose JavaScript/TypeScript
```

### 2. Create Notification Function

Create `functions/src/sendNotification.js`:

```javascript
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
    const chatDoc = await admin.firestore().doc(`chats/${chatId}`).get();
    const members = chatDoc.data().members;
    
    // Get tokens for recipients (excluding sender)
    const recipients = members.filter(memberId => memberId !== message.senderId);
    
    // Send notifications
    // Implementation details...
  });
```

### 3. Deploy Cloud Functions

```bash
firebase deploy --only functions
```

## Testing Push Notifications

### Development Testing

1. **Foreground Notifications**
   ```bash
   # 1. Open app in simulator/device
   # 2. Sign in with one account
   # 3. Open a chat with messages
   # 4. Navigate away from that chat
   # 5. Send message from another device/account
   # 6. Should see notification
   ```

2. **Permission Testing**
   ```bash
   # 1. Delete app from device
   # 2. Reinstall and open
   # 3. Should request permission on first message
   # 4. Test both "Allow" and "Deny" scenarios
   ```

### Production Testing

1. **TestFlight (iOS)**
   ```bash
   eas build --platform ios --profile preview
   # Upload to App Store Connect for TestFlight
   ```

2. **Internal Testing (Android)**
   ```bash
   eas build --platform android --profile preview
   # Distribute APK or upload to Play Console
   ```

## Troubleshooting

### Common Issues

#### "No Notification Permission"
```bash
# Solution: Reset app permissions
# iOS: Settings > MessageAI > Notifications > Allow
# Android: Settings > Apps > MessageAI > Notifications > Allow
```

#### "Notifications Not Showing"
```bash
# Check:
# 1. Are you in the active chat? (notifications are filtered)
# 2. Is the app in foreground? (background needs Cloud Functions)
# 3. Did you grant permissions?
# 4. Check Expo push tool: https://expo.dev/notifications
```

#### "APNs Key Issues"
```bash
# Common fixes:
# 1. Ensure key has Apple Push Notifications enabled
# 2. Verify Team ID matches
# 3. Re-download key from Apple Developer console
# 4. Re-upload to Expo credentials
```

### Debug Commands

```bash
# Test push token registration
npx expo start --clear
# Check logs for "Push token:" messages

# Test notification delivery
# Use Expo Push Tool: https://expo.dev/notifications
# Send test notification with your push token

# Check Firebase console
# Functions > Logs (if using Cloud Functions)

# Check device logs
# iOS: Xcode > Window > Devices and Simulators > Select device > View device logs
# Android: adb logcat
```

## Notification Features

### Current Features ✅
- Permission request on app startup
- Foreground notification display
- Notification tap navigation to chat
- Smart filtering (no notifications for current chat or own messages)
- Cross-platform support (iOS/Android)

### Planned Features 📋
- Background notifications via Cloud Functions
- Rich notifications with message preview
- Notification badges with unread count
- Silent notifications for read receipts
- Group notification threading

## Security Considerations

### APNs Key Security
- Never commit `.p8` files to version control
- Store keys securely (use Expo credentials service)
- Rotate keys annually
- Use team-specific keys, not personal

### Firebase Security
- Secure server keys in environment variables
- Use Firebase security rules to prevent abuse
- Monitor usage in Firebase console
- Set up billing alerts

### Privacy
- Respect user notification preferences
- Don't send sensitive data in notification body
- Allow users to disable notifications
- Follow platform notification guidelines

## Cost Estimates

### Expo Push Notifications
- **Free tier**: 1M notifications/month
- **Paid**: $1 per additional million
- No setup costs

### Firebase Cloud Messaging
- **Free**: Unlimited notifications
- **Cloud Functions**: Pay per execution (~$0.0001 per notification)

### Apple Developer
- **Required**: $99/year for App Store distribution
- **APNs**: Free with developer account

## Performance

### Notification Delivery Times
- **Foreground**: < 1 second
- **Background** (with Cloud Functions): 1-3 seconds
- **Cross-platform**: Consistent timing

### Battery Impact
- Minimal impact using system notification services
- No background processing in app
- Efficient token management

## Next Steps

1. **Test current setup** - Foreground notifications should work immediately
2. **Set up APNs** - For iOS production builds
3. **Configure FCM** - For Android production builds  
4. **Add Cloud Functions** - For background notifications
5. **Deploy to stores** - Full production setup

For questions or issues, check the troubleshooting section or create an issue in the repository.
