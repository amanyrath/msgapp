/**
 * Tests for Firestore utilities
 */

import { mockFirestore, mockFirestoreDoc, mockFirestoreCollection } from '../setup';

// Mock the Firebase modules before importing firestore utils
jest.doMock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => mockFirestore),
  collection: mockFirestore.collection,
  doc: mockFirestore.doc,
  getDoc: mockFirestoreDoc.get,
  setDoc: mockFirestoreDoc.set,
  updateDoc: mockFirestoreDoc.update,
  addDoc: mockFirestoreCollection.add,
  serverTimestamp: mockFirestore.FieldValue.serverTimestamp,
  arrayUnion: mockFirestore.FieldValue.arrayUnion,
}));

const {
  createUserProfile,
  sendMessage,
  createOrGetChat,
  markMessagesAsRead
} = require('../../utils/firestore');

describe('Firestore utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createUserProfile', () => {
    it('should create a user profile with required fields', async () => {
      const userData = {
        email: 'test@example.com',
        displayName: 'Test User',
        nickname: 'TestNick',
        icon: '👤'
      };

      await createUserProfile('test-user-id', userData);

      expect(mockFirestore.doc).toHaveBeenCalledWith('users/test-user-id');
      expect(mockFirestoreDoc.set).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          displayName: 'Test User',
          nickname: 'TestNick',
          icon: '👤',
          createdAt: 'server-timestamp',
          updatedAt: 'server-timestamp'
        })
      );
    });

    it('should handle missing optional fields', async () => {
      const userData = {
        email: 'test@example.com'
      };

      await createUserProfile('test-user-id', userData);

      expect(mockFirestoreDoc.set).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          displayName: 'test@example.com',
          nickname: 'test@example.com',
          icon: '👤'
        })
      );
    });
  });

  describe('sendMessage', () => {
    it('should send a message with proper format', async () => {
      const messageData = {
        text: 'Hello world',
        senderId: 'test-sender',
        senderName: 'Test Sender'
      };

      await sendMessage('test-chat-id', messageData);

      expect(mockFirestore.collection).toHaveBeenCalledWith('chats');
      expect(mockFirestoreCollection.doc).toHaveBeenCalledWith('test-chat-id');
      expect(mockFirestoreCollection.add).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Hello world',
          senderId: 'test-sender',
          senderName: 'Test Sender',
          timestamp: 'server-timestamp',
          readBy: { arrayUnion: ['test-sender'] },
          type: 'text'
        })
      );
    });

    it('should send AI messages with proper metadata', async () => {
      const messageData = {
        text: 'AI response',
        senderId: 'ai-assistant',
        type: 'ai',
        aiMetadata: {
          requestedBy: 'test-user',
          originalMessageId: 'original-msg-id'
        }
      };

      await sendMessage('test-chat-id', messageData);

      expect(mockFirestoreCollection.add).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'AI response',
          senderId: 'ai-assistant',
          type: 'ai',
          aiMetadata: expect.objectContaining({
            requestedBy: 'test-user',
            originalMessageId: 'original-msg-id'
          })
        })
      );
    });
  });

  describe('createOrGetChat', () => {
    it('should create a new chat with sorted member IDs', async () => {
      const memberIds = ['user2', 'user1', 'user3'];
      
      // Mock that chat doesn't exist
      mockFirestoreCollection.get.mockResolvedValueOnce({
        empty: true,
        docs: []
      });

      await createOrGetChat(memberIds);

      expect(mockFirestoreCollection.where).toHaveBeenCalledWith(
        'members', '==', ['user1', 'user2', 'user3']
      );
      
      expect(mockFirestoreCollection.add).toHaveBeenCalledWith(
        expect.objectContaining({
          members: ['user1', 'user2', 'user3'],
          createdAt: 'server-timestamp',
          lastMessageTime: 'server-timestamp',
          lastMessage: ''
        })
      );
    });

    it('should return existing chat if found', async () => {
      const memberIds = ['user1', 'user2'];
      const existingChat = { id: 'existing-chat-id', data: () => ({ members: ['user1', 'user2'] }) };
      
      // Mock that chat exists
      mockFirestoreCollection.get.mockResolvedValueOnce({
        empty: false,
        docs: [existingChat]
      });

      const result = await createOrGetChat(memberIds);

      expect(result).toBe('existing-chat-id');
      expect(mockFirestoreCollection.add).not.toHaveBeenCalled();
    });
  });

  describe('markMessagesAsRead', () => {
    it('should mark messages as read by adding user to readBy array', async () => {
      const messageIds = ['msg1', 'msg2'];
      const userId = 'test-user';
      const chatId = 'test-chat';

      await markMessagesAsRead(chatId, messageIds, userId);

      messageIds.forEach(messageId => {
        expect(mockFirestore.doc).toHaveBeenCalledWith(
          `chats/${chatId}/messages/${messageId}`
        );
        expect(mockFirestoreDoc.update).toHaveBeenCalledWith({
          readBy: { arrayUnion: [userId] }
        });
      });
    });

    it('should handle empty message list gracefully', async () => {
      await markMessagesAsRead('test-chat', [], 'test-user');
      
      expect(mockFirestoreDoc.update).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle Firestore errors gracefully', async () => {
      mockFirestoreDoc.set.mockRejectedValueOnce(new Error('Firestore error'));
      
      await expect(createUserProfile('test-user', { email: 'test@test.com' }))
        .rejects.toThrow('Firestore error');
    });
  });
});
