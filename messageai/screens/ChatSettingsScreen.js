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
import { useTranslation } from '../context/LocalizationContext';
import { updateChatMetadata, subscribeToUsers } from '../utils/firestore';

export default function ChatSettingsScreen({ route, navigation }) {
  const { user } = useAuth();
  const t = useTranslation();
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
      Alert.alert(t('error'), t('invalidChatId') || 'Invalid chat ID');
      return;
    }

    // Validate name
    if (!name.trim()) {
      Alert.alert(t('error'), t('groupNameCannotBeEmpty') || 'Group name cannot be empty');
      return;
    }

    if (name.length > 50) {
      Alert.alert(t('error'), t('groupNameTooLong') || 'Group name must be 50 characters or less');
      return;
    }

    // Validate icon (should be emoji, max 2 characters)
    if (!icon.trim()) {
      Alert.alert(t('error'), t('groupIconCannotBeEmpty') || 'Group icon cannot be empty');
      return;
    }

    if (icon.length > 2) {
      Alert.alert(t('error'), t('iconShouldBeEmoji') || 'Icon should be an emoji (max 2 characters)');
      return;
    }

    // Validate notes length
    if (notes.length > 500) {
      Alert.alert(t('error'), t('notesTooLong') || 'Notes must be 500 characters or less');
      return;
    }

    try {
      setLoading(true);
      await updateChatMetadata(chatId, {
        name: name.trim(),
        icon: icon.trim(),
        notes: notes.trim(),
      });
      
      Alert.alert(t('success') || 'Success', t('groupSettingsUpdated') || 'Group settings updated!', [
        { text: t('done'), onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error updating chat settings:', error);
      Alert.alert(t('error'), t('failedToUpdateSettings', { error: error.message }) || `Failed to update settings: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getMembersList = () => {
    if (!chatData?.members) return t('noMembers') || 'No members';
    
    const memberNames = chatData.members
      .filter(id => id !== user?.uid)
      .map(id => {
        const profile = userProfiles.find(p => p.id === id);
        return profile?.nickname || profile?.displayName || profile?.email || t('unknown');
      })
      .join(', ');
    
    return memberNames || t('justYou') || 'Just you';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelButton}>
          <Text style={styles.cancelText}>{t('cancel')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('groupSettings') || 'Group Settings'}</Text>
        <TouchableOpacity 
          onPress={handleSave} 
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#CD853F" size="small" />
          ) : (
            <Text style={styles.saveText}>{t('save')}</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Group Name Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('groupName') || 'Group Name'}</Text>
          <TextInput
            style={styles.textInput}
            placeholder={t('enterGroupName') || 'Enter group name...'}
            value={name}
            onChangeText={setName}
            maxLength={50}
            returnKeyType="done"
          />
          <Text style={styles.characterCount}>{name.length}/50</Text>
        </View>

        {/* Group Icon Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('groupIcon') || 'Group Icon'}</Text>
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
    color: '#CD853F',
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
    color: '#CD853F',
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
    backgroundColor: '#CD853F',
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