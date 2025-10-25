# Firebase Deployment Guide

This document explains how to deploy Firebase rules and set up the database for the MessageAI app.

## Prerequisites

1. **Firebase CLI installed**: `npm install -g firebase-tools`
2. **Firebase project created**: Create a project at https://console.firebase.google.com
3. **Authentication configured**: Login with `firebase login`
4. **Project initialized**: Run `firebase init` in project root

## Firebase Services Setup

### Required Services
- **Authentication** (Email/Password)
- **Firestore Database** (NoSQL document database)
- **Realtime Database** (for presence/typing indicators)

### Enable Services in Firebase Console

1. **Authentication**:
   - Go to Authentication > Sign-in method
   - Enable "Email/Password" provider

2. **Firestore Database**:
   - Go to Firestore Database > Create database
   - Start in test mode (rules will be deployed)
   - Choose region (us-central1 recommended)

3. **Realtime Database**:
   - Go to Realtime Database > Create database
   - Start in test mode (rules will be deployed)  
   - Choose region (us-central1 recommended)

## Deployment Commands

### Deploy All Rules
```bash
# Deploy Firestore rules and indexes
firebase deploy --only firestore

# Deploy Realtime Database rules
firebase deploy --only database

# Deploy both at once
firebase deploy --only database,firestore
```

### Deploy Individual Components
```bash
# Firestore rules only
firebase deploy --only firestore:rules

# Firestore indexes only  
firebase deploy --only firestore:indexes

# Realtime Database rules only
firebase deploy --only database
```

## Rule Files Overview

### `firestore.rules`
**Purpose**: Security rules for Firestore document access

**Key Features**:
- Users can only access chats they're members of
- Users can only edit their own profile
- Message creation requires membership in chat
- AI messages have special validation
- Read receipts can be updated by any chat member

**Collections Protected**:
- `/users/{userId}` - User profiles with nicknames, icons, preferences
- `/chats/{chatId}` - Chat metadata with member lists
- `/chats/{chatId}/messages/{messageId}` - Messages with read receipts

### `firestore.indexes.json`
**Purpose**: Composite indexes for efficient queries

**Optimized Queries**:
- Chat list by membership and last message time
- Messages by type and timestamp (for AI threading)
- Read receipt arrays for WhatsApp-style indicators
- Member arrays for group chat access

### `database.rules.json`  
**Purpose**: Security rules for Realtime Database

**Key Features**:
- Users can only write their own presence status
- All users can read presence data (for online indicators)
- Typing indicators scoped to specific chats
- Test collection for emulator validation

**Paths Protected**:
- `/status/{uid}` - Online/offline presence with timestamps
- `/typing/{chatId}/{uid}` - Typing indicators per chat
- `/test` - Development testing (remove in production)

## Testing Rules Locally

### Start Firebase Emulators
```bash
# Start all emulators
firebase emulators:start

# Start specific emulators
firebase emulators:start --only auth,firestore,database

# View emulator UI
open http://localhost:4000
```

### Test Rule Configuration
The app automatically uses emulators when `USE_EMULATORS=true` in config.

### Validate Rules
```bash
# Test Firestore rules
firebase emulators:exec --only firestore 'npm test'

# Test with different users in emulator UI
# Create test users and verify access permissions
```

## Production Deployment Checklist

### Before First Deploy
- [ ] Remove test rules from `database.rules.json`
- [ ] Verify Firestore rules restrict access properly  
- [ ] Test with multiple users in emulator
- [ ] Confirm indexes cover all app queries

### Deploy Process
```bash
# 1. Deploy rules first
firebase deploy --only database,firestore

# 2. Verify in Firebase console
# 3. Test with production data

# 4. Monitor for permission errors
firebase logs --only hosting,functions
```

### Post-Deploy Verification
1. **Test Authentication**: Users can sign up/login
2. **Test Chat Access**: Users only see their chats
3. **Test Message Creation**: Messages save with proper permissions
4. **Test Presence**: Online/offline indicators work
5. **Monitor Errors**: Check Firebase console for rule violations

## Security Notes

### Firestore Rules
- **Defense in Depth**: Rules are enforced server-side
- **No Secret Data**: Never rely on client-side security
- **Member Validation**: All access validated against membership arrays
- **AI Message Security**: AI messages require requestedBy field

### Realtime Database Rules  
- **Presence Privacy**: Users control their own status only
- **Public Read**: Presence is readable for online indicators
- **Chat Scoping**: Typing indicators limited to specific chats

### Best Practices
- Test rules thoroughly before production deployment
- Monitor Firebase usage for unexpected access patterns  
- Regular security reviews of rule effectiveness
- Keep test data separate from production

## Troubleshooting

### Common Issues

**Permission Denied Errors**:
```bash
# Check current rules deployment
firebase firestore:databases:list

# View rule evaluation in console
# Firebase Console > Firestore > Rules > Simulator
```

**Index Errors**:
```bash  
# Deploy missing indexes
firebase deploy --only firestore:indexes

# Check index creation status in console
```

**Emulator Connection Issues**:
```bash
# Reset emulator data
firebase emulators:start --import=./emulator-data --export-on-exit

# Check port conflicts (8080, 9000, 9099)
lsof -ti:8080 | xargs kill -9
```

### Getting Help

- **Firebase Console**: Check logs and monitoring
- **Emulator UI**: Test rules and data locally  
- **Firebase Support**: For production issues
- **Documentation**: https://firebase.google.com/docs/rules

## Quick Reference

```bash
# Most common commands
firebase deploy --only database,firestore  # Deploy all rules
firebase emulators:start                   # Local development  
firebase console                           # Open Firebase console
firebase projects:list                     # Show available projects
firebase use --add                         # Switch projects
```

## Environment Configuration

The app uses these environment variables for Firebase:

```bash
# messageai/.env
USE_EMULATORS=false  # Set to true for local development
OPENAI_API_KEY=xxx   # Required for AI features
```

When `USE_EMULATORS=true`, the app connects to local emulators instead of production Firebase.
