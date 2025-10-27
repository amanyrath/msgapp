import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import OfflineCache from '../utils/offlineCache';

/**
 * Debug component for offline cache management
 * Shows cache statistics and allows cache management
 */
export default function OfflineCacheDebug({ visible, onClose }) {
  const [cacheStats, setCacheStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadCacheStats();
    }
  }, [visible]);

  const loadCacheStats = async () => {
    try {
      setLoading(true);
      const stats = await OfflineCache.getCacheStats();
      setCacheStats(stats);
    } catch (error) {
      console.error('Failed to load cache stats:', error);
      Alert.alert('Error', 'Failed to load cache statistics');
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllCache = () => {
    Alert.alert(
      'Clear All Cache',
      'Are you sure you want to clear all offline cached messages and translations? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await OfflineCache.clearAllCache();
              Alert.alert('Success', 'All offline cache cleared');
              loadCacheStats();
            } catch (error) {
              Alert.alert('Error', 'Failed to clear cache');
            }
          },
        },
      ]
    );
  };

  const handleClearChatCache = (chatId) => {
    Alert.alert(
      'Clear Chat Cache',
      `Clear cached messages and translations for this chat?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await OfflineCache.clearCacheForChat(chatId);
              Alert.alert('Success', 'Chat cache cleared');
              loadCacheStats();
            } catch (error) {
              Alert.alert('Error', 'Failed to clear chat cache');
            }
          },
        },
      ]
    );
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatChatId = (chatId) => {
    return chatId.length > 10 ? `${chatId.substring(0, 10)}...` : chatId;
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Offline Cache Debug</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {loading && <Text style={styles.loadingText}>Loading cache stats...</Text>}
          
          {cacheStats && (
            <>
              <View style={styles.statsSection}>
                <Text style={styles.sectionTitle}>Overall Statistics</Text>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Total Chats:</Text>
                  <Text style={styles.statValue}>{cacheStats.totalChats}</Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Total Messages:</Text>
                  <Text style={styles.statValue}>{cacheStats.totalMessages}</Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Total Translations:</Text>
                  <Text style={styles.statValue}>{cacheStats.totalTranslations}</Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Total Cache Size:</Text>
                  <Text style={styles.statValue}>{cacheStats.totalSize} KB</Text>
                </View>
              </View>

              <View style={styles.actionsSection}>
                <TouchableOpacity
                  style={styles.refreshButton}
                  onPress={loadCacheStats}
                >
                  <Text style={styles.refreshButtonText}>🔄 Refresh Stats</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.clearAllButton}
                  onPress={handleClearAllCache}
                >
                  <Text style={styles.clearAllButtonText}>🗑️ Clear All Cache</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.chatsSection}>
                <Text style={styles.sectionTitle}>Cached Chats</Text>
                {cacheStats.chats.map((chat, index) => (
                  <View key={chat.chatId} style={styles.chatItem}>
                    <View style={styles.chatInfo}>
                      <Text style={styles.chatId}>Chat: {formatChatId(chat.chatId)}</Text>
                      <Text style={styles.chatStats}>
                        {chat.messages} messages, {chat.translations} translations
                      </Text>
                      <Text style={styles.chatStats}>
                        Size: {chat.sizeKB} KB
                      </Text>
                      <Text style={styles.chatMeta}>
                        Cached: {formatDate(chat.cachedAt)}
                      </Text>
                      {chat.expiresAt && (
                        <Text style={styles.chatMeta}>
                          Expires: {formatDate(chat.expiresAt)}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.clearChatButton}
                      onPress={() => handleClearChatCache(chat.chatId)}
                    >
                      <Text style={styles.clearChatButtonText}>Clear</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </View>
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
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: '#CD853F',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 50,
  },
  statsSection: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statLabel: {
    fontSize: 16,
    color: '#666',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  actionsSection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  refreshButton: {
    flex: 1,
    backgroundColor: '#CD853F',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  clearAllButton: {
    flex: 1,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  clearAllButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  chatsSection: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
  },
  chatItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  chatInfo: {
    flex: 1,
  },
  chatId: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  chatStats: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  chatMeta: {
    fontSize: 12,
    color: '#999',
    marginBottom: 1,
  },
  clearChatButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 12,
  },
  clearChatButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

