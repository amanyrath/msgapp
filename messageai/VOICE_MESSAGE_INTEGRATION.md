# Voice Message Integration Guide

This guide shows how to integrate Apple-style voice messages into your existing ChatScreen.

## Prerequisites

First, install the required packages:
```bash
cd messageai
npm install expo-av expo-file-system react-native-gesture-handler
```

## 1. Update app.json for Permissions

Add microphone permissions to your `app.json`:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-av",
        {
          "microphonePermission": "Allow MessageAI to access your microphone for voice messages."
        }
      ]
    ]
  }
}
```

## 2. Firebase Storage Setup

Enable Firebase Storage in your Firebase Console:
1. Go to Firebase Console → Your Project → Storage
2. Click "Get Started"
3. Choose production mode with default rules (we'll secure later)
4. Select your region (same as Firestore for consistency)

## 3. Update ChatScreen.js

Here are the key changes to make to your `ChatScreen.js`:

### A. Add Imports

Add these imports at the top of ChatScreen.js:

```javascript
// Add these to your existing imports
import AudioMessageBubble from '../components/AudioMessageBubble';
import AudioMessageManager from '../components/AudioMessageManager';
import { Audio } from 'expo-av';
```

### B. Add Audio State Management

Add these state variables to your ChatScreen component (around line 97):

```javascript
// Add these state variables
const [playingAudioId, setPlayingAudioId] = useState(null);
const [audioObjects, setAudioObjects] = useState(new Map()); // Track audio objects for cleanup
```

### C. Audio Playback Management

Add these functions to manage audio playback (after your existing handler functions):

```javascript
// Audio playback management
const handleAudioPlayStateChange = useCallback(async (isPlaying, audioId) => {
  try {
    if (isPlaying) {
      // Stop any currently playing audio
      if (playingAudioId && playingAudioId !== audioId) {
        const currentAudio = audioObjects.get(playingAudioId);
        if (currentAudio) {
          await currentAudio.pauseAsync();
        }
      }
      setPlayingAudioId(audioId);
    } else {
      setPlayingAudioId(null);
    }
  } catch (error) {
    console.error('Error managing audio playback:', error);
  }
}, [playingAudioId, audioObjects]);

// Cleanup audio objects when component unmounts
useEffect(() => {
  return () => {
    // Cleanup all audio objects
    audioObjects.forEach(async (audio) => {
      try {
        await audio.unloadAsync();
      } catch (error) {
        console.error('Error unloading audio:', error);
      }
    });
    setAudioObjects(new Map());
  };
}, []);
```

### D. Update renderMessage Function

Update your `renderMessage` function (around line 1420) to handle audio messages:

```javascript
const renderMessage = useCallback((item) => {
  // ... your existing code ...

  // ADD THIS: Handle audio messages
  if (item.type === 'audio') {
    const isOwn = item.senderId === user?.uid;
    
    return (
      <View key={item.id} style={styles.messageContainer}>
        <AudioMessageBubble
          audioUri={item.audio.url}
          duration={item.audio.duration * 1000} // Convert to milliseconds
          isOwn={isOwn}
          timestamp={formatTime(item.timestamp)}
          senderName={isOwn ? null : getDisplayName(item)}
          onPlayStateChange={handleAudioPlayStateChange}
          isPlaying={playingAudioId === item.audio.url}
          style={isOwn ? styles.ownMessage : styles.otherMessage}
        />
      </View>
    );
  }

  // ... rest of your existing renderMessage code for text/photo messages ...
}, [user?.uid, getDisplayName, chatMembers, formatTime, playingAudioId, handleAudioPlayStateChange]);
```

### E. Update Message Input Area

Replace your message input section (around line 1720) with this enhanced version:

```javascript
{/* Enhanced message input with voice message support */}
<KeyboardAvoidingView 
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  style={styles.inputContainer}
>
  <View style={styles.inputRow}>
    {/* Text input */}
    <View style={styles.textInputContainer}>
      <SmartTextInput
        style={styles.input}
        placeholder={t('typeMessage')}
        value={newMessage}
        onChangeText={handleTyping}
        onLanguageDetected={handleLanguageDetection}
        userNativeLanguage={userLanguagePreference || userLanguage}
        multiline
        maxLength={500}
      />
    </View>
    
    {/* Send button or Voice message button */}
    {newMessage.trim() ? (
      <TouchableOpacity
        style={[
          styles.sendButton,
          !newMessage.trim() && styles.sendButtonDisabled,
        ]}
        onPress={() => handleSendMessage()}
        disabled={!newMessage.trim() || sendingPhoto}
      >
        <Text style={styles.sendButtonText}>{t('send')}</Text>
      </TouchableOpacity>
    ) : (
      <AudioMessageManager
        chatId={chatId}
        currentUser={user}
        disabled={sendingPhoto}
        onSendStart={() => console.log('Voice message upload started')}
        onSendComplete={(messageId, audioData) => {
          console.log('Voice message sent:', messageId);
          // Optional: Add haptic feedback or animation
        }}
        onSendError={(error) => {
          console.error('Voice message error:', error);
        }}
        style={styles.audioButton}
      />
    )}
  </View>
  
  {/* AI Menu Button */}
  <AIMenuButton
    onOpenAI={() => setAiAssistantVisible(true)}
    disabled={sendingPhoto}
    userNativeLanguage={userLanguagePreference || userLanguage}
    messages={messages}
    currentUser={user}
    chatId={chatId}
  />
</KeyboardAvoidingView>
```

### F. Add Styles

Add these styles to your StyleSheet (around line 1750):

```javascript
// Add these to your existing styles
inputRow: {
  flexDirection: 'row',
  alignItems: 'flex-end',
  paddingHorizontal: 10,
  paddingBottom: 10,
},
textInputContainer: {
  flex: 1,
  marginRight: 10,
},
audioButton: {
  marginBottom: 5,
},
```

## 4. Update Firebase Storage Rules

Add these security rules to your Firebase Storage (in Firebase Console → Storage → Rules):

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Audio messages in chats
    match /chats/{chatId}/audio/{audioId} {
      // Allow read/write if user is authenticated and is a member of the chat
      allow read, write: if request.auth != null;
      // TODO: Add more specific rules to check chat membership
    }
  }
}
```

## 5. Test the Integration

1. **Start your development server:**
   ```bash
   npm start
   ```

2. **Test on iOS Simulator:**
   - Press 'i' to open iOS Simulator
   - Open your app and navigate to a chat
   - You should see a microphone button when the text input is empty

3. **Test Voice Messages:**
   - **Hold** the microphone button to start recording
   - **Slide left** while holding to cancel
   - **Release** to send the voice message
   - Tap audio messages to play them back

## 6. Known Limitations & Future Enhancements

### Current Limitations:
- Requires real device for microphone (simulator won't record)
- No waveform visualization during recording yet
- No transcript display (will add with OpenAI Whisper)

### Future Enhancements (Translation Feature):
- Speech-to-text transcription
- Real-time translation of voice messages  
- Text-to-speech in user's language
- Cultural context analysis

## Troubleshooting

### Permission Issues:
```javascript
// Add this to test permissions
import { Audio } from 'expo-av';

const checkAudioPermissions = async () => {
  const { status } = await Audio.requestPermissionsAsync();
  console.log('Audio permission status:', status);
  if (status !== 'granted') {
    Alert.alert('Permission Required', 'Microphone permission is needed for voice messages.');
  }
};
```

### Storage Issues:
- Make sure Firebase Storage is enabled in console
- Check that storage rules allow authenticated users
- Verify your Firebase config includes storage settings

### Audio Playback Issues:
- Ensure audio URLs are accessible
- Check network connectivity
- Add error handling for failed audio loads

## Next Steps

After basic voice messages are working:

1. **Add Translation:** Integrate OpenAI Whisper for speech-to-text
2. **Add TTS:** Use OpenAI TTS for translated voice responses  
3. **Improve UX:** Add waveform animations and better progress indicators
4. **Add Analytics:** Track voice message usage and success rates

This completes the basic Apple-style voice message integration! 🎤✨

