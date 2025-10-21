# MessageAI - Real-Time Messaging Platform

A complete messaging app built with React Native and Firebase. **Ready for testing** with full real-time features!

## 🚀 Quick Start for Testers

### 1. Prerequisites
- **Node.js** 18+ ([Download here](https://nodejs.org/))
- **macOS** recommended (for iOS testing)
- **5 minutes** to get running

### 2. Installation
```bash
git clone <repository-url>
cd msgapp/messageai

# Install dependencies
npm install
npm install -g @expo/cli

# For iOS (macOS only)
brew install cocoapods
```

### 3. Run the App
```bash
# Option A: Native iOS build (recommended)
npx expo run:ios

# Option B: Expo Go (scan QR code)
npm start
```

**🎉 That's it!** No Firebase setup needed - connects to pre-configured backend.

---

## ✨ What You Can Test

### 🔐 Authentication
- Create accounts with any email
- Choose nicknames and emoji icons
- Automatic login persistence

### 💬 Real-Time Messaging  
- Instant 1-on-1 messaging
- Group chats with multiple users
- Messages sync in real-time across devices

### 👥 Social Features
- See who's "Active now" or "Active 2m ago"
- Typing indicators ("User is typing...")
- Read receipts (✓ sent, ✓✓ read)

### 🎨 Advanced Features
- Push notifications when not in chat
- Offline message queueing
- Long press to delete chats
- Custom group names and icons
- Profile editing with emoji avatars

---

## 🧪 Testing Instructions

### Create Multiple Test Accounts
1. Sign up with `tester1@example.com`, `tester2@example.com`, etc.
2. Choose different nicknames and emojis
3. Create chats between accounts to test real-time sync

### Test Real-Time Features
- **Messaging**: Send messages and see them appear instantly
- **Typing**: Start typing to show "User is typing..." 
- **Presence**: Go online/offline to test status indicators
- **Read receipts**: Check ✓ vs ✓✓ message status

### Test Advanced Scenarios
- **Groups**: Create 3+ person group chats
- **Notifications**: Send message while in different chat
- **Offline**: Turn off WiFi, send messages, reconnect
- **Persistence**: Close app completely, reopen (stays logged in)

---

## 📁 Project Structure

```
msgapp/
├── messageai/          # Main React Native app
│   ├── App.js          # Root component
│   ├── screens/        # Login, Chat, Profile screens
│   ├── context/        # Auth, Notifications, Network
│   ├── utils/          # Firebase helpers, presence
│   └── components/     # Reusable UI components
├── functions/          # Firebase Cloud Functions
├── memory-bank/        # Project documentation
└── README.md          # This file
```

---

## 🔧 Troubleshooting

### App won't start?
```bash
npx expo start --clear
```

### iOS Simulator issues?
```bash
brew upgrade cocoapods
cd messageai/ios && pod install
```

### Need help?
- Check terminal for error messages
- Try web version: `cd messageai && npm run web`
- Restart iOS Simulator if frozen

---

## 🎯 What Makes This Special

This is a **production-ready messaging platform** featuring:

- 🚀 **Real-time sync** across all devices
- 📱 **Native performance** with React Native
- 🔒 **Enterprise-grade** Firebase backend  
- 🎨 **Polished UI/UX** with smooth animations
- ⚡ **Optimistic updates** for instant feel
- 🌐 **Offline support** with automatic sync

**Ready for deployment** with features that rival commercial messaging apps!

---

## 📱 Supported Platforms

- ✅ **iOS** (primary target)
- ✅ **Android** (cross-platform)  
- ✅ **Web** (for testing)

---

**Happy testing!** 🎉

*Questions? Check the detailed README in `/messageai/` directory.*
