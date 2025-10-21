# MessageAI — Project Brief

## Project Overview
MessageAI is a cross-platform (iOS-first) real-time messaging MVP built with React Native (Expo) and Firebase. The goal is to create a working messaging application where authenticated users can send and receive messages in real-time, with support for both one-on-one and group chats.

## Core Objectives
1. Build a functional messaging app using React Native and Expo
2. Implement real-time message synchronization using Firebase Firestore
3. Support authentication via Firebase Auth
4. Enable offline message persistence and sync
5. Support group chat with 3+ members

## MVP Scope
**In Scope:**
- User authentication (email/password)
- Real-time one-on-one messaging
- Group chat functionality
- Message persistence and offline sync
- Clean, usable chat interface

**Out of Scope for MVP:**
- AI summarization or translation
- Push notifications
- File/image uploads
- Cloud Functions or backend AI integration

## Success Criteria
1. Users can sign up and log in using Firebase Authentication
2. Two users can send and receive messages in real-time
3. Messages persist and sync correctly when the app restarts
4. Users can go offline and messages will sync on reconnection
5. The app runs on Expo iOS simulator
6. Group chat with 3+ members works
7. Clean, usable chat interface

## Implementation Approach
The project is divided into 7 pull requests (PRs), each building on the previous:
1. **PR #1**: Project setup & Firebase initialization ✅
2. **PR #2**: Authentication flow
3. **PR #3**: Firestore schema & message model
4. **PR #4**: Real-time chat UI
5. **PR #5**: Group chat support
6. **PR #6**: Offline support & reliability
7. **PR #7**: UI polish & QA

## Target Platform
- Primary: iOS (via Expo Go and iOS Simulator)
- Future: Android support (built-in with React Native)

## Timeline
Estimated: ~20 hours total
- Average 2-4 hours per PR
- Iterative development approach

