# Testing Push Notifications

## Overview
The app now supports **foreground push notifications** - when a new message arrives and you're not viewing that chat, you'll see a notification banner.

## How It Works

### Smart Notification Logic
- ✅ Shows notifications for new messages
- ❌ **Doesn't** show notifications for:
  - Messages you send yourself
  - Messages in the currently open chat
  - Messages that were already there when you opened the app

### Notification Content
- **Direct Chat**: Shows sender's name + message text
- **Group Chat**: Shows sender's name + message text

### Notification Actions
- **Tap notification**: Opens the chat automatically
- **Ignore notification**: Stays in current screen

## Testing Steps

### Setup (One Time)
1. Make sure you have the latest code
2. Run `npm install` in the `messageai` directory
3. Start the app: `npx expo start`

### Test 1: Direct Chat Notification
1. **Device 1**: Login as User A
2. **Device 2**: Login as User B
3. **Device 1**: Open a different chat (or stay on ChatList)
4. **Device 2**: Send message to User A
5. **Device 1**: Should see notification banner! 🎉

### Test 2: No Notification When Chat Is Open
1. **Device 1**: Login as User A
2. **Device 2**: Login as User B
3. **Device 1**: Open chat with User B
4. **Device 2**: Send message to User A
5. **Device 1**: Should NOT see notification (you're already in the chat)

### Test 3: Group Chat Notification
1. **Device 1**: Login as User A
2. **Device 2**: Login as User B
3. **Device 3**: Login as User C
4. Create a group chat with all three users
5. **Device 1**: Go back to ChatList
6. **Device 2**: Send message to group
7. **Device 1**: Should see notification with User B's name

### Test 4: Notification Tap
1. **Device 1**: Login as User A (on ChatList)
2. **Device 2**: Login as User B
3. **Device 2**: Send message to User A
4. **Device 1**: See notification appear
5. **Device 1**: Tap the notification
6. **Device 1**: Should navigate directly to the chat!

### Test 5: Permission Request
1. Fresh install or reset permissions
2. Login to the app
3. Should see iOS/Android permission request
4. Grant permissions
5. Test notifications work

## Troubleshooting

### Notifications Not Showing?

**Check 1: Permissions**
- iOS: Settings → MessageAI → Notifications → Allow Notifications
- Android: Settings → Apps → MessageAI → Notifications → Enabled

**Check 2: Console Logs**
Look for these messages:
- `Notification permissions granted` - Permissions OK
- `📬 Notification shown for message from [name]` - Notification sent
- `📵 Notifications disabled for chat: [id]` - Current chat
- `🔔 Notifications re-enabled` - Left chat

**Check 3: Device Requirements**
- iOS Simulator: ✅ Foreground notifications work
- Android Emulator: ✅ Foreground notifications work
- Real devices: ✅ Work on both

### Notification Shows for Own Messages?
- This is a bug - should NOT happen
- Check console for `message.senderId !== user.uid` logic

### Notification Shows When Chat Is Open?
- Check that `setActiveChatId()` is being called
- Look for `📵 Notifications disabled` log

### Permission Denied?
- Reset app: Delete and reinstall
- Or manually enable in device settings

## How to Test on Multiple Devices

### Option 1: Multiple Simulators (iOS)
```bash
# Terminal 1 - Start app
cd messageai
npx expo start

# Terminal 2 - Simulator 1
xcrun simctl boot <DEVICE_ID_1>
open -a Simulator

# Terminal 3 - Simulator 2
xcrun simctl boot <DEVICE_ID_2>
open -a Simulator

# Both simulators can run the same Expo app
```

### Option 2: Simulator + Physical Device
```bash
# Start with tunnel
cd messageai
npx expo start --tunnel

# Scan QR code on physical device with Expo Go
```

### Option 3: Two Physical Devices
```bash
# Start with tunnel
cd messageai
npx expo start --tunnel

# Scan QR code on both devices
```

## Expected Behavior

### ✅ Working Correctly
- Notification appears at top of screen
- Shows sender name and message preview
- Plays sound (if device not muted)
- Tapping opens the correct chat
- No notification when chat is already open
- No notification for own messages

### ❌ Known Limitations (MVP)
- No background notifications (app must be open)
- No push tokens (no server-side push)
- No notification grouping
- No notification clear when message is read elsewhere
- No custom notification sounds per chat
- No notification actions (reply, mark as read)

## Next Steps (Post-MVP)

These features would require Firebase Cloud Functions:
1. **Background Notifications**: Push notifications when app is closed
2. **Push Tokens**: Send notifications via FCM
3. **Notification Badges**: Unread count on app icon
4. **Rich Notifications**: Images, inline reply
5. **Notification Groups**: Combine multiple messages
6. **Server-Side**: Send notifications from backend

## Technical Details

### Files Modified
- `utils/notifications.js` - Notification helper functions
- `context/NotificationContext.js` - Global message listener
- `App.js` - Permission request & notification tap handler
- `screens/ChatScreen.js` - Active chat tracking
- `app.json` - Notification plugin configuration

### How It Works Under the Hood
1. **NotificationContext** subscribes to all user's chats
2. For each chat, listens to the most recent message
3. When new message arrives:
   - Check if it's from current user (skip)
   - Check if chat is currently open (skip)
   - Check if message was already processed (skip)
   - Show notification! 🎉
4. **ChatScreen** reports when it's active
5. **App.js** handles notification taps to navigate

### Notification Flow
```
New Message
    ↓
NotificationContext listener fires
    ↓
Check: From self? → Skip
    ↓
Check: Chat open? → Skip
    ↓
Check: Already shown? → Skip
    ↓
showMessageNotification()
    ↓
expo-notifications schedules local notification
    ↓
Notification appears on device
    ↓
User taps notification
    ↓
App.js notification response listener fires
    ↓
Navigate to chat
```

## Success Criteria ✅

Your notifications are working if:
- [x] Permission request shows on login
- [x] Notification appears for new messages
- [x] NO notification when chat is open
- [x] Tapping notification opens the chat
- [x] Notification shows sender name
- [x] Notification plays sound
- [x] Works in iOS Simulator
- [x] Works in Android Emulator


