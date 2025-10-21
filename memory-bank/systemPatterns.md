# MessageAI — System Patterns

## Architecture Overview
MessageAI follows a client-only architecture for the MVP, with Firebase providing backend services (authentication, database, and real-time sync).

```
┌─────────────────────────────────────┐
│     React Native (Expo) App         │
├─────────────────────────────────────┤
│  UI Layer (Screens & Components)    │
│  State Management (Context API)     │
│  Firebase SDK Integration            │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│         Firebase Services            │
├─────────────────────────────────────┤
│  • Authentication (Auth)             │
│  • Real-time Database (Firestore)    │
│  • Offline Persistence (Local)       │
└─────────────────────────────────────┘
```

## Key Technical Decisions

### 1. Frontend Framework
**Choice**: React Native with Expo
**Rationale**:
- Cross-platform development (iOS + Android from one codebase)
- Expo simplifies development and testing
- Hot reload for fast iteration
- No need for Xcode/Android Studio in development

### 2. Backend Services
**Choice**: Firebase (BaaS)
**Rationale**:
- Real-time sync out of the box
- Built-in authentication
- Offline persistence support
- No backend code to write/maintain
- Excellent React Native SDK

### 3. State Management
**Choice**: React Context API (planned for PR #2)
**Rationale**:
- Built-in to React, no extra dependencies
- Sufficient for MVP scope
- Easy to upgrade to Redux/Zustand later if needed

### 4. Navigation
**Choice**: TBD in PR #2 (likely React Navigation)
**Rationale**:
- Industry standard for React Native
- Well-documented and maintained
- Supports stack, tab, and drawer navigation

## Component Relationships

### Current Structure (PR #1)
```
App.js (Root)
├── Firebase Initialization
└── Connection Test UI
```

### Planned Structure (After PR #2)
```
App.js (Root)
├── AuthProvider (Context)
│   ├── Navigation Stack
│   │   ├── LoginScreen
│   │   ├── SignupScreen
│   │   └── ChatScreen (if authenticated)
```

### Future Structure (After PR #4)
```
App.js (Root)
├── AuthProvider (Context)
│   ├── Navigation Stack
│   │   ├── Auth Flow
│   │   │   ├── LoginScreen
│   │   │   └── SignupScreen
│   │   └── Main Flow (authenticated)
│   │       ├── ChatListScreen
│   │       └── ChatScreen
│   │           ├── MessageList (FlatList)
│   │           └── MessageInput
```

## Design Patterns in Use

### 1. Context Provider Pattern
Used for authentication state management:
- Centralizes auth logic
- Provides auth state to all components
- Handles Firebase auth state changes

### 2. Real-time Listener Pattern
Used for Firestore data sync:
- Subscribe to Firestore changes
- Automatic UI updates on data changes
- Unsubscribe on component unmount

### 3. Optimistic UI Updates
Used for message sending:
- Show message immediately
- Update with server response
- Handle failures gracefully

### 4. Firebase Modular SDK Pattern
Used for tree-shaking and bundle size:
```javascript
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
```

## Data Flow

### Authentication Flow (Planned)
```
User Action → AuthContext → Firebase Auth → onAuthStateChanged
    ↓                                              ↓
UI Update ← AuthContext State Update ← Auth State Change
```

### Message Flow (Planned)
```
User Sends Message → Firestore Write → Real-time Sync
    ↓                                         ↓
Optimistic UI Update               All Connected Clients
    ↓
Confirmation from Firestore
```

## Error Handling Strategy
1. **Network Errors**: Queue operations, retry on reconnection
2. **Auth Errors**: Display user-friendly messages, log to console
3. **Firestore Errors**: Rollback optimistic updates, notify user
4. **Validation Errors**: Prevent submission, show inline feedback

## Performance Considerations
1. **Bundle Size**: Using modular Firebase imports for tree-shaking
2. **Rendering**: FlatList for efficient message rendering (upcoming)
3. **Offline**: Firestore local persistence for offline-first experience
4. **Memory**: Proper cleanup of listeners on unmount

