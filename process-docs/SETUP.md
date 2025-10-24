# MessageAI - Complete Setup Guide

This guide will help you set up and run the MessageAI React Native app locally from scratch.

## 📋 System Requirements

### Required Software
- **Node.js**: v18.0.0 or higher ([Download here](https://nodejs.org/))
- **npm**: v8.0.0 or higher (comes with Node.js)
- **Git**: For version control ([Download here](https://git-scm.com/))

### Platform-Specific Requirements

#### macOS (Recommended for iOS development)
```bash
# Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install CocoaPods (required for iOS)
brew install cocoapods

# Install Xcode (for iOS Simulator)
# Download from Mac App Store or Apple Developer Portal
```

#### Windows/Linux
```bash
# Android Studio is recommended for Android development
# Download from: https://developer.android.com/studio
```

### Mobile Development Tools
- **Xcode** (macOS only): For iOS Simulator
- **Android Studio**: For Android Emulator (optional)
- **Expo Go App**: Install on your physical device for testing

---

## 🚀 Quick Setup (5 minutes)

### 1. Clone and Install
```bash
# Clone the repository
git clone <your-repo-url>
cd msgapp

# Navigate to the React Native app
cd messageai

# Install all dependencies
npm install

# Install Expo CLI globally (if not already installed)
npm install -g @expo/cli

# For iOS (macOS only) - Install CocoaPods dependencies
cd ios && pod install && cd ..
```

### 2. Firebase Setup
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project (or use existing)
3. Enable **Authentication** → Sign-in methods → **Email/Password**
4. Create **Firestore Database** (start in test mode)
5. Add a **Web App** to your project
6. Copy the Firebase config and update `messageai/config/firebase.js`

### 3. Run the App
```bash
# Start the development server
npm start

# Choose your platform:
# - Press 'i' for iOS Simulator (macOS only)
# - Press 'a' for Android Emulator
# - Scan QR code with Expo Go app on your phone
```

**That's it!** The app should now be running with full authentication.

---

## 📱 Detailed Setup Instructions

### Step 1: System Prerequisites

#### Check Your Current Setup
```bash
# Check Node.js version (should be 18+)
node --version

# Check npm version (should be 8+)
npm --version

# Check if git is installed
git --version
```

#### Install Missing Requirements

**macOS:**
```bash
# Install Node.js (if needed)
brew install node

# Install CocoaPods (required for iOS)
brew install cocoapods

# Verify installations
node --version && npm --version && pod --version
```

**Windows:**
```bash
# Download Node.js from nodejs.org
# Install Git from git-scm.com
# Install Android Studio for Android development
```

### Step 2: Project Setup

#### Clone and Install Dependencies
```bash
# Clone the project
git clone <your-repo-url>
cd msgapp/messageai

# Install project dependencies
npm install

# Install Expo CLI globally (if not already installed)
npm install -g @expo/cli

# Verify Expo installation
expo --version
```

#### Install iOS Dependencies (macOS only)
```bash
# Navigate to iOS directory and install pods
cd ios
pod install
cd ..
```

### Step 3: Firebase Configuration

#### Create Firebase Project
1. Visit [Firebase Console](https://console.firebase.google.com)
2. Click "Create a project" or use existing project
3. Follow the setup wizard (Analytics optional for MVP)

#### Enable Required Services

**Authentication:**
1. Go to Authentication → Sign-in method
2. Enable **Email/Password** provider
3. Click "Save"

**Firestore Database:**
1. Go to Firestore Database
2. Click "Create database"
3. Choose "Start in test mode" (we'll add security rules later)
4. Select your preferred location (us-central1 recommended)

#### Configure Your App
1. In Firebase Console, click "Add app" → Web (</> icon)
2. Register app name: "MessageAI" or similar
3. Copy the Firebase configuration object
4. Update `messageai/config/firebase.js` with your config:

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

### Step 4: Run and Test

#### Start Development Server
```bash
# From messageai directory
npm start
```

This will open Expo Dev Tools in your browser with options:

#### Testing Options

**Option 1: iOS Simulator (macOS only)**
```bash
# Press 'i' in terminal, or:
npm run ios
```

**Option 2: Android Emulator**
```bash
# Press 'a' in terminal, or:
npm run android
```

**Option 3: Physical Device**
1. Install "Expo Go" from App Store/Google Play
2. Scan the QR code shown in terminal/browser
3. App will load on your device

### Step 5: Verify Everything Works

#### Authentication Test
1. App should show Login screen
2. Click "Don't have an account? Sign Up"
3. Enter test email and password
4. Should navigate to Chat screen
5. Sign out and log back in
6. Close app completely and reopen (should stay logged in)

If all tests pass, your setup is complete! 🎉

---

## 🛠 Development Scripts

```bash
# Start development server
npm start

# Start with cache cleared
npm start -- --clear

# Start on specific platform
npm run ios      # iOS Simulator (macOS only)
npm run android  # Android Emulator
npm run web      # Web browser

# Other useful commands
expo doctor      # Check for setup issues
expo upgrade     # Update Expo SDK
```

---

## 🔧 Troubleshooting

### Common Issues and Solutions

#### "Metro has encountered an error"
```bash
# Clear Metro cache
npx expo start --clear

# Or clear npm cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### "Firebase configuration error"
1. Double-check your Firebase config in `config/firebase.js`
2. Ensure Authentication and Firestore are enabled
3. Check browser console for specific Firebase errors

#### "CocoaPods error" (iOS)
```bash
# Update CocoaPods
brew upgrade cocoapods

# Clean and reinstall pods
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..
```

#### "Expo command not found"
```bash
# Install Expo CLI globally
npm install -g @expo/cli

# Or use npx instead
npx expo start
```

#### App won't load on device
1. Ensure device and computer are on same WiFi network
2. Check if firewall is blocking Expo
3. Try the tunnel connection: `expo start --tunnel`

#### "Network request failed" errors
1. Check your internet connection
2. Verify Firebase project is active
3. Ensure Firebase services are enabled
4. Check Firebase Console for any quota limits

### Getting Help

If you're still having issues:

1. **Check the logs**: Look at terminal output and browser console
2. **Expo documentation**: [docs.expo.dev](https://docs.expo.dev)
3. **Firebase documentation**: [firebase.google.com/docs](https://firebase.google.com/docs)
4. **GitHub Issues**: Create an issue in this repository

---

## 📁 Project Structure

```
msgapp/
├── messageai/                 # React Native App
│   ├── App.js                # Main app component
│   ├── config/
│   │   └── firebase.js       # Firebase configuration (UPDATE THIS)
│   ├── context/
│   │   └── AuthContext.js    # Authentication context
│   ├── screens/
│   │   ├── LoginScreen.js    # Login form
│   │   ├── SignupScreen.js   # Registration form
│   │   └── ChatScreen.js     # Main chat interface
│   ├── assets/               # Images, icons
│   ├── package.json          # Dependencies
│   └── TESTING.md           # Testing instructions
├── functions/                # Firebase Cloud Functions (future)
├── memory-bank/              # Project documentation
└── SETUP.md                 # This file
```

---

## 🎯 Next Steps

Once you have the app running:

1. **Test Authentication**: Follow the test checklist in `messageai/TESTING.md`
2. **Explore the Code**: Start with `App.js` and `context/AuthContext.js`
3. **Check Firebase Console**: See users and data in your Firebase project
4. **Ready for Development**: You're all set to build new features!

---

## 📚 Additional Resources

- **React Native**: [reactnative.dev](https://reactnative.dev)
- **Expo Documentation**: [docs.expo.dev](https://docs.expo.dev)
- **Firebase Docs**: [firebase.google.com/docs](https://firebase.google.com/docs)
- **React Navigation**: [reactnavigation.org](https://reactnavigation.org)

---

## 🔄 Version Information

- **React Native**: 0.81.4
- **Expo SDK**: ~54.0.14
- **Firebase**: ^12.4.0
- **Node.js**: 18+ required

---

**Happy coding!** 🚀

If you run into any issues, check the troubleshooting section above or create an issue in the repository.
