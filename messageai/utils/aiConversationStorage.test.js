/**
 * Test for AI Conversation Storage
 * 
 * This is a basic integration test to verify the storage functionality works.
 * Run this in development to test the persistence features.
 */

import { 
  loadAIConversation, 
  saveAIConversation, 
  addMessageToAIConversation,
  clearAllAIConversations,
  getAIConversationStats,
  cleanupOldAIConversations
} from './aiConversationStorage';

// Mock AsyncStorage for testing
const mockStorage = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key) => Promise.resolve(mockStorage[key] || null)),
  setItem: jest.fn((key, value) => Promise.resolve(mockStorage[key] = value)),
  removeItem: jest.fn((key) => Promise.resolve(delete mockStorage[key])),
}));

describe('AI Conversation Storage', () => {
  const testChatId = 'test-chat-123';
  const testUserId = 'test-user-456';
  
  beforeEach(() => {
    // Clear mock storage before each test
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
  });

  test('should save and load conversation history', async () => {
    const testMessages = [
      {
        id: 'msg-1',
        text: 'Hello AI',
        sender: 'user',
        timestamp: new Date()
      },
      {
        id: 'msg-2',
        text: 'Hello! How can I help you?',
        sender: 'ai',
        timestamp: new Date()
      }
    ];

    // Save conversation
    const saveResult = await saveAIConversation(testChatId, testUserId, testMessages);
    expect(saveResult).toBe(true);

    // Load conversation
    const loadedMessages = await loadAIConversation(testChatId, testUserId);
    expect(loadedMessages).toHaveLength(2);
    expect(loadedMessages[0].text).toBe('Hello AI');
    expect(loadedMessages[1].text).toBe('Hello! How can I help you?');
  });

  test('should add message to existing conversation', async () => {
    // Start with initial messages
    const initialMessages = [
      {
        id: 'msg-1',
        text: 'Hello AI',
        sender: 'user',
        timestamp: new Date()
      }
    ];
    
    await saveAIConversation(testChatId, testUserId, initialMessages);

    // Add new message
    const newMessage = {
      id: 'msg-2',
      text: 'Hello! How can I help you?',
      sender: 'ai',
      timestamp: new Date()
    };

    const addResult = await addMessageToAIConversation(testChatId, testUserId, newMessage);
    expect(addResult).toBe(true);

    // Verify conversation has both messages
    const loadedMessages = await loadAIConversation(testChatId, testUserId);
    expect(loadedMessages).toHaveLength(2);
  });

  test('should return empty array when no conversation exists', async () => {
    const loadedMessages = await loadAIConversation('non-existent-chat', testUserId);
    expect(loadedMessages).toEqual([]);
  });

  test('should get conversation statistics', async () => {
    // Save a test conversation
    const testMessages = [
      { id: '1', text: 'Hello', sender: 'user', timestamp: new Date() },
      { id: '2', text: 'Hi there', sender: 'ai', timestamp: new Date() }
    ];
    
    await saveAIConversation(testChatId, testUserId, testMessages);

    const stats = await getAIConversationStats(testUserId);
    expect(stats.totalChats).toBe(1);
    expect(stats.totalMessages).toBe(0); // Messages count is updated in metadata separately
  });

  test('should clear all conversations for user', async () => {
    // Save conversations for multiple chats
    const messages1 = [{ id: '1', text: 'Chat 1', sender: 'user', timestamp: new Date() }];
    const messages2 = [{ id: '2', text: 'Chat 2', sender: 'user', timestamp: new Date() }];
    
    await saveAIConversation('chat-1', testUserId, messages1);
    await saveAIConversation('chat-2', testUserId, messages2);

    // Clear all conversations
    const clearResult = await clearAllAIConversations(testUserId);
    expect(clearResult).toBe(true);

    // Verify conversations are cleared
    const loadedMessages1 = await loadAIConversation('chat-1', testUserId);
    const loadedMessages2 = await loadAIConversation('chat-2', testUserId);
    
    expect(loadedMessages1).toEqual([]);
    expect(loadedMessages2).toEqual([]);
  });
});

/**
 * Manual testing guide for AI Conversation Persistence
 * 
 * To test the functionality in the actual app:
 * 
 * 1. Open the AI Assistant in any chat
 * 2. Have a conversation with the AI (ask questions, get responses)
 * 3. Close the AI Assistant modal
 * 4. Reopen the AI Assistant in the same chat
 * 5. Verify that your previous conversation is still there
 * 6. Close and reopen the app entirely
 * 7. Open the AI Assistant again - conversation should still persist
 * 8. Test across different chats to ensure conversations are isolated per chat
 * 9. Test with different users to ensure conversations are private per user
 * 
 * Expected behavior:
 * - Conversations persist across app sessions
 * - Each chat has its own AI conversation history
 * - Each user has private AI conversations (not shared between users)
 * - Old conversations are automatically cleaned up after 30 days
 * - Storage is limited to last 50 messages per chat and max 20 chats per user
 */
