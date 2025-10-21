import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import { subscribeToUserChats, subscribeToUsers } from '../utils/firestore';
import { subscribeToMultiplePresence, isUserOnline } from '../utils/presence';

export default function ChatListScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const { isOffline } = useNetwork();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userProfiles, setUserProfiles] = useState([]);
  const [presenceData, setPresenceData] = useState({});

  useEffect(() => {
    if (!user?.uid) {
      setChats([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToUserChats(user.uid, (chatList) => {
      setChats(chatList);
      setLoading(false);
      setRefreshing(false);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user?.uid]);

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

  // Subscribe to presence for all users in chats
  useEffect(() => {
    if (chats.length === 0) return;

    // Get all unique user IDs from all chats
    const allUserIds = new Set();
    chats.forEach((chat) => {
      chat.members?.forEach((memberId) => {
        if (memberId !== user?.uid) {
          allUserIds.add(memberId);
        }
      });
    });

    const userIdsArray = Array.from(allUserIds);
    
    if (userIdsArray.length === 0) return;

    const unsubscribe = subscribeToMultiplePresence(userIdsArray, (data) => {
      setPresenceData(data);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [chats, user?.uid]);

  const handleRefresh = () => {
    setRefreshing(true);
    // Data updates automatically via subscription; just end the indicator
    setTimeout(() => setRefreshing(false), 400);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const handleNewChat = () => {
    navigation.navigate('NewChat');
  };

  const handleOpenChat = (chat) => {
    navigation.navigate('Chat', {
      chatId: chat.id,
      members: chat.members,
      metadata: {
        memberDisplayNames: chat.memberDisplayNames || [],
        memberEmails: chat.memberEmails || [],
      },
    });
  };

  const userProfileMap = useMemo(() => {
    const map = {};
    userProfiles.forEach((profile) => {
      map[profile.id] = profile;
    });
    return map;
  }, [userProfiles]);

  const formatMemberNames = (chat) => {
    const members = chat.members || [];
    const otherMembers = members.filter((id) => id !== user?.uid);

    if (otherMembers.length === 0) {
      return 'Personal Notes';
    }

    // Get names from user profiles (real-time data)
    const names = otherMembers.map((id) => {
      const profile = userProfileMap[id];
      if (profile?.displayName) return profile.displayName;
      if (profile?.email) return profile.email;
      return 'Unknown';
    });

    return names.join(', ');
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp?.toDate) return '';
    const date = timestamp.toDate();
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const renderChatItem = ({ item }) => {
    const chatTitle = formatMemberNames(item);
    
    // Check if any other members are online
    const otherMembers = item.members?.filter((id) => id !== user?.uid) || [];
    const anyOnline = otherMembers.some((memberId) => 
      isUserOnline(presenceData[memberId])
    );

    // Calculate unread count (placeholder - would need to subscribe to messages for accurate count)
    const unreadCount = item.unreadCount || 0;

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => handleOpenChat(item)}
      >
        <View style={styles.chatRow}>
          <View style={styles.chatAvatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {chatTitle[0]?.toUpperCase() || '?'}
              </Text>
            </View>
            {anyOnline && <View style={styles.onlineIndicator} />}
          </View>
          <View style={styles.chatTextContainer}>
            <Text style={styles.chatTitle}>{chatTitle}</Text>
            <Text style={styles.chatSnippet} numberOfLines={1}>
              {item.lastMessage || 'No messages yet'}
            </Text>
          </View>
          <View style={styles.chatMetaContainer}>
            <Text style={styles.chatTime}>
              {formatTimestamp(item.lastMessageTime)}
            </Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Chats</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleNewChat} style={styles.newChatButton}>
            <Text style={styles.newChatText}>New Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSignOut}>
            <Text style={styles.signOut}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>📵 You're offline</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          renderItem={renderChatItem}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No chats yet.</Text>
              <Text style={styles.emptySubtext}>
                Start a conversation to see it appear here.
              </Text>
            </View>
          }
          contentContainerStyle={
            chats.length === 0 ? styles.emptyContainer : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F1F1',
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
    fontSize: 24,
    fontWeight: '700',
    color: '#111',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  newChatButton: {
    marginRight: 16,
  },
  newChatText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  signOut: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatItem: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  chatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#34C759',
    borderWidth: 2,
    borderColor: '#fff',
  },
  chatTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
  },
  chatSnippet: {
    fontSize: 14,
    color: '#6B7280',
  },
  chatMetaContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  chatTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  unreadBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
