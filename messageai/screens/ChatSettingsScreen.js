import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';

export default function ChatSettingsScreen({ route, navigation }) {
  const { chatId, chatData } = route.params;
  
  const [name, setName] = useState(chatData?.name || '');
  const [icon, setIcon] = useState(chatData?.icon || '💬');
  const [notes, setNotes] = useState(chatData?.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Chat name cannot be empty');
      return;
    }

    try {
      setSaving(true);
      const chatRef = doc(db, 'chats', chatId);
      await updateDoc(chatRef, {
        name: name.trim(),
        icon: icon.trim() || '💬',
        notes: notes.trim(),
      });
      
      Alert.alert('Success', 'Chat settings updated!');
      navigation.goBack();
    } catch (error) {
      console.error('Error updating chat settings:', error);
      Alert.alert('Error', 'Failed to update chat settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Chat Settings</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={styles.saveButton}
          >
            <Text style={[styles.saveText, saving && styles.saveTextDisabled]}>
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Icon Section */}
          <View style={styles.section}>
            <Text style={styles.label}>Chat Icon</Text>
            <View style={styles.iconContainer}>
              <View style={styles.iconDisplay}>
                <Text style={styles.iconText}>{icon || '💬'}</Text>
              </View>
              <TextInput
                style={styles.iconInput}
                value={icon}
                onChangeText={setIcon}
                placeholder="💬"
                maxLength={2}
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <Text style={styles.hint}>Enter any emoji (e.g., 💼 🎮 🍕)</Text>
          </View>

          {/* Name Section */}
          <View style={styles.section}>
            <Text style={styles.label}>Chat Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter chat name"
              placeholderTextColor="#9CA3AF"
              maxLength={50}
            />
            <Text style={styles.charCount}>{name.length}/50</Text>
          </View>

          {/* Notes Section */}
          <View style={styles.section}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add notes about this chat..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={500}
            />
            <Text style={styles.charCount}>{notes.length}/500</Text>
            <Text style={styles.hint}>
              Private notes only you can see (e.g., project details, reminders)
            </Text>
          </View>

          {/* Info Section */}
          <View style={styles.infoSection}>
            <Text style={styles.infoText}>
              💡 These settings are saved for everyone in the chat
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardAvoid: {
    flex: 1,
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
  saveButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  saveText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '700',
  },
  saveTextDisabled: {
    color: '#9CA3AF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111',
    backgroundColor: '#F9FAFB',
  },
  notesInput: {
    minHeight: 120,
    paddingTop: 12,
  },
  iconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconDisplay: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  iconText: {
    fontSize: 32,
  },
  iconInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 24,
    color: '#111',
    backgroundColor: '#F9FAFB',
    textAlign: 'center',
  },
  hint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 6,
  },
  charCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
  },
  infoSection: {
    marginTop: 32,
    marginBottom: 32,
    padding: 16,
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  infoText: {
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
});

