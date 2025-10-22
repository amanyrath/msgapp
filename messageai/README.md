# MessageAI — Real-Time Messaging Platform

A production-ready messaging platform built with React Native (Expo) and Firebase. Features real-time messaging, group chats, presence indicators, push notifications, and offline sync.

## 🚀 Quick Start (3 minutes)

### System Requirements
- **Node.js** v18+ ([Download](https://nodejs.org/))
- **npm** v8+ (comes with Node.js)
- **macOS**: CocoaPods (`brew install cocoapods`)
- **iOS Simulator** or **Expo Go app**

### Installation & Run

```bash
# Clone and navigate
cd messageai

# Install dependencies
npm install

# Start development server
npm start
# Then: scan QR code with Expo Go or press 'i' for iOS simulator
```

### First Time Setup

1. **Create account** - Use any email (e.g., `test@example.com`)
2. **Choose nickname** - Your display name in chats
3. **Pick emoji avatar** - Represents you across the app
4. **Start messaging** - Tap + to create chats

**🎉 Ready to test!** The app connects to production Firebase.

## 🎯 Complete Feature Set

### 🔐 Authentication & Profiles
- **Email/password authentication** with Firebase Auth
- **Custom user profiles** with nicknames and emoji avatars  
- **Session persistence** - stay logged in across app restarts
- **Profile editing** - update nickname and avatar anytime

### 💬 Real-Time Messaging
- **Instant messaging** with sub-second delivery
- **Group chats** with unlimited participants
- **Message read receipts** (WhatsApp-style ✓ and ✓✓)
- **Typing indicators** - see when others are typing
- **Message history** - persistent across devices
- **Optimistic UI** - messages appear instantly

### 👥 Presence & Social
- **Real-time presence** - green dots for online users
- **Activity status** - "Active now", "Active 5m ago"
- **Chat list** with unread message badges
- **User discovery** - find all registered users
- **Profile pictures** with emoji avatars

### 📱 Mobile Experience  
- **Push notifications** (foreground, background setup included)
- **Offline sync** - messages queue and sync when reconnected
- **Network monitoring** - visual indicators for connection status
- **Error recovery** - automatic retry with exponential backoff
- **Native performance** - 60fps scrolling, instant interactions

### 🔧 Developer Features
- **Hot reload** for instant development iteration
- **Comprehensive logging** with dev/production modes
- **Automated testing** with Jest and React Native Testing Library
- **CI/CD pipeline** with GitHub Actions
- **Firebase emulator** support for local development

## 🧪 Testing Guide

### Multi-User Testing
Create multiple accounts to test real-time features:
```bash
# Account 1: alice@test.com (nickname: Alice, avatar: 👩)
# Account 2: bob@test.com (nickname: Bob, avatar: 👨)
# Password: test123 (or any 6+ characters)
```

### Core Features Test
1. **Authentication**
   - Sign up with different emails
   - Log out and log back in
   - Close app completely and reopen

2. **Real-Time Messaging** 
   - Send messages between accounts
   - Messages should appear in < 1 second
   - Test with multiple devices/browsers

3. **Group Chats**
   - Create chat with 3+ people
   - Test group messaging
   - Verify all members receive messages

4. **Presence System**
   - Check green dots for online users
   - Test "Active now" vs "Active 5m ago"
   - Go offline and verify status changes

5. **Read Receipts**
   - Send message (should show ✓) 
   - Recipient opens chat (should show ✓✓)
   - Test in group chats (requires ALL to read)

6. **Offline Sync**
   - Disconnect WiFi, send messages
   - Reconnect - messages should sync
   - Test on both sender and receiver

### Push Notifications Test
1. **Setup**: Grant notification permissions on first launch
2. **Test**: Send message from Account A to Account B
3. **Verify**: Account B should receive notification (if not in that chat)
4. **Tap**: Notification should navigate to the correct chat

### Performance Test
- **Scrolling**: Should be smooth at 60fps
- **Message load**: History should load instantly from cache
- **Network changes**: Should handle connection drops gracefully

## ✅ Quick Verification Test

### 30-Second Test
1. **Launch**: `npx expo run:ios` (or `npm start` + scan QR code)
2. **Sign Up**: Create account with any email/password + nickname + emoji
3. **Send Message**: Tap + to start a chat, send a test message
4. **Success**: Message appears with ✓ (sent) then ✓✓ (read)

**Working?** 🎉 You're ready to fully test all features!

## 🏗️ Development Setup

### Project Structure
```
messageai/
├── screens/           # App screens (Login, Chat, etc.)
├── components/        # Reusable UI components
├── context/          # React Context providers (Auth, Network, etc.)
├── utils/            # Helper functions (Firebase, photos, etc.)
├── config/           # Configuration files
├── __tests__/        # Test files
└── assets/           # Images, icons, splash screens
```

### Branch Strategy
- **`main`** - Production-ready code, auto-deploys
- **`dev`** - Development branch, integration testing
- **`feature/*`** - Feature branches, merge to dev
- **`hotfix/*`** - Emergency fixes, merge to main

### Development Commands
```bash
# Development
npm start              # Start Expo dev server
npm run ios           # Run on iOS simulator  
npm run android       # Run on Android emulator
npm run web           # Run web version

# Code Quality
npm run lint          # Run ESLint
npm run format        # Format with Prettier
npm test              # Run Jest tests
npm run test:watch    # Run tests in watch mode

# Building
eas build --platform android --profile preview  # Android APK
eas build --platform ios --profile preview      # iOS build
```

### Environment Setup
1. **Copy environment template**
   ```bash
   cp .env.example .env.local
   ```

2. **Configure Firebase** (optional - uses shared config by default)
   ```bash
   # Get config from Firebase Console > Project Settings
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
   ```

3. **Toggle development mode**
   ```bash
   # For local development with emulators
   EXPO_PUBLIC_USE_EMULATORS=true
   
   # For production testing
   EXPO_PUBLIC_USE_EMULATORS=false
   ```

## 🔧 Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| App won't start | `npx expo start --clear` |
| Metro bundler error | `pkill -f metro && npx expo start --clear` |
| iOS build issues | `cd ios && rm -rf Pods && pod install` |
| Firebase connection | Check `USE_EMULATORS` setting |
| Notifications not showing | Only show when not in active chat |
| Offline sync not working | Check network connection, try airplane mode |

### Debug Tools
```bash
# View logs
npx expo logs --type=device    # Device logs
npx expo logs --type=metro     # Metro bundler logs

# Clear everything
rm -rf node_modules .expo package-lock.json
npm install
npx expo start --clear

# Check Firebase connection
# Open Firebase Console > Project Overview > App Check
```

### Performance Issues
- **Slow scrolling**: Check for memory leaks in message list
- **High memory usage**: Clear message cache, restart app
- **Network timeouts**: Check Firebase quotas and limits

## 🚀 Deployment

### Quick Deploy
```bash
# 1. Build Android APK (ready for testing)
eas build --platform android --profile preview

# 2. Build iOS (requires Apple Developer account)
eas build --platform ios --profile preview

# 3. Deploy Firebase rules
firebase deploy --only firestore,database
```

See [DEPLOYMENT.md](../DEPLOYMENT.md) for complete deployment guide.

### Push Notifications
The app supports both foreground and background push notifications. See [PUSH_NOTIFICATIONS_SETUP.md](../PUSH_NOTIFICATIONS_SETUP.md) for complete setup guide.

## 📊 Architecture

### Frontend Stack
- **React Native 0.81** with Expo SDK 54
- **Firebase SDK 12.4** for backend services  
- **React Navigation 7** for navigation
- **Context API** for state management
- **Jest + Testing Library** for testing

### Backend Services
- **Firebase Authentication** - Email/password auth
- **Firestore** - Messages, chats, user profiles
- **Realtime Database** - Presence system
- **Firebase Storage** - Photo uploads
- **Expo Push** - Cross-platform notifications

### Performance
- **Sub-second message delivery** via Firestore real-time listeners
- **Offline-first** with IndexedDB persistence  
- **Optimistic UI** for instant user feedback
- **Efficient presence** using RTDB's `.onDisconnect()`
- **Bundle size** optimized with tree-shaking

### Security
- **Firestore Security Rules** restrict access to chat members only
- **Authentication required** for all operations
- **Input validation** on all user data
- **HTTPS enforced** for all connections

## 🤝 Contributing

### Development Workflow
1. **Fork the repository** 
2. **Create feature branch** (`git checkout -b feature/amazing-feature`)
3. **Make changes** and add tests
4. **Run quality checks** (`npm run lint && npm test`)
5. **Commit changes** (`git commit -m 'Add amazing feature'`)
6. **Push to branch** (`git push origin feature/amazing-feature`)
7. **Open Pull Request**

### Code Style
- **ESLint + Prettier** for consistent formatting
- **Conventional Commits** for clear history
- **Test coverage** required for new features
- **Documentation** for public APIs

### Reporting Issues
- **Use issue templates** for bugs and features
- **Include device/platform** information  
- **Provide reproduction steps**
- **Check existing issues** first

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Expo Team** - Amazing React Native platform
- **Firebase Team** - Robust backend infrastructure  
- **React Navigation** - Smooth navigation experience
- **Community** - Open source contributors and testers

---

## 🎯 What Makes MessageAI Special

✨ **Production-Ready** - Not just a demo, but a complete platform ready for real users

🚀 **Real-Time Everything** - Messages, presence, typing indicators all update instantly

🔒 **Secure by Design** - Proper authentication, authorization, and data protection

📱 **Native Performance** - 60fps scrolling, instant interactions, platform-specific UI

🌐 **Cross-Platform** - One codebase, works perfectly on iOS, Android, and web

🛠️ **Developer-Friendly** - Comprehensive docs, testing, CI/CD, and development tools

---

**Ready to scale from prototype to production** 🚀

