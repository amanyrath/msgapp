import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import {
  subscribeToUsers,
  createOrGetChat,
} from '../utils/firestore';

export default function NewChatScreen({ navigation }) {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToUsers((userList) => {
      setUsers(userList);
      setLoadingUsers(false);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const userMap = useMemo(() => {
    const map = {};
    users.forEach((profile) => {
      map[profile.id] = profile;
    });
    return map;
  }, [users]);

  const availableUsers = useMemo(() => {
    return users.filter((profile) => profile.id !== user?.uid);
  }, [users, user?.uid]);

  const toggleSelect = (userId) => {
    setSelectedIds((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId);
      }
      return [...prev, userId];
    });
  };

  const handleCreateChat = async () => {
    if (!selectedIds.length) {
      Alert.alert('Select users', 'Please choose at least one person to start a chat.');
      return;
    }

    if (!user?.uid) {
      Alert.alert('Error', 'You must be signed in to start a chat.');
      return;
    }

    const memberIds = Array.from(new Set([...selectedIds, user.uid]));

    const memberDisplayNames = memberIds.map((id) => {
      const profile = userMap[id];
      if (profile?.displayName) return profile.displayName;
      if (profile?.email) return profile.email;
      if (id === user.uid) return user.email || 'You';
      return id;
    });

    const memberEmails = memberIds.map((id) => {
      const profile = userMap[id];
      if (profile?.email) return profile.email;
      if (id === user.uid) return user.email || '';
      return '';
    });

    const metadata = {
      memberDisplayNames,
      memberEmails,
    };

    try {
      setCreating(true);
      const chatId = await createOrGetChat(memberIds, metadata);
      navigation.replace('Chat', { chatId, members: memberIds, metadata });
    } catch (error) {
      console.error('Error creating chat:', error);
      Alert.alert('Error', 'Failed to create chat: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  const renderUserItem = ({ item }) => {
    const isSelected = selectedIds.includes(item.id);
    const displayName = item.displayName || item.email || 'Unknown user';

    return (
      <TouchableOpacity
        style={[styles.userRow, isSelected && styles.userRowSelected]}
        onPress={() => toggleSelect(item.id)}
      >
        <View>
          <Text style={styles.userName}>{displayName}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
        </View>
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <Text style={styles.checkboxText}>✓</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>New Chat</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loadingUsers ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={availableUsers}
          keyExtractor={(item) => item.id}
          renderItem={renderUserItem}
          contentContainerStyle={
            availableUsers.length === 0 ? styles.emptyContainer : undefined
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No other users yet</Text>
              <Text style={styles.emptySubtitle}>
                Invite teammates so you can start a conversation.
              </Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={[
          styles.createButton,
          (!selectedIds.length || creating) && styles.createButtonDisabled,
        ]}
        onPress={handleCreateChat}
        disabled={!selectedIds.length || creating}
      >
        {creating ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.createButtonText}>
            Start Chat{selectedIds.length > 1 ? ' (' + (selectedIds.length + 1) + ')' : ''}
          </Text>
        )}
      </TouchableOpacity>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F1F1',
  },
  cancelButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  cancelText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
  },
  headerSpacer: {
    width: 60,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  userRowSelected: {
    backgroundColor: '#F0F8FF',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  userEmail: {
    fontSize: 14,
    color: '#6B7280',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  checkboxText: {
    color: '#fff',
    fontWeight: '700',
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyState: {
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  createButton: {
    margin: 16,
    paddingVertical: 14,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  createButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
