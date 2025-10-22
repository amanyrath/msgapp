import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet
} from 'react-native';

/**
 * TranslationMessage - Component for displaying AI translation messages
 * Appears below original messages as threaded responses
 */
export default function TranslationMessage({ message, onFeedback }) {
  const [feedbackGiven, setFeedbackGiven] = useState(false);

  const handleFeedback = (helpful) => {
    onFeedback?.(message.id, helpful);
    setFeedbackGiven(true);
  };

  const getOperationIcon = (operation) => {
    switch (operation) {
      case 'translation': return '🌐';
      case 'explanation': return '🌍';
      case 'suggestion': return '💡';
      case 'analysis': return '📊';
      default: return '🤖';
    }
  };

  const operation = message.aiMetadata?.operation || 'response';
  const confidence = message.aiMetadata?.confidence;
  const culturalNotes = message.aiMetadata?.culturalNotes || [];

  return (
    <View style={styles.container}>
      <View style={styles.aiMessage}>
        <View style={styles.header}>
          <Text style={styles.headerText}>
            {getOperationIcon(operation)} AI Assistant
          </Text>
          {confidence && (
            <Text style={styles.confidence}>
              {Math.round(confidence * 100)}% confident
            </Text>
          )}
        </View>
        
        <Text style={styles.messageText}>{message.text}</Text>
        
        {culturalNotes.length > 0 && (
          <View style={styles.notesContainer}>
            <Text style={styles.notesTitle}>Cultural Notes:</Text>
            {culturalNotes.slice(0, 2).map((note, index) => (
              <Text key={index} style={styles.noteText}>
                • {note}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.timestamp}>
            {new Date(message.timestamp?.toDate()).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
          
          {!feedbackGiven && (
            <View style={styles.feedbackContainer}>
              <TouchableOpacity 
                style={styles.feedbackButton}
                onPress={() => handleFeedback(true)}
              >
                <Text style={styles.feedbackText}>👍</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.feedbackButton}
                onPress={() => handleFeedback(false)}
              >
                <Text style={styles.feedbackText}>👎</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
    marginBottom: 8,
    marginLeft: 20, // Indent to show threading
    marginRight: 60, // More space on right to differentiate from user messages
  },
  aiMessage: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e1e5e9',
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },
  confidence: {
    fontSize: 10,
    color: '#666',
    backgroundColor: '#e1e5e9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#333',
    marginBottom: 8,
  },
  notesContainer: {
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#ffc107',
  },
  notesTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 4,
  },
  noteText: {
    fontSize: 11,
    color: '#856404',
    lineHeight: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timestamp: {
    fontSize: 10,
    color: '#999',
  },
  feedbackContainer: {
    flexDirection: 'row',
  },
  feedbackButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 4,
  },
  feedbackText: {
    fontSize: 14,
  },
});
