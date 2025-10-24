# MessageAI — System Patterns

## Architecture Overview
MessageAI is a full-featured **International Communicator** with AI-powered capabilities, built on a client-first architecture with Firebase backend services and OpenAI integration for advanced AI features.

```
┌─────────────────────────────────────────────┐
│    React Native (Expo) International        │
│         Communicator App                    │
├─────────────────────────────────────────────┤
│  • Screens (ChatList, Chat, NewChat, Auth)  │
│  • AI Components (AIAssistant, AIMenuButton)│
│  • Context Providers (Auth, Network,        │
│    Presence, Notification, Localization,    │
│    Error Boundary)                          │
│  • Utils (Firestore, Presence, AI Services) │
│  • Firebase SDK (Auth, Firestore, RTDB)     │
│  • OpenAI SDK (GPT-4o mini integration)     │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│            Backend Services                 │
├─────────────────────────────────────────────┤
│  • Firebase Authentication                  │
│  • Firestore (Messages, Chats, Users,       │
│    AI Messages with threading)              │
│  • Realtime Database (Presence System)      │
│  • Offline Persistence (IndexedDB)          │
│  • OpenAI API (GPT-4o mini)                │
│    - Real-time Translation                  │
│    - Cultural Context Analysis              │
│    - Smart Replies & Formality Adjustment   │
│    - RAG Pipeline with Chat History         │
└─────────────────────────────────────────────┘
```

## Component Structure

```
App.js (Root)
├── ErrorBoundary (Global error handling)
│   └── NetworkProvider (Connection monitoring)
│       └── LocalizationProvider (Language & UI translation)
│           └── AuthProvider (Auth + presence tracking)
│               └── Navigation Stack
│               ├── Auth Flow (unauthenticated)
│               │   ├── LoginScreen
│               │   └── SignupScreen
│               └── Main Flow (authenticated)
│                   ├── ChatListScreen
│                   │   ├── Avatar + online indicator
│                   │   ├── Chat preview
│                   │   └── Unread badge
│                   ├── NewChatScreen
│                   │   └── Multi-user selection
│                   └── ChatScreen
│                       ├── Header (presence text)
│                       ├── MessageList (FlatList)
│                       │   ├── Message bubbles
│                       │   ├── AI threaded messages
│                       │   ├── Read indicators
│                       │   └── Timestamps
│                       └── MessageInput
│                           ├── Text input
│                           └── AIMenuButton (🤖)
│                               └── AIAssistant Modal
│                                   ├── Quick actions
│                                   ├── Natural language chat
│                                   ├── Translation interface
│                                   └── Cultural context display
```

## Key Technical Decisions

### 1. Frontend Framework
**Choice**: React Native with Expo  
**Rationale**:
- Cross-platform (iOS + Android from one codebase)
- Expo simplifies development and testing
- Hot reload for fast iteration
- Can build standalone apps via EAS
- No Xcode/Android Studio needed for development

### 2. Backend Services
**Choice**: Firebase (BaaS)  
**Rationale**:
- Real-time sync out of the box
- Built-in authentication
- Offline persistence support
- No backend code to write/maintain
- Excellent React Native SDK
- RTDB perfect for presence

### 3. State Management
**Choice**: React Context API  
**Rationale**:
- Built-in to React, no extra dependencies
- Sufficient for app scope
- AuthContext, NetworkContext, PresenceContext
- Clean separation of concerns

### 4. Navigation
**Choice**: React Navigation (native-stack)  
**Rationale**:
- Industry standard for React Native
- Excellent performance
- Stack navigation for chat flow
- Dynamic initial route based on auth state

### 5. AI Integration Architecture  
**Choice**: OpenAI GPT-4o mini with RAG Pipeline  
**Rationale**:
- Cost-effective model with excellent performance for international communication
- 128K token context window supports extensive conversation history
- Sub-2 second response times for real-time user experience
- JSON mode for structured responses (translation + cultural context)
- Modular service architecture for easy feature expansion

### 6. Presence System
**Choice**: Firebase Realtime Database (RTDB)  
**Rationale**:
- `.onDisconnect()` is purpose-built for presence
- More reliable than Firestore for this use case
- Automatic offline detection
- Low latency for status updates

### 7. Offline Support
**Choice**: Firestore offline persistence + NetworkContext  
**Rationale**:
- IndexedDB cache for instant message loading
- Works automatically when enabled
- Manual monitoring with NetInfo for UI feedback
- Disable with emulators (conflicts)

## Design Patterns in Use

### 1. Context Provider Pattern
**Where**: AuthContext, NetworkContext, PresenceContext, LocalizationContext  
**Purpose**: Global state management without prop drilling  
**Benefits**: Clean, predictable, easy to test

```javascript
// Provides: user, loading, signUp, signIn, signOut
const { user } = useAuth();

// Provides: isOffline
const { isOffline } = useNetwork();

// Provides: presenceData
const { presenceData } = usePresence([userId1, userId2]);

// Provides: t, strings, translateText, setUserLanguagePreference
const { t, strings, isLoading } = useLocalization();
```

### 2. Real-time Listener Pattern
**Where**: Firestore subscriptions, RTDB presence  
**Purpose**: Automatic UI updates on data changes  
**Implementation**:
```javascript
useEffect(() => {
  const unsubscribe = subscribeToMessages(chatId, setMessages);
  return () => unsubscribe(); // Cleanup!
}, [chatId]);
```

### 3. Optimistic UI Updates
**Where**: Message sending  
**Purpose**: Instant feedback before server confirmation  
**Implementation**:
```javascript
// 1. Add message to UI immediately (with tempId)
setMessages([...messages, optimisticMessage]);

// 2. Send to Firestore
await sendMessage(...);

// 3. Real-time listener replaces temp with real message
```

### 4. Retry Logic with Exponential Backoff
**Where**: Firestore operations  
**Purpose**: Handle transient network failures  
**Implementation**:
```javascript
async function retryOperation(operation, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
}
```

### 5. Firebase Modular SDK Pattern
**Where**: All Firebase imports  
**Purpose**: Tree-shaking for smaller bundle size  
**Implementation**:
```javascript
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { getDatabase, ref, set, onDisconnect } from 'firebase/database';
```

### 6. Error Boundary Pattern
**Where**: App.js wrapper  
**Purpose**: Catch React errors and prevent crashes  
**Implementation**:
```javascript
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    // Log and display error
  }
  render() {
    if (this.state.hasError) return <ErrorUI />;
    return this.props.children;
  }
}
```

### 7. Presence with Auto-Disconnect
**Where**: RTDB presence system  
**Purpose**: Automatic offline detection  
**Implementation**:
```javascript
// Set user online
await set(statusRef, { state: 'online', ... });

// Auto-set offline on disconnect
await onDisconnect(statusRef).set({ state: 'offline', ... });
```

### 8. AI Message Threading Pattern
**Where**: AI Assistant responses  
**Purpose**: Link AI responses to original messages without cluttering conversation  
**Implementation**:
```javascript
// AI messages stored as threaded responses
const aiMessage = {
  type: 'ai_response',
  parentMessageId: originalMessageId,
  aiType: 'translation', // or 'cultural_context', 'smart_reply'
  content: aiResponse,
  confidence: 0.95,
  culturalNotes: [...],
  timestamp: serverTimestamp()
};
```

### 9. RAG Pipeline Pattern
**Where**: AI context building  
**Purpose**: Provide conversation context to AI for better responses  
**Implementation**:
```javascript
// Build context from recent messages
const context = buildAIContext({
  messages: messages.slice(-50), // Last 50 messages
  userProfile: currentUser,
  chatMetadata: { type: 'group', members: 5 },
  preferences: { formality: 'casual', nativeLanguage: 'English' }
});
```

### 10. Array Union for Read Receipts
**Where**: Message read tracking  
**Purpose**: Prevent duplicate entries  
**Implementation**:
```javascript
await updateDoc(messageRef, {
  readBy: arrayUnion(userId)
});
```

### 11. Language Localization Pattern
**Where**: LocalizationContext, UI string translation  
**Purpose**: Dynamic UI translation with caching  
**Implementation**:
```javascript
// Translation with caching
const { t, translateText } = useLocalization();

// Predefined UI strings
const welcomeText = t('welcome');

// Dynamic text translation
const translatedMessage = await translateText('Hello world');

// Parameterized strings
const greeting = t('hello', { name: 'John' });
```

### 12. User Language Preference Pattern
**Where**: User profiles, language persistence  
**Purpose**: Store and restore user language choices  
**Implementation**:
```javascript
// Save language preference
await setUserLanguagePreference(userId, 'Spanish');

// Initialize user language on login
await initializeUserLanguage(userId);

// Language persists across sessions
```

## Data Flow Patterns

### AI Translation Flow
```
User Request (Translate last hour)
    ↓
AIAssistant component handles request
    ↓
buildAIContext() gathers conversation history
    ↓
Filter messages from last hour
    ↓
For each message:
  ↓
  translateText() API call to OpenAI
  ↓
  Response with translation + cultural context
  ↓
  sendAIMessage() stores threaded response
  ↓
  Real-time listener updates UI
    ↓
AI messages appear threaded below originals
    ↓
User sees translations with cultural notes
```

### Cultural Context Analysis Flow
```
User opens AI Assistant
    ↓
Component analyzes recent messages
    ↓
buildAIContext() creates cultural profile
    ↓
analyzeConversationCulture() API call
    ↓
GPT-4o analyzes slang, idioms, cultural patterns
    ↓
Response includes:
  - Detected cultural elements
  - Explanations and context
  - Communication improvement tips
    ↓
Display in AI Assistant with highlights
```

### Smart Reply Generation Flow  
```
User requests smart replies
    ↓
buildAIContext() analyzes conversation
    ↓
generateSmartReplies() API call with:
  - Recent messages (context)
  - Conversation style (casual/formal)
  - Cultural considerations
  - User preferences
    ↓
GPT-4o generates culturally appropriate responses
    ↓
Returns multiple options with explanations
    ↓
User can select or customize suggestions
    ↓
Selected reply inserted into message input
```

### Authentication Flow
```
User Action (Login/Signup)
    ↓
AuthContext (signIn/signUp)
    ↓
Firebase Auth (signInWithEmailAndPassword)
    ↓
onAuthStateChanged listener
    ↓
AuthContext updates state
    ↓
Navigation changes (Login → ChatList)
    ↓
setUserOnline() called (RTDB)
```

### Message Send Flow
```
User types message
    ↓
Press Send button
    ↓
1. Optimistic UI Update (temp ID, ○ indicator)
    ↓
2. sendMessage() called
    ↓
3. Retry logic (if network fails)
    ↓
4. Firestore write (with readBy: [senderId])
    ↓
5. Real-time listener receives update
    ↓
6. Replace temp message with real one (✓ indicator)
    ↓
7. Recipients' listeners fire
    ↓
8. Messages appear in recipients' chats
```

### Presence Update Flow
```
User logs in
    ↓
setUserOnline() called
    ↓
RTDB: /status/{userId} = { state: 'online', ... }
    ↓
onDisconnect() set to mark offline
    ↓
Other users subscribe to presence
    ↓
subscribeToMultiplePresence([userIds])
    ↓
Real-time updates flow to all subscribers
    ↓
UI updates (green dots, "Active now")
```

### Read Receipt Flow
```
User opens chat
    ↓
subscribeToMessages() loads messages
    ↓
Filter unread messages (where !readBy.includes(userId))
    ↓
Call markMessagesAsRead(chatId, messageIds, userId)
    ↓
Batch update: readBy = arrayUnion(userId)
    ↓
Firestore triggers update
    ↓
Sender's listener fires
    ↓
Check if all recipients have read
    ↓
Update indicator: ✓ → ✓✓
```

### Language Preference Persistence Flow (CURRENT ISSUE)
```
User selects language preference in ProfileScreen
    ↓
setUserLanguagePreference(userId, language) called  
    ↓
Language saved to user profile in Firestore
    ↓
LocalizationContext state updated
    ↓
UI translations loaded for new language
    ↓
User logs out
    ↓
User logs in (ISSUE: language not restored)
    ↓
AuthContext initializes but doesn't trigger language loading
    ↓
App defaults to system language (not user preference)
    ↓
❌ User must reconfigure language choice
```

### Offline Sync Flow
```
User goes offline
    ↓
NetworkContext detects (NetInfo)
    ↓
UI shows offline banner
    ↓
User sends message
    ↓
Firestore queues write (offline persistence)
    ↓
User goes online
    ↓
NetworkContext updates
    ↓
Firestore auto-syncs queued operations
    ↓
Real-time listeners fire
    ↓
UI updates across all devices
```

## Firestore Schema

### Collections

#### `/users/{userId}`
```javascript
{
  uid: string,           // User ID
  email: string,         // Email address
  displayName: string,   // Display name (set to nickname)
  nickname: string,      // User's chosen nickname
  icon: string,          // User's emoji avatar
  createdAt: timestamp,  // Account creation time
  updatedAt: timestamp,  // Last profile update
  
  // Language Preference (NEW!)
  languagePreference: string,  // User's preferred UI language (e.g., 'Spanish', 'French')
  
  // AI Preferences (future enhancement)
  preferences: {
    nativeLanguage: string,      // User's native language
    formality: string,           // Preferred communication style
    culturalContext: string      // Cultural background info
  }
}
```

#### `/chats/{chatId}`
```javascript
{
  members: [userId1, userId2, ...],  // Sorted array of member IDs
  createdAt: timestamp,              // Chat creation time
  createdBy: userId,                 // Creator ID
  lastMessage: string,               // Last message preview
  lastMessageTime: timestamp,        // For sorting
  type: 'direct' | 'group'           // Chat type
}
```

#### `/chats/{chatId}/messages/{messageId}`
```javascript
{
  senderId: string,      // User who sent message
  senderEmail: string,   // Sender's email
  senderName: string,    // Sender's nickname (persisted for history)
  text: string,          // Message content
  timestamp: timestamp,  // Server timestamp
  readBy: [userId, ...]  // Array of users who read it
  
  // AI Enhancement fields
  type: 'user' | 'ai_response',     // Message type
  parentMessageId: string,          // For AI threaded responses
  aiType: 'translation' | 'cultural_context' | 'smart_reply' | 'formality_adjustment',
  aiData: {
    confidence: number,             // AI confidence score (0-1)
    culturalNotes: [string],        // Cultural context explanations
    originalLanguage: string,       // Detected source language
    targetLanguage: string,         // Translation target
    formalityAdjustment: string,    // Explanation of tone changes
    suggestedReplies: [string]      // Smart reply options
  }
}
```

### RTDB Schema

#### `/status/{userId}`
```javascript
{
  state: 'online' | 'offline',  // Current status
  lastChanged: timestamp,        // Last status change
  email: string,                 // User email
  displayName: string,           // Display name (nickname)
  nickname: string,              // User's nickname (NEW)
  icon: string                   // User's emoji avatar (NEW)
}
```

### Indexes Required
- **chats**: `members` (array-contains) + `lastMessageTime` (descending)

## Error Handling Strategy

### 1. Network Errors
- **Detection**: NetworkContext monitors with NetInfo
- **UI**: Orange "Offline" banner
- **Behavior**: Queue operations, auto-sync on reconnection
- **User Impact**: Minimal - offline persistence handles it

### 2. Auth Errors
- **Detection**: Try/catch around auth operations
- **UI**: Alert.alert with user-friendly message
- **Logging**: Console.error for debugging
- **User Impact**: Clear error messages

### 3. Firestore Errors
- **Detection**: Try/catch with retry logic
- **UI**: Alert for user, rollback optimistic updates
- **Retry**: 3 attempts with exponential backoff
- **User Impact**: Transparent retry, only notify on failure

### 4. RTDB Errors
- **Detection**: Try/catch with defensive checks
- **Behavior**: Graceful degradation (presence unavailable)
- **Logging**: Console warnings
- **User Impact**: App works, just no presence

### 5. React Errors
- **Detection**: ErrorBoundary component
- **UI**: Error screen with "Try Again" button
- **Logging**: componentDidCatch logs to console
- **User Impact**: App doesn't crash, can recover

### 6. Validation Errors
- **Detection**: Client-side validation
- **UI**: Inline error messages, disabled buttons
- **Prevention**: Don't allow invalid submissions
- **User Impact**: Clear feedback before submission

## Performance Optimizations

### 1. Bundle Size
- Modular Firebase imports (tree-shaking)
- No heavy dependencies
- Expo optimizes automatically

### 2. Rendering Performance
- FlatList for message lists (virtualization)
- React.memo for message components (future)
- Proper key props (messageId)
- Avoid inline functions in renders (future)

### 3. Offline-First
- Firestore offline persistence (IndexedDB)
- Messages load instantly from cache
- Sync in background
- Optimistic UI for writes

### 4. Memory Management
- Proper cleanup of listeners (useEffect return)
- Unsubscribe on unmount
- No memory leaks detected

### 5. Network Efficiency
- Real-time listeners only for active screens
- Batch operations where possible (markMessagesAsRead)
- arrayUnion prevents duplicate reads
- Server timestamps (no clock skew)

### 6. RTDB Efficiency
- Single write on login (presence)
- onDisconnect handles rest
- Subscribe only to needed users
- Lightweight data structure

## Security Considerations

### Firestore Rules (Current)
```javascript
// Allow read/write if authenticated
match /chats/{chatId} {
  allow read, write: if request.auth != null;
}
match /users/{userId} {
  allow read: if request.auth != null;
  allow write: if request.auth.uid == userId;
}
```

### RTDB Rules (Current)
```javascript
{
  "rules": {
    "status": {
      "$uid": {
        ".read": true,
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```

### Future Improvements
- Validate user is member of chat before read/write
- Prevent message editing/deletion by others
- Rate limiting via Cloud Functions
- Content moderation
- Spam detection

## Configuration Management

### Emulator vs Production
```javascript
// config/firebase.js
const USE_EMULATORS = false; // Toggle for dev/prod

if (USE_EMULATORS) {
  connectAuthEmulator(auth, 'http://localhost:9099');
  connectFirestoreEmulator(firestore, 'localhost', 8080);
  connectDatabaseEmulator(rtdb, 'localhost', 9000);
} else {
  enableIndexedDbPersistence(firestore);
}
```

### Emulator Ports
- Auth: 9099
- Firestore: 8080
- RTDB: 9000
- Hosting: 5003
- Functions: 5001
- Emulator UI: 4000

## Build & Deployment

### EAS Build Profiles
```json
{
  "build": {
    "development": {
      "developmentClient": true
    },
    "preview": {
      "distribution": "internal",  // Shareable APK
      "android": { "buildType": "apk" }
    },
    "production": {
      "distribution": "store"  // App Store / Play Store
    }
  }
}
```

### Build Commands
```bash
# Android APK (shareable link)
eas build --platform android --profile preview

# iOS (requires Apple Developer account)
eas build --platform ios --profile preview

# Both platforms
eas build --platform all --profile preview
```

## Testing Strategy

### Manual Testing
- iOS Simulator for primary testing
- Multiple simulators for multi-user scenarios
- Real device testing after EAS build
- Test both emulator and production Firebase

### Test Scenarios
1. **Authentication**: Signup, login, logout, session persistence
2. **Messaging**: Send, receive, real-time sync, optimistic UI
3. **Group Chat**: Create, send, multiple recipients
4. **Offline**: Go offline, send messages, reconnect, verify sync
5. **Presence**: Online/offline indicators, "Active now" text
6. **Read Receipts**: Send message, recipient reads, verify ✓✓
7. **Error Cases**: Network failures, auth errors, invalid data

### No Automated Testing
- Out of scope for MVP
- Could add Jest + React Native Testing Library later
- Manual testing sufficient for now

## Future Architectural Considerations

### If Scale Increases
1. **Cloud Functions**: Server-side logic for notifications, moderation
2. **Cloud Storage**: File/image uploads
3. **TypeScript**: Type safety at scale
4. **Redux/Zustand**: More complex state management
5. **Code splitting**: Lazy load screens
6. **Monitoring**: Crashlytics, Analytics
7. **CI/CD**: Automated builds and deployments

### If Team Grows
1. **Monorepo**: Shared packages (utils, types)
2. **Component library**: Reusable UI components
3. **Style guide**: Design system
4. **Documentation**: More comprehensive docs
5. **Code review**: PR templates, linting rules

## Lessons Learned

1. **RTDB for Presence**: `.onDisconnect()` is invaluable
2. **Offline Persistence**: Can't enable after first Firestore call
3. **Emulator Conflicts**: Disable persistence when using emulators
4. **Read Receipts**: Use `arrayUnion()` to prevent duplicates
5. **Group Chat Logic**: Always check member count for conditional logic
6. **Optimistic UI**: Essential for perceived performance
7. **Error Boundaries**: Saved us from crashes multiple times
8. **Retry Logic**: Most network issues are transient

