# MessageAI Testing Guide

## PR #2 Testing Checklist

### ✅ Authentication Testing

#### Test 1: User Signup
1. Launch app (should show Login screen)
2. Click "Don't have an account? Sign Up"
3. Enter test email: `test@example.com`
4. Enter password: `password123`
5. Enter confirm password: `password123`
6. Click "Sign Up"

**Expected Result**:
- Loading indicator shows briefly
- Automatically navigates to Chat Screen
- Shows "Welcome to MessageAI!"
- Displays email: `test@example.com`
- Console logs: "Sign up successful: test@example.com"

#### Test 2: User Login
1. On Chat Screen, click "Sign Out"
2. Should return to Login Screen
3. Enter email: `test@example.com`
4. Enter password: `password123`
5. Click "Log In"

**Expected Result**:
- Loading indicator shows briefly
- Navigates to Chat Screen
- Shows correct email
- Console logs: "Sign in successful: test@example.com"

#### Test 3: Session Persistence
1. While logged in, close the app completely
2. Reopen the app from scratch

**Expected Result**:
- Brief loading screen
- Automatically shows Chat Screen (no login required)
- User is still logged in
- Console logs: "User signed in: test@example.com"

#### Test 4: Sign Out
1. From Chat Screen, click "Sign Out"

**Expected Result**:
- Immediately returns to Login Screen
- Console logs: "Sign out successful"
- Console logs: "User signed out"

#### Test 5: Navigation Between Screens
1. From Login Screen, click "Don't have an account? Sign Up"
2. Should navigate to Signup Screen
3. Click "Already have an account? Log In"
4. Should return to Login Screen

**Expected Result**:
- Smooth navigation transitions
- No crashes or errors
- Fields are empty on each screen

### ❌ Error Handling Testing

#### Test 6: Empty Fields
1. On Login Screen, leave email and password empty
2. Click "Log In"

**Expected Result**:
- Alert shows: "Please enter both email and password"
- Stays on Login Screen

#### Test 7: Invalid Email
1. On Signup Screen, enter email: `notanemail`
2. Enter password: `password123`
3. Click "Sign Up"

**Expected Result**:
- Alert shows Firebase error about invalid email
- Stays on Signup Screen

#### Test 8: Short Password
1. On Signup Screen, enter valid email
2. Enter password: `12345` (less than 6 characters)
3. Enter confirm password: `12345`
4. Click "Sign Up"

**Expected Result**:
- Alert shows: "Password must be at least 6 characters"
- Stays on Signup Screen

#### Test 9: Password Mismatch
1. On Signup Screen, enter valid email
2. Enter password: `password123`
3. Enter confirm password: `password456`
4. Click "Sign Up"

**Expected Result**:
- Alert shows: "Passwords do not match"
- Stays on Signup Screen

#### Test 10: Wrong Password
1. On Login Screen, enter existing email
2. Enter wrong password
3. Click "Log In"

**Expected Result**:
- Alert shows: "Login Failed" with Firebase error
- Stays on Login Screen

### 🔄 State Management Testing

#### Test 11: Loading States
1. On Login Screen, enter credentials
2. Click "Log In"
3. Observe UI during authentication

**Expected Result**:
- Button shows loading spinner
- Input fields are disabled
- Cannot click buttons while loading

#### Test 12: Multiple Sign Ups (Duplicate Email)
1. Sign out if logged in
2. Try to sign up with an email that already exists
3. Click "Sign Up"

**Expected Result**:
- Alert shows: "Sign Up Failed: email-already-in-use"
- Stays on Signup Screen
- User can try again

## Console Output Examples

### Successful Flow
```
Firebase connected successfully!
User signed out
Sign up successful: test@example.com
User signed in: test@example.com
Sign out successful
User signed out
Sign in successful: test@example.com
User signed in: test@example.com
```

### Error Flow
```
Sign up error: Firebase: Error (auth/email-already-in-use).
Sign in error: Firebase: Error (auth/wrong-password).
```

## Performance Expectations

- **Screen transitions**: < 100ms
- **Authentication**: < 2 seconds (network dependent)
- **Loading indicator**: Should be visible for any operation > 200ms
- **Session check**: < 500ms on app startup

## Known Limitations (MVP)

1. No password reset functionality
2. No email verification
3. No profile management
4. No "remember me" toggle (always remembers)
5. Basic error messages (not user-friendly translations)
6. No loading indicators for navigation

## Next Steps After PR #2

Once all tests pass:
1. Commit changes
2. Proceed to PR #3: Firestore Schema
3. Keep test account credentials for future testing

## Troubleshooting

### App won't start
```bash
npx expo start -c  # Clear cache
```

### Navigation errors
```bash
rm -rf node_modules
npm install
```

### Firebase errors
1. Check Firebase console for Auth status
2. Verify config in `config/firebase.js`
3. Check console logs for specific error codes

