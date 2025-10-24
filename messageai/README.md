# MessageAI — AI-Powered International Communicator

A production-ready messaging platform with advanced AI features for international communication. Built with React Native, Firebase, and OpenAI GPT-4o mini.

## 🚀 Quick Start (2 minutes)

### Requirements
- **Node.js** v18+ ([Download](https://nodejs.org/))
- **OpenAI API Key** ([Get here](https://platform.openai.com/api-keys))

### Installation & Setup

```bash
# Install dependencies
npm install

# Setup environment (REQUIRED for AI features)
echo "OPENAI_API_KEY=your_openai_api_key_here" > .env

# Start development server
npm start
# Then: press 'i' for iOS simulator or scan QR with Expo Go
```

### First Time Setup

1. **Create account** - Use any email (e.g., `test@example.com`)
2. **Choose nickname** - Your display name in chats
3. **Pick emoji avatar** - Represents you across the app
4. **Set language preference** - For AI translation and UI
5. **Start messaging** - Tap + to create chats

**🎉 Ready to test AI features!** The app connects to production Firebase automatically.

## 🤖 AI International Communicator Features

### Real-Time Translation (GPT-4o mini)
- **Instant message translation** into any language
- **Automatic language detection** with confidence scoring
- **Bulk translation** of conversation history (1 hour/24 hours)
- **Sub-2 second response times** with optimized performance
- **Cultural context preservation** in translations

### Cultural Intelligence & Communication
- **Cultural context explanations** for slang, idioms, and local references
- **Smart reply suggestions** that are culturally appropriate
- **Formality adjustment** (casual ↔ formal) for business/personal contexts
- **Communication tips** for cross-cultural conversations
- **Context-aware analysis** using chat history (last 50 messages)

### AI Assistant Interface
- **Natural language commands** - "Translate messages from last hour"
- **Quick action buttons** - One-tap translation, explanations, suggestions
- **Threaded AI responses** - AI messages appear below originals
- **Real-time progress tracking** - See AI processing status

### Language System
- **20+ language support** with real-time UI translation
- **User language preferences** that persist across sessions
- **System language detection** for automatic setup
- **Translation caching** for improved performance

## 💬 Core Messaging Features

- **Real-time messaging** with instant delivery across devices
- **Group chats** with unlimited participants and smart notifications
- **WhatsApp-style read receipts** (✓ sent, ✓✓ read by all)
- **Live presence indicators** ("Active now", green dots)
- **Push notifications** with smart filtering (no self-notifications)
- **Offline message sync** - queues messages and syncs automatically
- **User profiles** with nicknames and emoji avatars
- **Message history** persists across devices and app restarts

## 🧪 Testing Guide

### Quick AI Feature Test (30 seconds)
1. **Create account** with any email + nickname + emoji + language preference
2. **Send message** in Spanish: "¡Hola! ¿Cómo está la fiesta en Zurich?"
3. **Tap 🤖 button** → Select "Translate 1h" → See instant English translation
4. **Try cultural context** → "Explain" → Get cultural context about Zurich parties
5. **Test formality** → "Make messages more formal" → See business-appropriate version

### Multi-User AI Testing
```bash
# Create test accounts with different languages:
# alice@test.com (Alice 👩) - Language: Spanish
# bob@test.com (Bob 👨) - Language: English  
# charlie@test.com (Charlie 🧑) - Language: French
# Password: test123
```

### AI Feature Scenarios
- **Cross-language chat**: Spanish user chats with English user, use AI translation
- **Cultural context**: Use slang or idioms, ask AI to explain cultural meaning
- **Business communication**: Make casual messages formal for professional contexts
- **Smart replies**: Ask AI for culturally appropriate response suggestions
- **Bulk translation**: Translate entire conversation histories

### Core Messaging Test
- **Real-time sync**: Messages appear instantly across devices
- **Group chats**: Create 3+ person chats, test AI features in groups
- **Offline sync**: Disconnect WiFi, send messages, reconnect and sync
- **Presence**: Check "Active now" and green dot indicators
- **Notifications**: Send messages between different chats

## ✅ Quick Verification

1. **Launch**: `npm start` → press 'i' for iOS simulator
2. **Create account**: Any email/password + nickname + emoji + language
3. **Test AI**: Send "Hello" → Tap 🤖 → "Translate 1h" → See translation
4. **Success**: AI translation appears below original message

**Working?** 🎉 All AI and messaging features are ready!

## 🏗️ Development

### Key Files
```
messageai/
├── utils/aiService.js         # OpenAI GPT-4o mini integration
├── components/AIAssistant.js  # AI Assistant modal
├── context/LocalizationContext.js # Language system
├── screens/ChatScreen.js      # Main chat with AI features
├── config/firebase.js         # Firebase configuration
└── .env                       # OpenAI API key (required)
```

### Development Commands
```bash
# Development
npm start                      # Start Expo dev server
npm run ios                   # Run on iOS simulator  
npm test                      # Run tests

# Building for production
eas build --platform android --profile preview
```

### Environment Configuration
```bash
# Required for AI features
OPENAI_API_KEY=your_openai_api_key_here

# Optional - defaults to production Firebase
USE_EMULATORS=false
```

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| App won't start | `npx expo start --clear` |
| AI features not working | Check OpenAI API key in `.env` file |
| "OpenAI API key missing" | Create `.env` file with `OPENAI_API_KEY=your_key` |
| Translation not working | Verify API key has credits and is valid |
| Metro bundler error | `pkill -f metro && npx expo start --clear` |
| Language preferences reset | Fixed in latest version - update from git |

### Quick Reset
```bash
# Nuclear option - clears everything
rm -rf node_modules .expo package-lock.json
npm install
npx expo start --clear
```

## 🚀 Production Ready

### Build for Distribution
```bash
# Android APK for testing
eas build --platform android --profile preview

# iOS build (requires Apple Developer account)  
eas build --platform ios --profile preview
```

## 🎯 Architecture

### Tech Stack
- **React Native (Expo)** - Cross-platform mobile framework
- **Firebase** - Authentication, Firestore, Realtime Database
- **OpenAI GPT-4o mini** - AI translation and cultural intelligence
- **React Navigation** - Navigation system

### AI Performance
- **Sub-2 second** AI response times
- **Context-aware** translations using chat history
- **Cultural intelligence** with real-world applicability
- **Optimized caching** for improved performance

### Security & Reliability
- **Firebase Authentication** with secure session management
- **Firestore Security Rules** restrict access to chat members
- **Offline-first design** with automatic sync
- **Error boundaries** and comprehensive retry logic

---

## 🌟 What Makes This Special

**🤖 AI-First International Communication** - Built specifically for users who need intelligent translation and cultural context in real conversations.

**⚡ Production Performance** - Sub-2 second AI responses, 60fps scrolling, enterprise-grade backend reliability.

**🌍 Global-Ready** - 20+ languages, cultural awareness, real-time UI translation, and international user focus.

**📱 Native Experience** - React Native with optimistic updates, offline sync, and native platform integration.

---

**Ready for international users who need AI-powered communication!** 🚀

