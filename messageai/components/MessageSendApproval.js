import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
} from 'react-native';

/**
 * MessageSendApproval - Approval dialog for AI message sending
 * Shows confirmation UI with Yes/No buttons
 */
export default function MessageSendApproval({
  visible,
  messageContent,
  confirmationText,
  onApprove,
  onReject,
  onClose,
  userLanguage = 'English'
}) {
  // Localized button text based on detected language
  const getLocalizedButtons = (language) => {
    const buttonTexts = {
      'English': { yes: 'Yes, Send', no: 'Cancel', preview: 'Message to send:' },
      'Spanish': { yes: 'Sí, Enviar', no: 'Cancelar', preview: 'Mensaje a enviar:' },
      'French': { yes: 'Oui, Envoyer', no: 'Annuler', preview: 'Message à envoyer:' },
      'German': { yes: 'Ja, Senden', no: 'Abbrechen', preview: 'Zu sendende Nachricht:' },
      'Portuguese': { yes: 'Sim, Enviar', no: 'Cancelar', preview: 'Mensagem a enviar:' },
      'Italian': { yes: 'Sì, Invia', no: 'Annulla', preview: 'Messaggio da inviare:' }
    };
    
    return buttonTexts[language] || buttonTexts['English'];
  };

  const buttons = getLocalizedButtons(userLanguage);

  const handleApprove = () => {
    onApprove();
    onClose();
  };

  const handleReject = () => {
    onReject();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerIcon}>🤖</Text>
            <Text style={styles.headerTitle}>AI Assistant</Text>
          </View>

          {/* Confirmation Message */}
          <View style={styles.content}>
            <Text style={styles.confirmationText}>
              {confirmationText}
            </Text>
            
            {messageContent && (
              <>
                <Text style={styles.previewLabel}>
                  {buttons.preview}
                </Text>
                <View style={styles.messagePreview}>
                  <Text style={styles.messageText}>
                    "{messageContent}"
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.cancelButton]}
              onPress={handleReject}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>
                {buttons.no}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.button, styles.sendButton]}
              onPress={handleApprove}
              activeOpacity={0.7}
            >
              <Text style={styles.sendButtonText}>
                {buttons.yes}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 16,
    minWidth: 280,
    maxWidth: 350,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  content: {
    padding: 20,
  },
  confirmationText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
    marginBottom: 16,
  },
  previewLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    marginBottom: 8,
  },
  messagePreview: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e1e5e9',
  },
  messageText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e1e5e9',
  },
  sendButton: {
    backgroundColor: '#007AFF',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
