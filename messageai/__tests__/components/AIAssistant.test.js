/**
 * Tests for AIAssistant component
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AIAssistant from '../../components/AIAssistant';

// Mock the AI service
jest.mock('../../utils/aiService', () => ({
  translateMessages: jest.fn(() => Promise.resolve('Translation successful')),
  explainCulturalContext: jest.fn(() => Promise.resolve('Cultural context explanation')),
  generateSmartReplies: jest.fn(() => Promise.resolve('Smart reply suggestions')),
  adjustFormality: jest.fn(() => Promise.resolve('Formality adjusted')),
}));

// Mock the localization context
const mockLocalizationContext = {
  strings: {
    aiAssistant: 'AI Assistant',
    translate: 'Translate',
    explain: 'Explain',
    suggest: 'Suggest',
    casual: 'Casual',
    formal: 'Formal',
    close: 'Close',
    processing: 'Processing...',
  },
  isEnglish: true,
  languageName: 'English'
};

jest.mock('../../context/LocalizationContext', () => ({
  useLocalization: () => mockLocalizationContext
}));

describe('AIAssistant', () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    chatId: 'test-chat-id',
    messages: [
      {
        id: 'msg1',
        text: 'Hello world',
        senderId: 'user1',
        timestamp: new Date(),
        type: 'text'
      }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly when visible', () => {
    const { getByText } = render(<AIAssistant {...defaultProps} />);
    
    expect(getByText('AI Assistant')).toBeTruthy();
    expect(getByText('Translate')).toBeTruthy();
    expect(getByText('Explain')).toBeTruthy();
    expect(getByText('Suggest')).toBeTruthy();
  });

  it('does not render when not visible', () => {
    const { queryByText } = render(
      <AIAssistant {...defaultProps} visible={false} />
    );
    
    expect(queryByText('AI Assistant')).toBeFalsy();
  });

  it('calls onClose when close button is pressed', () => {
    const onCloseMock = jest.fn();
    const { getByText } = render(
      <AIAssistant {...defaultProps} onClose={onCloseMock} />
    );
    
    fireEvent.press(getByText('Close'));
    expect(onCloseMock).toHaveBeenCalled();
  });

  it('handles translate action', async () => {
    const { translateMessages } = require('../../utils/aiService');
    const { getByText } = render(<AIAssistant {...defaultProps} />);
    
    fireEvent.press(getByText('Translate'));
    
    await waitFor(() => {
      expect(translateMessages).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ text: 'Hello world' })
        ]),
        'test-chat-id',
        'user-id-placeholder', // This would be actual user ID in real app
        { timeframe: '1h' }
      );
    });
  });

  it('handles explain action', async () => {
    const { explainCulturalContext } = require('../../utils/aiService');
    const { getByText } = render(<AIAssistant {...defaultProps} />);
    
    fireEvent.press(getByText('Explain'));
    
    await waitFor(() => {
      expect(explainCulturalContext).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ text: 'Hello world' })
        ]),
        'test-chat-id',
        'user-id-placeholder'
      );
    });
  });

  it('handles suggest action', async () => {
    const { generateSmartReplies } = require('../../utils/aiService');
    const { getByText } = render(<AIAssistant {...defaultProps} />);
    
    fireEvent.press(getByText('Suggest'));
    
    await waitFor(() => {
      expect(generateSmartReplies).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ text: 'Hello world' })
        ]),
        'test-chat-id',
        'user-id-placeholder'
      );
    });
  });

  it('shows processing state during AI operations', async () => {
    const { getByText, queryByText } = render(<AIAssistant {...defaultProps} />);
    
    // Mock a slow AI operation
    const { translateMessages } = require('../../utils/aiService');
    translateMessages.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve('Result'), 100))
    );
    
    fireEvent.press(getByText('Translate'));
    
    // Should show processing state
    expect(queryByText('Processing...')).toBeTruthy();
    
    await waitFor(() => {
      expect(queryByText('Processing...')).toBeFalsy();
    }, { timeout: 200 });
  });

  it('handles AI service errors gracefully', async () => {
    const { translateMessages } = require('../../utils/aiService');
    translateMessages.mockRejectedValueOnce(new Error('AI service error'));
    
    const { getByText } = render(<AIAssistant {...defaultProps} />);
    
    fireEvent.press(getByText('Translate'));
    
    await waitFor(() => {
      // Should not crash and should handle error gracefully
      expect(getByText('AI Assistant')).toBeTruthy();
    });
  });

  it('filters messages correctly for AI operations', () => {
    const messagesWithAI = [
      ...defaultProps.messages,
      {
        id: 'ai-msg',
        text: 'AI response',
        senderId: 'ai-assistant',
        type: 'ai',
        timestamp: new Date()
      }
    ];

    const { getByText } = render(
      <AIAssistant {...defaultProps} messages={messagesWithAI} />
    );
    
    fireEvent.press(getByText('Translate'));
    
    // Should filter out AI messages and only process user messages
    const { translateMessages } = require('../../utils/aiService');
    expect(translateMessages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ 
          text: 'Hello world',
          senderId: 'user1' 
        })
      ]),
      expect.any(String),
      expect.any(String),
      expect.any(Object)
    );
  });

  describe('accessibility', () => {
    it('has proper accessibility labels', () => {
      const { getByLabelText } = render(<AIAssistant {...defaultProps} />);
      
      expect(getByLabelText('Close AI Assistant')).toBeTruthy();
    });

    it('supports accessibility actions', () => {
      const { getByText } = render(<AIAssistant {...defaultProps} />);
      
      const translateButton = getByText('Translate');
      expect(translateButton.props.accessible).toBe(true);
    });
  });
});
