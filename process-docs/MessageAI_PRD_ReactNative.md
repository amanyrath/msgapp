# MessageAI — MVP Project Requirements Document (React Native + Firebase)

## Project Summary
**Goal:** Build a cross-platform (iOS-first) real-time messaging MVP using React Native (Expo) and Firebase.  
**Scope:** Focus on chat, persistence, and authentication. AI and Cloud Functions will come later.

**Outcome:**  
A working iOS Expo app where two or more authenticated users can send and receive real-time messages backed by Firebase Firestore and Firebase Authentication.

---

## 1. MVP Success Criteria
1. Users can sign up and log in using Firebase Authentication.
2. Two users can send and receive messages in real-time.
3. Messages persist and sync correctly when the app restarts.
4. Users can go offline and messages will sync on reconnection.
5. The app runs on Expo iOS simulator.
6. Group chat with 3+ members works.
7. Clean, usable chat interface.

---

## 2. Functional Requirements

### 2.1 Authentication
- Email/password authentication using Firebase Auth Web SDK.
- Display user’s name and email.
- Persist sessions locally.

### 2.2 One-on-One Chat
- Create chat thread automatically when two users exchange messages.
- Real-time updates via Firestore snapshot listeners.
- Optimistic UI updates for message send.

### 2.3 Group Chat
- Simple group creation (hardcoded members for MVP).
- Sync messages to all members in real time.

### 2.4 Message Persistence
- Offline caching using Firestore’s local persistence.
- Messages sent offline queue and sync on reconnect.

### 2.5 UI/UX
- Scrollable chat list and input bar.
- Different styling for sent/received messages.
- Loading and error indicators.

---

## 3. Technical Architecture
| Layer | Component | Technology |
|-------|------------|-------------|
| Frontend | Mobile App | React Native (Expo SDK 52) |
| Realtime Database | Firestore | Firebase Web SDK |
| Authentication | Firebase Auth | Firebase Web SDK |
| Local Storage | Offline cache | Firestore local persistence |
| Notifications | (Future) | Firebase Cloud Messaging |

---

## 4. Testing Plan
- Lightweight manual testing using iOS Simulator (Expo Go).
- Validate real-time sync between two accounts.
- Test offline queueing by toggling network in simulator.

---

## 5. Non-Functional Requirements
- Messages appear in <300ms when online.
- No message loss or duplication.
- Works offline and syncs automatically.
- Firestore security rules restrict reads/writes to chat members only.

---

## 6. Definition of Done (DoD)
- Two iOS simulators exchanging messages live.
- Real-time sync, offline persistence verified.
- Simple, functional UI for chat and login.
- Group chat working.
- Clear documentation on setup and run commands.

---

## 7. Out of Scope for MVP
- AI summarization or translation.
- Push notifications.
- File/image uploads.
- Cloud Functions or backend AI integration.
