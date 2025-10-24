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
import { useNetwork } from '../context/NetworkContext';
import { useTranslation } from '../context/LocalizationContext';
import { subscribeToUserChats, subscribeToUsers, deleteChat } from '../utils/firestore';
import { subscribeToMultiplePresence, isUserOnline } from '../utils/presence';
import subscriptionManager from '../utils/subscriptionManager';

export default function ChatListScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const { isOffline } = useNetwork();
  const t = useTranslation();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userProfiles, setUserProfiles] = useState([]);
  const [presenceData, setPresenceData] = useState({});
  const [deletingChats, setDeletingChats] = useState(new Set());

  // OPTIMIZED: Subscribe to user chats with caching and deduplication
  useEffect(() => {
    if (!user?.uid) {
      setChats([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    console.log('📱 ChatListScreen: Subscribing to user chats');

    const unsubscribe = subscriptionManager.subscribe(
      `user-chats-${user.uid}`,
      (callback) => subscribeToUserChats(user.uid, callback),
      (chatList) => {
        console.log('💬 Received chat list:', chatList.length, 'chats');
        setChats(chatList);
        setLoading(false);
      },
      {
        cache: true,
        shared: true,
        priority: 'high' // High priority for chat list
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  // OPTIMIZED: Subscribe to user profiles with global caching (shared by all components)
  useEffect(() => {
    console.log('👥 ChatListScreen: Subscribing to user profiles');

    const unsubscribe = subscriptionManager.subscribe(
      'user-profiles',
      (callback) => subscribeToUsers(callback),
      (profiles) => {
        console.log('👤 Received user profiles:', profiles.length, 'users');
        setUserProfiles(profiles);
      },
      {
        cache: true,
        shared: true, // This will be shared by ChatScreen and other components
        priority: 'normal'
      }
    );

    return () => unsubscribe();
  }, []);

  // OPTIMIZED: Subscribe to presence for chat list users with smart deduplication
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

    // Create a unique key for this set of users
    const presenceKey = `presence-chatlist-${userIdsArray.sort().join(',')}`;
    
    console.log('🟢 ChatListScreen: Subscribing to presence for', userIdsArray.length, 'users');

    const unsubscribe = subscriptionManager.subscribe(
      presenceKey,
      (callback) => subscribeToMultiplePresence(userIdsArray, callback),
      (data) => {
        console.log('📶 Received presence data for', Object.keys(data).length, 'users');
        setPresenceData(data);
      },
      {
        cache: true,
        shared: false, // Chat list presence is specific to this user's chats
        priority: 'normal'
      }
    );

    return () => unsubscribe();
  }, [chats, user?.uid]);

  const handleSignOut = async () => {
    await signOut();
  };

  const handleNewChat = () => {
    navigation.navigate('NewChat');
  };

  const handleProfile = () => {
    navigation.navigate('Profile');
  };

  const handleDeleteChat = (chat) => {
    const chatTitle = formatMemberNames(chat);
    
    Alert.alert(
      t('deleteChat'),
      t('deleteChatConfirm', { chatTitle }),
      [
        {
          text: t('cancel'),
          style: 'cancel',
        },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              // Add chat to deleting set to show loading state
              setDeletingChats(prev => new Set([...prev, chat.id]));
              
              // Delete the chat
              await deleteChat(chat.id, user.uid);
              
              console.log('Chat deleted successfully:', chat.id);
              
              // Remove from deleting set
              setDeletingChats(prev => {
                const newSet = new Set(prev);
                newSet.delete(chat.id);
                return newSet;
              });
              
            } catch (error) {
              console.error('Error deleting chat:', error);
              
              // Remove from deleting set
              setDeletingChats(prev => {
                const newSet = new Set(prev);
                newSet.delete(chat.id);
                return newSet;
              });
              
              // Show error alert
              Alert.alert(
                t('error'),
                t('failedToDeleteChat', { error: error.message }),
                [{ text: 'OK' }]
              );
            }
          },
        },
      ]
    );
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
    const currentUserId = user?.uid;
    
    // More robust filtering - ensure we're comparing strings and handle null/undefined
    const otherMembers = members.filter((id) => {
      const memberId = String(id || '').trim();
      const currentId = String(currentUserId || '').trim();
      return memberId && currentId && memberId !== currentId;
    });

    if (otherMembers.length === 0) {
      return 'Personal Notes';
    }

    // Get names from user profiles (real-time data) - prioritize nickname
    const names = otherMembers.map((id) => {
      const profile = userProfileMap[id];
      if (profile?.nickname) return profile.nickname;
      if (profile?.displayName) return profile.displayName;
      if (profile?.email) return profile.email;
      return 'Unknown';
    });

    // For 1-on-1 chats (2 members), always use the other user's name
    if (members.length === 2) {
      return names[0] || 'Chat';
    }

    // For group chats (3+ members), use custom name if available
    if (chat.name) {
      return chat.name;
    }

    // Fallback to joined names for groups
    return names.join(' & ');
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

  const getChatIcon = (chat) => {
    const members = chat.members || [];
    const otherMembers = members.filter((id) => id !== user?.uid);

    if (otherMembers.length === 0) {
      return '📝'; // Personal notes
    }

    // For 1-on-1 chats (2 members), always show the other user's icon
    if (members.length === 2) {
      const profile = userProfileMap[otherMembers[0]];
      return profile?.icon || '👤';
    }

    // For group chats (3+ members), use custom icon if set
    if (chat.icon) {
      return chat.icon;
    }

    // Default group icon
    return '👥';
  };

  const renderChatItem = ({ item }) => {
    const chatTitle = formatMemberNames(item);
    const chatIcon = getChatIcon(item);
    const isDeleting = deletingChats.has(item.id);
    
    // Check if any other members are online
    const otherMembers = item.members?.filter((id) => id !== user?.uid) || [];
    const anyOnline = otherMembers.some((memberId) => 
      isUserOnline(presenceData[memberId])
    );

    // Calculate unread count (placeholder - would need to subscribe to messages for accurate count)
    const unreadCount = item.unreadCount || 0;

    return (
      <TouchableOpacity
        style={[styles.chatItem, isDeleting && styles.chatItemDeleting]}
        onPress={() => !isDeleting && handleOpenChat(item)}
        onLongPress={() => !isDeleting && handleDeleteChat(item)}
        disabled={isDeleting}
      >
        <View style={styles.chatRow}>
          <View style={styles.chatAvatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {chatIcon}
              </Text>
            </View>
            {anyOnline && <View style={styles.onlineIndicator} />}
          </View>
          <View style={styles.chatTextContainer}>
            <Text style={styles.chatTitle}>{chatTitle}</Text>
            <Text style={styles.chatSnippet} numberOfLines={1}>
              {item.lastMessage || t('noMessagesYet')}
            </Text>
          </View>
          <View style={styles.chatMetaContainer}>
            {isDeleting ? (
              <ActivityIndicator size="small" color="#FF3B30" />
            ) : (
              <>
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
              </>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('chats')}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleProfile} style={styles.profileButton}>
            <Text style={styles.profileText}>⚙️</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleNewChat} style={styles.newChatButton}>
            <Text style={styles.newChatText}>➕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>{t('youreOffline')}</Text>
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
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{t('noChatsYet')}</Text>
              <Text style={styles.emptySubtext}>
                {t('startConversation')}
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
    gap: 16,
  },
  profileButton: {
    padding: 4,
  },
  profileText: {
    fontSize: 24,
  },
  newChatButton: {
    padding: 4,
  },
  newChatText: {
    fontSize: 24,
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
  chatItemDeleting: {
    opacity: 0.5,
    backgroundColor: '#FFEEEE',
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
    fontSize: 24,
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
