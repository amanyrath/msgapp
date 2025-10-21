import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import {
  createOrGetChat,
  sendMessage,
  subscribeToMessages,
  subscribeToUsers,
} from '../utils/firestore';

export default function ChatScreen({ route, navigation }) {
  const { user } = useAuth();
  const { isOffline } = useNetwork();
  const [chatId, setChatId] = useState(route?.params?.chatId ?? null);
  const [chatMembers, setChatMembers] = useState(route?.params?.members ?? []);
  const [chatMetadata, setChatMetadata] = useState(route?.params?.metadata ?? {});
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(!route?.params?.chatId);
  const flatListRef = useRef(null);
  const [userProfiles, setUserProfiles] = useState([]);

  // Initialize chat based on navigation params or fallback to personal chat
  useEffect(() => {
    if (!user) return;

    if (route?.params?.chatId) {
      setChatId(route.params.chatId);
      setChatMembers(route.params?.members ?? []);
      if (route?.params?.metadata) {
        setChatMetadata(route.params.metadata);
      }
      setLoading(false);
      return;
    }

    initializeChat();
  }, [route?.params?.chatId, route?.params?.members, user]);

  useEffect(() => {
    if (route?.params?.metadata) {
      setChatMetadata(route.params.metadata);
    }
  }, [route?.params?.metadata]);

  // Subscribe to messages when chatId is available
  useEffect(() => {
    if (!chatId) return;

    console.log('Subscribing to messages for chat:', chatId);
    const unsubscribe = subscribeToMessages(chatId, (msgs) => {
      console.log('Received messages:', msgs.length);
      setMessages(msgs);
      // Scroll to bottom when new messages arrive
      setLoading(false);
      setTimeout(() => scrollToBottom(), 100);
    });

    return () => unsubscribe();
  }, [chatId]);

  useEffect(() => {
    const unsubscribe = subscribeToUsers((profiles) => {
      setUserProfiles(profiles);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  };

  const initializeChat = async () => {
    if (!user) return;

    try {
      setLoading(true);
      // Create a test chat with just the current user
      // In PR #4, we'll allow selecting other users
      const testChatId = await createOrGetChat(
        [user.uid],
        {
          memberDisplayNames: [user.email],
          memberEmails: [user.email],
        }
      );
      setChatId(testChatId);
      setChatMembers([user.uid]);
      setChatMetadata({
        memberDisplayNames: [user.email],
        memberEmails: [user.email],
      });
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

    const messageText = newMessage.trim();
    const tempId = `temp-${Date.now()}`;

    // Optimistic UI update - add message immediately
    const optimisticMessage = {
      id: tempId,
      text: messageText,
      senderId: user.uid,
      senderEmail: user.email,
      timestamp: { toDate: () => new Date() }, // Temporary timestamp
      sending: true, // Flag to show sending state
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setNewMessage('');
    scrollToBottom();

    try {
      await sendMessage(chatId, user.uid, user.email, messageText);
      // Message will be updated by real-time listener
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message: ' + error.message);
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
    }
  };

  const canGoBack = navigation?.canGoBack?.() ?? false;
  const userProfileMap = useMemo(() => {
    const map = {};
    userProfiles.forEach((profile) => {
      map[profile.id] = profile;
    });
    return map;
  }, [userProfiles]);

  const metadataNameMap = useMemo(() => {
    const map = {};
    const metaNames = chatMetadata?.memberDisplayNames;
    if (Array.isArray(metaNames) && chatMembers?.length) {
      chatMembers.forEach((memberId, index) => {
        const name = metaNames[index];
        if (name) {
          map[memberId] = name;
        }
      });
    }
    return map;
  }, [chatMetadata?.memberDisplayNames, chatMembers]);

  const getDisplayName = (memberId, fallbackEmail) => {
    const metaName = metadataNameMap[memberId];
    if (metaName) return metaName;
    const profile = userProfileMap[memberId];
    if (profile?.displayName) return profile.displayName;
    if (profile?.email) return profile.email;
    if (fallbackEmail) return fallbackEmail;
    return memberId;
  };

  const chatTitle = useMemo(() => {
    if (!chatMembers?.length) return 'Chat';
    const others = chatMembers.filter((id) => id !== user?.uid);
    if (others.length === 0) return 'Personal Notes';
    const names = others.map((id) => getDisplayName(id));
    return names.join(', ');
  }, [chatMembers, metadataNameMap, userProfileMap, user?.uid]);

  const formatTime = (timestamp) => {
    if (!timestamp?.toDate) return '';
    const date = timestamp.toDate();
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const renderMessage = ({ item }) => {
    const isMyMessage = item.senderId === user.uid;
    const senderName = getDisplayName(item.senderId, item.senderEmail);

    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessageContainer : styles.theirMessageContainer,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isMyMessage ? styles.myMessageBubble : styles.theirMessageBubble,
            item.sending && styles.sendingMessage,
          ]}
        >
          {!isMyMessage && (
            <Text style={styles.senderName}>{senderName}</Text>
          )}
          <Text
            style={[
              styles.messageText,
              isMyMessage ? styles.myMessageText : styles.theirMessageText,
            ]}
          >
            {item.text}
          </Text>
          <Text
            style={[
              styles.timeText,
              isMyMessage ? styles.myTimeText : styles.theirTimeText,
            ]}
          >
            {formatTime(item.timestamp)} {item.sending && '●'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerSide}>
          {canGoBack && (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.headerTitleWrapper}>
          <Text style={styles.title}>{chatTitle}</Text>
        </View>
        <View style={styles.headerSide} />
      </View>

      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>📵 Offline - Messages will send when reconnected</Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        {loading ? (
          <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
        ) : (
          <>
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messagesList}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  No messages yet. Start the conversation! 💬
                </Text>
              }
              onContentSizeChange={() => scrollToBottom()}
            />

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Type a message..."
                value={newMessage}
                onChangeText={setNewMessage}
                multiline
                maxLength={1000}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  !newMessage.trim() && styles.sendButtonDisabled,
                ]}
                onPress={handleSendMessage}
                disabled={!newMessage.trim()}
              >
                <Text style={styles.sendButtonText}>Send</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  offlineBanner: {
    backgroundColor: '#FFA500',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  offlineText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  headerSide: {
    width: 72,
  },
  headerTitleWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 100,
  },
  messageContainer: {
    marginBottom: 12,
    flexDirection: 'row',
  },
  myMessageContainer: {
    justifyContent: 'flex-end',
  },
  theirMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  myMessageBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  theirMessageBubble: {
    backgroundColor: '#E5E5EA',
    borderBottomLeftRadius: 4,
  },
  sendingMessage: {
    opacity: 0.7,
  },
  senderName: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#fff',
  },
  theirMessageText: {
    color: '#000',
  },
  timeText: {
    fontSize: 11,
    marginTop: 4,
  },
  myTimeText: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  theirTimeText: {
    color: '#666',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    marginRight: 8,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#B0B0B0',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
