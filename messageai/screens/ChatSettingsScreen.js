import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { updateChatMetadata, subscribeToUsers } from '../utils/firestore';

export default function ChatSettingsScreen({ route, navigation }) {
  const { user } = useAuth();
  const { chatId, chatData } = route.params;
  
  const [name, setName] = useState(chatData?.name || '');
  const [icon, setIcon] = useState(chatData?.icon || '👥');
  const [notes, setNotes] = useState(chatData?.notes || '');
  const [loading, setLoading] = useState(false);
  const [userProfiles, setUserProfiles] = useState([]);

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

  const handleSave = async () => {
    if (!chatId) {
      Alert.alert('Error', 'Invalid chat ID');
      return;
    }

    // Validate name
    if (!name.trim()) {
      Alert.alert('Error', 'Group name cannot be empty');
      return;
    }

    if (name.length > 50) {
      Alert.alert('Error', 'Group name must be 50 characters or less');
      return;
    }

    // Validate icon (should be emoji, max 2 characters)
    if (!icon.trim()) {
      Alert.alert('Error', 'Group icon cannot be empty');
      return;
    }

    if (icon.length > 2) {
      Alert.alert('Error', 'Icon should be an emoji (max 2 characters)');
      return;
    }

    // Validate notes length
    if (notes.length > 500) {
      Alert.alert('Error', 'Notes must be 500 characters or less');
      return;
    }

    try {
      setLoading(true);
      await updateChatMetadata(chatId, {
        name: name.trim(),
        icon: icon.trim(),
        notes: notes.trim(),
      });
      
      Alert.alert('Success', 'Group settings updated!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error updating chat settings:', error);
      Alert.alert('Error', 'Failed to update settings: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getMembersList = () => {
    if (!chatData?.members) return 'No members';
    
    const memberNames = chatData.members
      .filter(id => id !== user?.uid)
      .map(id => {
        const profile = userProfiles.find(p => p.id === id);
        return profile?.nickname || profile?.displayName || profile?.email || 'Unknown';
      })
      .join(', ');
    
    return memberNames || 'Just you';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Group Settings</Text>
        <TouchableOpacity 
          onPress={handleSave} 
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#007AFF" size="small" />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Group Name Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Group Name</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Enter group name..."
            value={name}
            onChangeText={setName}
            maxLength={50}
            returnKeyType="done"
          />
          <Text style={styles.characterCount}>{name.length}/50</Text>
        </View>

        {/* Group Icon Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Group Icon</Text>
          <View style={styles.iconInputContainer}>
            <View style={styles.iconPreview}>
              <Text style={styles.iconPreviewText}>{icon}</Text>
            </View>
            <TextInput
              style={styles.iconInput}
              placeholder="👥"
              value={icon}
              onChangeText={setIcon}
              maxLength={2}
              returnKeyType="done"
            />
          </View>
          <Text style={styles.helpText}>Use an emoji as your group icon</Text>
        </View>

        {/* Notes Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <TextInput
            style={[styles.textInput, styles.notesInput]}
            placeholder="Add notes about this group..."
            value={notes}
            onChangeText={setNotes}
            maxLength={500}
            multiline
            textAlignVertical="top"
            returnKeyType="done"
          />
          <Text style={styles.characterCount}>{notes.length}/500</Text>
          <Text style={styles.helpText}>Private notes only visible to you</Text>
        </View>

        {/* Members Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Members</Text>
          <View style={styles.membersContainer}>
            <Text style={styles.membersText}>{getMembersList()}</Text>
            <Text style={styles.membersCount}>
              {chatData?.members?.length || 0} {chatData?.members?.length === 1 ? 'member' : 'members'}
            </Text>
          </View>
        </View>
      </ScrollView>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
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
  saveButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E1E5E9',
    color: '#111',
  },
  notesInput: {
    height: 120,
    paddingTop: 12,
  },
  characterCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
  },
  iconInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconPreview: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPreviewText: {
    fontSize: 24,
  },
  iconInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 24,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#E1E5E9',
  },
  helpText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  membersContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E1E5E9',
  },
  membersText: {
    fontSize: 16,
    color: '#111',
    marginBottom: 4,
  },
  membersCount: {
    fontSize: 12,
    color: '#6B7280',
  },
});