# User-Specific Language System Guide

## Overview

The MessageAI app now includes a comprehensive user-specific language system that:

1. **Detects system language** on initial signup
2. **Stores individual language preferences** per user in Firestore
3. **Initializes UI** based on each user's saved language setting
4. **Provides language settings interface** for users to change their preference
5. **Updates AI responses** to match the user's interface language

## Architecture

### Core Components

1. **User Profile Integration**
   - `languagePreference`: Stored in user profiles (Firestore)
   - `systemLanguage`: Reference to originally detected system language
   - Firestore functions: `getUserLanguagePreference()`, `updateUserLanguagePreference()`

2. **Enhanced LocalizationContext**
   - `userLanguagePreference`: Current user's saved preference
   - `initializeUserLanguage(userId)`: Load user's language preference
   - `setUserLanguagePreference(userId, language)`: Update user's preference

3. **UserLanguageInitializer Component**
   - Initializes user language preferences when they log in
   - Wraps navigation to ensure language loads before UI renders

4. **Profile Settings Integration**
   - Language selection interface in ProfileScreen
   - 15+ supported languages with action sheet/alert picker
   - Real-time language switching with immediate feedback

## Implementation Details

### User Signup Flow

```javascript
// On signup, detect and store system language
const systemLanguage = getSystemLanguage(); // e.g., 'es-ES'
const languageName = getLanguageName(systemLanguage); // e.g., 'Spanish'

await createUserProfile(userId, {
  email,
  displayName: nickname,
  nickname,
  icon,
  languagePreference: languageName, // User's language preference
  systemLanguage: systemLanguage, // System language for reference
});
```

### User Login Flow

```javascript
// UserLanguageInitializer automatically loads user's language preference
useEffect(() => {
  if (user?.uid && !isInitialized) {
    initializeUserLanguage(user.uid);
  }
}, [user?.uid, initializeUserLanguage, isInitialized]);
```

### Language Settings UI

**Location**: Profile Screen → Language Preference Section

**Features**:
- Dropdown/action sheet with 15+ languages
- Real-time language switching
- Immediate UI translation
- AI system prompt updates
- Firestore persistence
- Loading states and error handling

**Supported Languages**:
- English, Spanish, French, German, Italian
- Portuguese, Japanese, Chinese, Korean
- Arabic, Russian, Dutch, Swedish, Norwegian, Finnish

### AI Integration

The AI system automatically adapts to user language preferences:

```javascript
// AI functions now receive user's interface language
const response = await processChatMessage({
  userMessage: userMessage.text,
  chatContext: messages.slice(-10),
  userPreferences: aiContext.userPreferences,
  userLanguage: userLanguage // User's interface language
});

// System prompts are language-aware
const systemPrompt = getLanguageAwareSystemPrompt(userLanguage, 'chat_assistant');
```

## User Experience

### New User Experience
1. **Signup**: System language automatically detected and saved
2. **First Login**: UI appears in user's system language
3. **Language Choice**: User can change language in Profile settings
4. **AI Adaptation**: AI responds in user's chosen interface language

### Existing User Experience
1. **Login**: UI loads in user's previously saved language preference
2. **Language Change**: Immediate UI translation when changed in settings
3. **Persistence**: Language preference persists across app sessions
4. **AI Consistency**: AI always responds in user's interface language

## Technical Benefits

### Performance
- **24-hour translation cache**: Reduces API calls for UI translations
- **Batch translation**: Efficient API usage for multiple strings
- **Lazy loading**: Translations only loaded when needed
- **Smart initialization**: Language detection happens once per user

### Scalability
- **User-specific settings**: Each user has independent language preferences
- **Firestore integration**: Reliable persistence and synchronization
- **Context-based architecture**: Easy to extend with additional language features
- **Modular design**: Language system is isolated and maintainable

### User Control
- **Individual preferences**: Users can choose different languages than system
- **Real-time switching**: Immediate language changes without restart
- **Comprehensive coverage**: Both UI and AI adapt to language preference
- **Fallback handling**: Graceful degradation if language loading fails

## Testing the System

### Test Scenarios

1. **New User Signup**
   - Change device language to Spanish/French
   - Create new account
   - Verify UI appears in detected language
   - Check Firestore for saved language preference

2. **Language Settings**
   - Go to Profile → Language Preference
   - Select different language (e.g., German)
   - Verify immediate UI translation
   - Test AI responses are in new language
   - Restart app, verify language persists

3. **Multi-User Testing**
   - Create users with different language preferences
   - Switch between accounts
   - Verify each user's language preference loads correctly
   - Test AI responses adapt to each user's language

4. **Fallback Testing**
   - Test with network issues during language loading
   - Verify graceful fallback to English
   - Test invalid language preferences

### Expected Behaviors

- **UI Translation**: All buttons, labels, and messages appear in user's language
- **AI Responses**: AI generates responses in user's interface language
- **Persistence**: Language preferences survive app restarts
- **Performance**: Language switching is immediate (cached) or fast (API)
- **Error Handling**: Clear error messages if language update fails

## Troubleshooting

### Common Issues

1. **Language not loading**
   - Check network connectivity
   - Verify user is logged in
   - Check Firestore permissions
   - Look for console errors

2. **AI responses in wrong language**
   - Verify user's language preference in Profile
   - Check AI service receives correct `userLanguage` parameter
   - Ensure language-aware system prompts are working

3. **UI not translating**
   - Check translation cache (24-hour expiry)
   - Verify OpenAI API key is configured
   - Look for translation API errors in console

### Debug Commands

```javascript
// Check user's language preference
const userLang = await getUserLanguagePreference(userId);
console.log('User language:', userLang);

// Force refresh translations
await refreshTranslations();

// Check current localization state
const { languageName, userLanguagePreference, isEnglish } = useLocalization();
console.log('Current state:', { languageName, userLanguagePreference, isEnglish });
```

## Future Enhancements

### Potential Additions
- **Regional variations**: Support for regional dialects (e.g., es-MX vs es-ES)
- **Language detection from messages**: Auto-detect language from user's messages
- **Voice language settings**: Separate language settings for voice features
- **Language learning mode**: Switch between languages for learning purposes
- **Admin language override**: Organization-wide language policies

### Integration Opportunities
- **Push notifications**: Localized notification messages
- **Email templates**: Localized email communications
- **Export/Import**: Language-aware data export formats
- **Accessibility**: Screen reader language hints

## Conclusion

The user-specific language system provides a comprehensive, scalable solution for multilingual support in MessageAI. It combines system language detection, individual user preferences, real-time UI translation, and AI language adaptation to create a seamless international user experience.

The system is designed for performance (caching), reliability (fallbacks), and user control (individual preferences), making it suitable for global deployment with diverse user bases.
