# AI Features Setup Instructions

## OpenAI API Key Setup

1. Create a `.env` file in the `messageai/` directory:
```bash
cd messageai
touch .env
```

2. Add your OpenAI API key to the `.env` file:
```
OPENAI_API_KEY=your_openai_api_key_here
USE_EMULATORS=false
```

3. Get your OpenAI API key:
   - Go to https://platform.openai.com/api-keys
   - Create a new API key
   - Copy and paste it into the `.env` file

## Testing AI Features

1. Start the app: `npx expo start`
2. In any chat, tap the 🤖 button (formerly photo button)
3. Select "AI Assistant" from the menu
4. Try these commands:
   - "Translate messages from last hour"
   - "Translate messages from last day"  
   - "Can you explain any slang in recent messages?"
   - "Suggest appropriate responses"

## AI Features Implemented

### ✅ Core Translation (International Communicator)
- **Real-time Translation**: GPT-4o mini with language detection
- **Automatic Language Detection**: Built into translation pipeline
- **Bulk Translation**: Process messages from last hour/day/starting now
- **Threaded AI Messages**: Translations appear below original messages

### ✅ AI Infrastructure
- OpenAI GPT-4o mini integration
- RAG pipeline with chat history context
- AI message storage in Firestore
- Error handling and rate limiting
- Progress tracking for bulk operations

### ✅ UI Components
- AI menu button (replaces photo button)
- AI Assistant modal with chat interface
- Quick action buttons for common tasks
- Translation message component with feedback
- Cultural context highlighting

## Next Steps
- Add formality adjustment options
- Implement cultural context hints
- Add smart reply suggestions
- Performance optimization

## File Structure
```
messageai/
├── .env                          # Your API keys (create this)
├── utils/
│   ├── aiService.js             # OpenAI integration
│   ├── aiContext.js             # RAG pipeline
│   └── aiFirestore.js           # AI message storage
├── components/
│   ├── AIMenuButton.js          # AI menu interface
│   ├── AIAssistant.js           # AI chat modal
│   └── TranslationMessage.js    # AI message display
```

## Troubleshooting
- If you get "API key not found" error, check your `.env` file
- If translations are slow, check your OpenAI usage limits
- If no AI responses, check console logs for errors
