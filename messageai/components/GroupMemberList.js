import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  SafeAreaView,
} from 'react-native';
import { useTranslation } from '../context/LocalizationContext';
import { getPresenceText, isUserOnline } from '../utils/presence';

export default function GroupMemberList({ 
  visible, 
  onClose, 
  chatMembers = [], 
  userProfiles = [], 
  presenceData = {}, 
  currentUserId,
  chatTitle 
}) {
  const t = useTranslation();

  // Create a map of user profiles for quick lookup
  const userProfileMap = useMemo(() => {
    const map = {};
    userProfiles.forEach((profile) => {
      map[profile.id] = profile;
    });
    return map;
  }, [userProfiles]);

  // Get member data with presence info
  const memberData = useMemo(() => {
    return chatMembers.map((memberId) => {
      const profile = userProfileMap[memberId];
      const presence = presenceData[memberId];
      const isCurrentUser = memberId === currentUserId;
      const isOnline = isUserOnline(presence);
      
      return {
        id: memberId,
        name: profile?.nickname || profile?.displayName || profile?.email || 'Unknown User',
        icon: profile?.icon || '👤',
        email: profile?.email,
        isCurrentUser,
        isOnline,
        presenceText: getPresenceText(presence, t),
        sortKey: isCurrentUser ? '0' : isOnline ? '1' : '2' + (profile?.nickname || profile?.displayName || profile?.email || 'zz')
      };
    }).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [chatMembers, userProfileMap, presenceData, currentUserId, t]);

  const renderMemberItem = ({ item }) => {
    return (
      <View style={styles.memberItem}>
        <View style={styles.memberAvatar}>
          <Text style={styles.memberIcon}>{item.icon}</Text>
          {item.isOnline && <View style={styles.onlineIndicator} />}
        </View>
        
        <View style={styles.memberInfo}>
          <View style={styles.memberNameRow}>
            <Text style={styles.memberName}>
              {item.name}
              {item.isCurrentUser && (
                <Text style={styles.youLabel}> ({t('you') || 'You'})</Text>
              )}
            </Text>
          </View>
          
          <Text style={[
            styles.memberStatus,
            item.isOnline ? styles.onlineStatus : styles.offlineStatus
          ]}>
            {item.isOnline ? (t('activeNow') || 'Active now') : item.presenceText}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>{t('close') || 'Close'}</Text>
          </TouchableOpacity>
          
          <Text style={styles.title}>
            {t('groupMembers') || 'Group Members'}
          </Text>
          
          <View style={styles.headerRight}>
            <Text style={styles.memberCount}>
              {memberData.length}
            </Text>
          </View>
        </View>

        <View style={styles.chatTitleContainer}>
          <Text style={styles.chatTitle}>{chatTitle}</Text>
          <Text style={styles.onlineCount}>
            {memberData.filter(m => m.isOnline).length} {t('online') || 'online'}
          </Text>
        </View>

        <FlatList
          data={memberData}
          renderItem={renderMemberItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.membersList}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    </Modal>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    minWidth: 60,
  },
  closeButtonText: {
    color: '#CD853F',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  headerRight: {
    minWidth: 60,
    alignItems: 'flex-end',
  },
  memberCount: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  chatTitleContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    alignItems: 'center',
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
  },
  onlineCount: {
    fontSize: 14,
    color: '#34C759',
    marginTop: 2,
    textAlign: 'center',
  },
  membersList: {
    padding: 16,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  memberIcon: {
    fontSize: 24,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#34C759',
    borderWidth: 2,
    borderColor: '#fff',
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  youLabel: {
    fontSize: 14,
    fontWeight: 'normal',
    color: '#666',
  },
  memberStatus: {
    fontSize: 14,
  },
  onlineStatus: {
    color: '#34C759',
    fontWeight: '500',
  },
  offlineStatus: {
    color: '#666',
  },
});

