# MessageAI — Real-Time Messaging App

A complete real-time messaging platform built with React Native (Expo) and Firebase. Ready for testing with full feature set!

## 🚀 Quick Start for Testing (3 minutes)

### System Requirements
- **Node.js** v18+ ([Download](https://nodejs.org/))
- **npm** v8+ (comes with Node.js)
- **macOS**: Install CocoaPods with `brew install cocoapods`
- **iOS Simulator** or **Expo Go app** on your phone

### Installation & Run

```bash
# 1. Navigate to the app directory
cd messageai

# 2. Install dependencies
npm install

# 3. Install Expo CLI (if not already installed)
npm install -g @expo/cli

# 4. For iOS (macOS only)
brew install cocoapods

# 5. Run the app
npx expo run:ios
# OR scan QR code with Expo Go: npm start
```

**🎉 Ready to test!** The app connects to a pre-configured Firebase backend.

## 🎯 Full Feature Set - Ready for Testing!

### ✅ Authentication & User Management
- ✅ **Email/password signup and login**
- ✅ **User profiles with nicknames and emoji icons**
- ✅ **Session persistence across app restarts**
- ✅ **Profile editing and customization**

### 💬 Messaging Features
- ✅ **Real-time 1-on-1 messaging**
- ✅ **Group chats with multiple users**
- ✅ **Message read receipts (✓ and ✓✓)**
- ✅ **Typing indicators**
- ✅ **Message persistence and offline sync**
- ✅ **Optimistic UI (messages appear instantly)**

### 👥 Social Features
- ✅ **Online/offline presence indicators**
- ✅ **"Active now" / "Active 5m ago" status**
- ✅ **Chat list with unread badges**
- ✅ **Custom chat names and icons for groups**
- ✅ **Long press to delete chats**

### 📱 Technical Features
- ✅ **Push notifications (foreground)**
- ✅ **Network status monitoring**
- ✅ **Error handling and retry logic**
- ✅ **Clean, modern UI design**

## 🧪 How to Test the App

### 1. Create Test Accounts
- **Sign up** with any email (e.g., `tester1@example.com`, `tester2@example.com`)
- Choose a **nickname** and **emoji icon**
- **Passwords** can be simple (min 6 characters)

### 2. Test Real-Time Messaging
- Create multiple test accounts (or ask a friend to test)
- **Start chats** from the main screen (+ button)
- **Send messages** and see them appear instantly
- **Test typing indicators** - start typing to see "User is typing..."

### 3. Test Group Features
- **Create group chats** by selecting multiple users
- **Customize group names** and icons (⚙️ button in chat)
- **Test presence** - see who's "Active now" in the header

### 4. Test Advanced Features
- **Read receipts** - single ✓ when sent, double ✓✓ when read
- **Push notifications** - receive notifications when not in chat
- **Chat deletion** - long press any chat to delete
- **Profile editing** - tap ⚙️ in chat list to edit your profile

### 5. Test Offline/Network
- **Turn off WiFi** - see orange "offline" banner
- **Send messages offline** - they'll queue and send when reconnected
- **Close app** completely - reopen and you'll stay logged in

## ✅ Quick Verification Test

### 30-Second Test
1. **Launch**: `npx expo run:ios` (or `npm start` + scan QR code)
2. **Sign Up**: Create account with any email/password + nickname + emoji
3. **Send Message**: Tap + to start a chat, send a test message
4. **Success**: Message appears with ✓ (sent) then ✓✓ (read)

**Working?** 🎉 You're ready to fully test all features!

## 🔧 Troubleshooting

### App Won't Start
```bash
# Clear cache and reinstall
npx expo start --clear
# Or completely clean:
rm -rf node_modules package-lock.json && npm install
```

### iOS Simulator Issues (macOS)
```bash
# Update CocoaPods
brew upgrade cocoapods

# Clean iOS build
cd ios && rm -rf Pods && pod install && cd ..
```

### "Metro has encountered an error"
```bash
# Kill Metro process and restart
pkill -f metro
npx expo start --clear
```

### Push Notifications Not Showing
- Notifications only show when **not** in the active chat
- Try sending from one account while viewing a different chat
- Check simulator allows notifications

### Common Solutions
- **Restart iOS Simulator** if app seems frozen
- **Check terminal for errors** - most issues show clear error messages
- **Try web version** as backup: `npm run web`

## 🎯 What Makes This Special

This isn't just another messaging app - it's a **production-ready platform** with:

- 🚀 **Instant messaging** - Messages appear in real-time across devices
- 👥 **Smart presence** - See who's online with accurate "Active now" status  
- 📱 **Native feel** - Built with React Native for smooth, native performance
- 🔒 **Secure & reliable** - Firebase backend with offline sync and error recovery
- 🎨 **Polished UX** - Clean design with thoughtful interactions
- ⚡ **Optimistic UI** - Messages appear instantly, even before server confirmation

## 🏗️ Technical Architecture

**Frontend**: React Native (Expo SDK 54) with navigation, context providers, and real-time subscriptions  
**Backend**: Firebase Authentication, Firestore, and Realtime Database  
**Features**: Push notifications, offline sync, typing indicators, read receipts  

## 📱 Compatible Platforms

- ✅ **iOS** (primary) - Full native build support
- ✅ **Android** - Cross-platform React Native
- ✅ **Web** - Expo web support for testing

---

**A complete messaging platform ready for production deployment** 🚀

