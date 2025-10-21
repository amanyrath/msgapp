import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { createOrGetChat, sendMessage, subscribeToMessages } from '../utils/firestore';

export default function ChatScreen() {
  const { user, signOut } = useAuth();
  const [chatId, setChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Initialize a test chat when component mounts
  useEffect(() => {
    initializeChat();
  }, [user]);

  // Subscribe to messages when chatId is available
  useEffect(() => {
    if (!chatId) return;

    console.log('Subscribing to messages for chat:', chatId);
    const unsubscribe = subscribeToMessages(chatId, (msgs) => {
      console.log('Received messages:', msgs.length);
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [chatId]);

  const initializeChat = async () => {
    if (!user) return;

    try {
      setLoading(true);
      // Create a test chat with just the current user
      // In PR #4, we'll allow selecting other users
      const testChatId = await createOrGetChat([user.uid]);
      setChatId(testChatId);
      console.log('Chat initialized:', testChatId);
    } catch (error) {
      console.error('Error initializing chat:', error);
      Alert.alert('Error', 'Failed to initialize chat: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !chatId) return;

    try {
      await sendMessage(chatId, user.uid, user.email, newMessage.trim());
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message: ' + error.message);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>MessageAI</Text>
        <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.emailText}>Logged in as: {user?.email}</Text>
        {chatId && (
          <Text style={styles.chatIdText}>Chat ID: {chatId.substring(0, 8)}...</Text>
        )}

        {loading ? (
          <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
        ) : (
          <>
            <ScrollView style={styles.messagesContainer}>
              {messages.length === 0 ? (
                <Text style={styles.emptyText}>
                  No messages yet. Send a test message below!
                </Text>
              ) : (
                messages.map((message) => (
                  <View key={message.id} style={styles.messageItem}>
                    <Text style={styles.senderEmail}>{message.senderEmail}</Text>
                    <Text style={styles.messageText}>{message.text}</Text>
                    <Text style={styles.messageTime}>
                      {message.timestamp?.toDate?.()?.toLocaleTimeString() || 'Sending...'}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Type a test message..."
                value={newMessage}
                onChangeText={setNewMessage}
                multiline
              />
              <TouchableOpacity
                style={styles.sendButton}
                onPress={handleSendMessage}
                disabled={!newMessage.trim()}
              >
                <Text style={styles.sendButtonText}>Send</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <Text style={styles.infoText}>
          PR #3: Testing Firestore Schema{'\n'}
          Full chat UI coming in PR #4
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  signOutButton: {
    padding: 10,
  },
  signOutText: {
    color: '#007AFF',
    fontSize: 16,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  emailText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    textAlign: 'center',
  },
  chatIdText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 15,
    textAlign: 'center',
  },
  loader: {
    marginTop: 50,
  },
  messagesContainer: {
    flex: 1,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 50,
  },
  messageItem: {
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  senderEmail: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  messageTime: {
    fontSize: 11,
    color: '#999',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 15,
  },
});

