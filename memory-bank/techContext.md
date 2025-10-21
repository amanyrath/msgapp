# MessageAI — Technical Context

## Technology Stack

### Frontend
- **React Native**: 0.76.x (bundled with Expo)
- **Expo SDK**: ~52.0.x
- **React**: ^18.x.x

### Backend Services
- **Firebase Authentication**: Web SDK v11.x.x
- **Firebase Firestore**: Web SDK v11.x.x
- **Firebase Core**: v11.x.x

### Development Tools
- **Node.js**: v18+ required
- **npm**: Package manager
- **Expo Go**: For iOS device testing
- **iOS Simulator**: For development testing

## Development Setup

### Initial Setup
```bash
# Navigate to project
cd /Users/alexismanyrath/Documents/Gauntlet/msgapp/messageai

# Install dependencies (already done)
npm install

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
├── App.js                  # Root component
├── config/
│   └── firebase.js        # Firebase configuration
├── assets/                # Icons, images, splash screens
├── node_modules/          # Dependencies (git-ignored)
├── package.json           # Dependencies and scripts
├── package-lock.json      # Locked dependency versions
├── app.json              # Expo configuration
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
- **iOS First**: Primary development on iOS
- **Expo Limitations**: Must use Expo-compatible packages
- **No Native Modules**: Sticking to Expo Go for MVP (no custom native code)

### Firebase Constraints
- **Web SDK**: Using web SDK (not React Native Firebase) for simplicity
- **Offline Size Limit**: Firestore offline cache has size limits (40MB default)
- **Rate Limits**: Firebase has read/write rate limits (shouldn't hit in MVP)

### Performance Targets
- Message delivery: < 300ms when online
- App startup: < 2 seconds
- Offline sync: Automatic on reconnection
- UI responsiveness: 60 FPS scrolling

## Dependencies

### Core Dependencies (package.json)
```json
{
  "dependencies": {
    "expo": "~52.0.x",
    "expo-status-bar": "~2.0.x",
    "react": "^18.x.x",
    "react-native": "0.76.x",
    "firebase": "^11.x.x"
  }
}
```

### Upcoming Dependencies (PR #2+)
- `@react-navigation/native` - Navigation
- `@react-navigation/native-stack` - Stack navigation
- `react-native-screens` - Native navigation primitives
- `react-native-safe-area-context` - Safe area handling

## Environment Variables
**Not using environment variables for MVP** because:
- Expo requires special handling for env vars
- Firebase config isn't sensitive in client apps
- Direct config file is simpler for MVP

Future consideration: Use `expo-constants` + `app.config.js` for env vars

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

