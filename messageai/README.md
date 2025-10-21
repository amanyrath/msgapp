# MessageAI — React Native Messaging App

A cross-platform real-time messaging app built with React Native (Expo) and Firebase. Currently at **PR #2** with full authentication system working!

## 🚀 Quick Start (5 minutes)

### System Requirements
- **Node.js** v18+ ([Download](https://nodejs.org/))
- **npm** v8+ (comes with Node.js)
- **macOS**: Install CocoaPods with `brew install cocoapods`
- **Expo Go app** on your phone (optional)

### Installation

```bash
# 1. Navigate to the app directory
cd messageai

# 2. Install dependencies
npm install

# 3. Install Expo CLI (if not already installed)
npm install -g @expo/cli

# 4. For iOS (macOS only)
brew install cocoapods
```

### Firebase Setup (2 minutes)
1. Go to [Firebase Console](https://console.firebase.google.com) → Create/Select project
2. **Enable Authentication** → Sign-in methods → **Email/Password** ✓
3. **Create Firestore Database** → Start in test mode ✓
4. Add **Web App** → Copy config → Update `config/firebase.js`

```javascript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

### Run the App
```bash
npm start

# Then choose:
# - Press 'i' for iOS Simulator (macOS)
# - Press 'a' for Android Emulator  
# - Scan QR code with Expo Go app
```

**🎉 That's it!** You should see the login screen and be able to create accounts.

## 📋 Current Status: PR #2 Complete

### ✅ What's Working
- ✅ Expo app created and running
- ✅ Firebase SDK installed and configured
- ✅ **Authentication system fully functional**
- ✅ **Login and Signup screens**
- ✅ **Session persistence with onAuthStateChanged**
- ✅ **Navigation between auth and chat screens**
- ✅ **AuthContext for state management**

### 🔜 Next Steps (PR #3)
- Design Firestore schema for messages
- Create message model and helper functions
- Test read/write operations to Firestore

## 🏗️ Project Structure
```
messageai/
├── App.js              # Main app with navigation and auth provider
├── config/
│   └── firebase.js     # Firebase configuration and initialization
├── context/
│   └── AuthContext.js  # Authentication state management
├── screens/
│   ├── LoginScreen.js  # Login interface
│   ├── SignupScreen.js # Signup interface
│   └── ChatScreen.js   # Main chat screen (placeholder)
├── assets/             # App icons and images
├── package.json        # Dependencies
└── README.md          # This file
```

## 📦 Dependencies
- **expo**: ~54.x.x
- **firebase**: ^12.x.x
- **@react-navigation/native**: Navigation library
- **@react-navigation/native-stack**: Stack navigation
- **react-native-screens**: Native navigation primitives
- **react-native-safe-area-context**: Safe area handling

## ✅ Quick Test (1 minute)

### Test Authentication Flow
1. **Launch**: `npm start` → press `i` for iOS Simulator
2. **Sign Up**: Click "Sign Up" → Enter `test@example.com` / `password123`
3. **Success**: Should auto-login to Chat Screen showing your email
4. **Sign Out**: Click "Sign Out" → should return to Login
5. **Persistence**: Close app completely → reopen → should auto-login

**All working?** 🎉 Your setup is perfect!

## 🔧 Troubleshooting

### App Won't Start
```bash
# Clear cache and reinstall
npx expo start --clear
# Or if that doesn't work:
rm -rf node_modules package-lock.json && npm install
```

### Firebase Errors
- ❌ **"No Firebase App"**: Update your config in `config/firebase.js`
- ❌ **Auth errors**: Enable Email/Password in Firebase Console → Authentication
- ❌ **"Permission denied"**: Create Firestore database in test mode

### iOS/CocoaPods Issues (macOS)
```bash
# Update CocoaPods
brew upgrade cocoapods

# Clean and reinstall (if needed)
cd ios && rm -rf Pods && pod install && cd ..
```

### Still Having Issues?
1. Check the **detailed setup guide**: [`../SETUP.md`](../SETUP.md)
2. Follow the complete test checklist: [`TESTING.md`](TESTING.md)
3. Check [Expo documentation](https://docs.expo.dev) or [Firebase docs](https://firebase.google.com/docs)

## 📚 Documentation
- [PRD Document](../MessageAI_PRD_ReactNative.md)
- [Implementation Plan](../MessageAI_Implementation_ReactNative.md)

## 🎯 MVP Success Criteria
1. ✅ **PR #1**: Project setup and Firebase initialization
2. ✅ **PR #2**: Authentication flow
3. ⏳ **PR #3**: Firestore schema and message model
4. ⏳ **PR #4**: Real-time chat UI
5. ⏳ **PR #5**: Group chat support
6. ⏳ **PR #6**: Offline support
7. ⏳ **PR #7**: UI polish and QA

---

**Built with ❤️ using Expo and Firebase**

