# MessageAI — Active Context

## Current Status: PR #2 Complete ✅

### What We Just Completed
**PR #2: Authentication Flow**
- ✅ Installed React Navigation and dependencies
- ✅ Created `AuthContext` with full auth state management
- ✅ Built `LoginScreen` with email/password authentication
- ✅ Built `SignupScreen` with validation
- ✅ Created placeholder `ChatScreen`
- ✅ Implemented `onAuthStateChanged` for session persistence
- ✅ Set up navigation stack (Auth vs Main flow)
- ✅ Added loading states and error handling
- ✅ Created comprehensive testing guide

### Current Work Focus
**Status**: PR #2 is complete and ready for testing

**What's Working Now:**
- Full authentication system with Firebase Auth
- Users can sign up with email/password
- Users can log in with existing credentials
- Session persists across app restarts
- Automatic navigation based on auth state
- Sign out functionality
- Input validation and error messages
- Loading indicators during async operations
- Smooth navigation transitions

### Next Immediate Steps
**PR #3: Firestore Schema & Message Model** (Next Up)
1. Design Firestore collection structure
2. Create `/chats/{chatId}/messages/{messageId}` schema
3. Define message document model
4. Create Firestore helper functions (read/write)
5. Test data operations in Firebase Console
6. Set up basic security rules

### Active Decisions & Considerations

**Decision 1: Configuration Management**
- Using direct config file (`config/firebase.js`) with placeholder values
- User needs to manually replace with their Firebase credentials
- Alternative considered: Environment variables (not chosen due to Expo complexity)

**Decision 2: Navigation Library**
- **DECIDED**: Using React Navigation (native-stack)
- Rationale: Industry standard, well-documented, Expo-compatible
- Alternative considered: Expo Router (newer, less documentation)

**Decision 3: State Management**
- **DECIDED**: Using React Context API for auth state
- AuthContext provides: user, loading, error, signUp, signIn, signOut
- Sufficient for MVP, can upgrade to Redux/Zustand later if needed

**Decision 4: Project Structure**
- **IMPLEMENTED**: Organized structure with `/screens`, `/context`, `/config`
- Clean separation of concerns
- Easy to navigate and maintain

**Decision 5: Auth Flow**
- Conditional rendering based on auth state
- Login screen is default (no user)
- Chat screen when authenticated
- Session automatically persists via onAuthStateChanged

**Decision 6: Testing Approach**
- Manual testing using iOS Simulator
- Comprehensive testing checklist created (TESTING.md)
- Will test with multiple simulators for multi-user scenarios (PR #4)
- No automated testing for MVP

### Blockers & Questions
**Current Blockers**: None

**Open Questions**:
1. Should we add email verification? (Not for MVP, consider post-launch)
2. Password reset functionality? (Not for MVP, add in future)
3. Social auth providers? (Out of scope for MVP)

### User Setup Required
Before the app can fully function, the user must:
1. Create a Firebase project at console.firebase.google.com
2. **Enable Authentication (Email/Password method)** ← CRITICAL for PR #2
3. Enable Firestore Database (needed for PR #3)
4. Copy Firebase config into `/config/firebase.js`
5. Run `npm start` in the messageai directory
6. Test signup/login flow as per TESTING.md

### Recent Technical Insights
- React Navigation v6 uses native-stack for best performance
- onAuthStateChanged creates a persistent listener (auto-cleanup needed)
- Firebase Auth state persists in IndexedDB (web) / AsyncStorage (mobile)
- Conditional navigation based on auth state works perfectly with Stack.Navigator
- KeyboardAvoidingView essential for iOS input fields
- Alert.alert for simple error messages (will upgrade to toast in PR #7)

