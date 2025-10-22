# MessageAI — Technical Context

## Technology Stack

### Frontend
- **React Native**: 0.76.x (bundled with Expo)
- **Expo SDK**: ~52.0.x
- **React**: ^18.x.x

### Backend Services
- **Firebase Authentication**: Web SDK v12.x.x
- **Firebase Firestore**: Web SDK v12.x.x
- **Firebase Realtime Database**: Web SDK v12.x.x
- **Firebase Core**: v12.x.x

### AI Services
- **OpenAI API**: GPT-4o mini for translation, cultural analysis, and smart replies
- **OpenAI SDK**: ^6.6.0 for JavaScript integration

### Development Tools
- **Node.js**: v18+ required
- **npm**: Package manager
- **Expo Go**: For iOS device testing
- **iOS Simulator**: For development testing
- **EAS Build**: For production app builds
- **OpenAI API**: Account required for AI features
- **Firebase Emulators**: For local development

## Development Setup

### Initial Setup
```bash
# Navigate to project
cd /Users/alexismanyrath/Code/msgapp/messageai

# Install dependencies
npm install

# Set up environment variables (REQUIRED for AI features)
touch .env
echo "OPENAI_API_KEY=your_openai_api_key_here" >> .env
echo "USE_EMULATORS=true" >> .env

# Start development server
npm start
```

### Running the App
```bash
# Start Expo
npm start

# Open in iOS Simulator
# Press 'i' in terminal
# Or: npx expo start --ios

# Open in Android Simulator
# Press 'a' in terminal
# Or: npx expo start --android
```

### Testing Setup
For multi-user testing:
1. Open first iOS Simulator
2. Open second iOS Simulator
3. Run app in both
4. Test messaging between two accounts

## Project Structure
```
messageai/
├── App.js                  # Root component with AI navigation
├── .env                   # Environment variables (OpenAI API key)
├── config/
│   └── firebase.js        # Firebase configuration
├── components/
│   ├── AIAssistant.js     # AI Assistant modal interface
│   ├── AIMenuButton.js    # AI-first menu button
│   ├── PhotoPicker.js     # Photo sharing components
│   └── ...                # Other UI components
├── utils/
│   ├── aiService.js       # OpenAI integration & AI operations
│   ├── aiContext.js       # RAG pipeline with conversation context
│   ├── aiFirestore.js     # AI message storage and threading
│   ├── firestore.js       # Firestore operations
│   ├── presence.js        # Real-time presence system
│   └── notifications.js   # Push notification handling
├── context/
│   ├── AuthContext.js     # Authentication & user management
│   ├── NetworkContext.js  # Connection monitoring
│   ├── PresenceContext.js # Multi-user presence
│   └── NotificationContext.js # Notification management
├── screens/
│   ├── ChatScreen.js      # Chat with AI integration
│   ├── ChatListScreen.js  # Chat list with AI indicators
│   └── ...                # Other screens
├── assets/                # Icons, images, splash screens
├── node_modules/          # Dependencies (git-ignored)
├── package.json           # Dependencies and scripts
├── package-lock.json      # Locked dependency versions
├── app.json              # Expo configuration
├── eas.json              # EAS Build configuration
├── index.js              # Entry point
├── .gitignore            # Git ignore rules
└── README.md             # Documentation
```

## Firebase Configuration

### Required Firebase Services
1. **Authentication**
   - Enable Email/Password provider
   - No additional configuration needed

2. **Firestore Database**
   - Start in test mode (will add security rules later)
   - Default region: us-central1 (or user's preferred region)

3. **Web App Registration**
   - Register a web app in Firebase console
   - Copy config to `config/firebase.js`

### Firebase Config Format
```javascript
const firebaseConfig = {
  apiKey: "string",
  authDomain: "string",
  projectId: "string",
  storageBucket: "string",
  messagingSenderId: "string",
  appId: "string"
};
```

## Technical Constraints

### Platform Constraints
- **iOS First**: Primary development on iOS (Android supported)
- **Expo Limitations**: Must use Expo-compatible packages
- **No Native Modules**: Sticking to Expo Go for development (EAS Build for production)

### Firebase Constraints
- **Web SDK**: Using web SDK (not React Native Firebase) for simplicity
- **Offline Size Limit**: Firestore offline cache has size limits (40MB default)
- **Rate Limits**: Firebase has read/write rate limits (not an issue with current usage)

### AI Service Constraints
- **OpenAI Rate Limits**: 10,000 requests/day on free tier, 3 requests/minute initially
- **Response Time Target**: Sub-2 seconds for all AI operations
- **Context Window**: GPT-4o mini supports 128K tokens (sufficient for conversation context)
- **API Cost**: ~$0.0001-0.0006 per request depending on context size

### Performance Targets
- Message delivery: < 300ms when online
- AI response time: < 2 seconds (achieved)
- App startup: < 2 seconds
- Offline sync: Automatic on reconnection
- UI responsiveness: 60 FPS scrolling

## Dependencies

### Core Dependencies (package.json)
```json
{
  "dependencies": {
    "expo": "~54.0.14",
    "expo-status-bar": "~3.0.8",
    "react": "19.1.0",
    "react-native": "0.81.4",
    "firebase": "^12.4.0",
    "openai": "^6.6.0",
    "@react-native-community/netinfo": "^11.4.1",
    "@react-navigation/native": "^7.1.18",
    "@react-navigation/native-stack": "^7.3.28",
    "expo-notifications": "^0.32.12",
    "expo-constants": "^18.0.9",
    "expo-image-picker": "^17.0.8",
    "expo-image-manipulator": "^14.0.7",
    "react-native-safe-area-context": "^5.6.1",
    "react-native-screens": "~4.16.0",
    "dotenv": "^17.2.3"
  }
}
```

### AI & International Features Dependencies
- `openai` - OpenAI API integration for AI features
- `expo-constants` - Environment variable handling for API keys
- `expo-notifications` - Push notification support
- `expo-image-picker` - Future image sharing capabilities
- `expo-image-manipulator` - Image processing utilities
- `dotenv` - Environment configuration management

## Environment Variables
**Using .env file for AI configuration:**
```bash
# messageai/.env (required for AI features)
OPENAI_API_KEY=your_openai_api_key_here
USE_EMULATORS=false
```

**Setup Instructions:**
1. Create `.env` file in `messageai/` directory
2. Add OpenAI API key from https://platform.openai.com/api-keys
3. Set `USE_EMULATORS=true` for local development, `false` for production

**Security Note**: API keys are loaded at build time via `expo-constants` and `dotenv`

## Build and Deployment (Future)
For production builds:
```bash
# iOS build (requires Expo EAS)
eas build --platform ios

# Android build (requires Expo EAS)
eas build --platform android
```

## Known Technical Debt
1. **Hardcoded Firebase Config**: Should move to environment variables
2. **No TypeScript**: Plain JavaScript for speed; could migrate later
3. **No Testing**: No unit/integration tests; manual testing only
4. **Basic Error Handling**: Need comprehensive error boundaries

## Useful Commands
```bash
# Clear cache
npx expo start -c

# Update Expo
npx expo upgrade

# Check for dependency issues
npm audit

# View logs
npx react-native log-ios    # iOS logs
npx react-native log-android # Android logs
```

## Debugging
- **Console Logs**: Use `console.log()` (shows in terminal)
- **React DevTools**: Available in Expo Dev Tools
- **Network**: Use browser network tab in Expo DevTools
- **Firebase**: Monitor in Firebase Console

## Security Considerations
1. **API Keys**: Firebase API keys can be public (restricted by Firebase rules)
2. **Auth State**: Never store passwords locally
3. **Firestore Rules**: Will implement in PR #6 to restrict access
4. **HTTPS**: All Firebase communication is over HTTPS

## Browser/Platform Compatibility
- iOS 13+ (Expo requirement)
- Android 5.0+ (API 21+)
- Web support possible but not prioritized

