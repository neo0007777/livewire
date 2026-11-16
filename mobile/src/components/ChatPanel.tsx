import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ChatMessage } from '../hooks/useChat';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onRetry: (id: string) => void;
  isEnded?: boolean;
}

export function ChatPanel({ messages, onSend, onRetry, isEnded }: ChatPanelProps) {
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim() || isEnded) return;
    onSend(input);
    setInput('');
  };

  // Render sorted newest at bottom, or inverted list
  const displayMessages = [...messages].reverse();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.listContainer}>
        <FlatList
          data={displayMessages}
          keyExtractor={(item) => item.id}
          inverted
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.messageList}
          renderItem={({ item }) => (
            <View style={styles.messageRow}>
              <View style={styles.bubble}>
                <Text style={styles.author}>{item.author_name || 'Viewer'}</Text>
                <Text style={styles.content}>{item.content}</Text>
              </View>

              {item.status === 'sending' && (
                <Text style={styles.sendingTag}>sending...</Text>
              )}

              {item.status === 'failed' && (
                <TouchableOpacity onPress={() => onRetry(item.id)}>
                  <Text style={styles.failedTag}>
                    {item.errorReason || 'Tap to retry'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      </View>

      {isEnded ? (
        <View style={styles.endedBanner}>
          <Text style={styles.endedText}>Broadcast has ended</Text>
        </View>
      ) : (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            placeholder="Say something in live chat..."
            placeholderTextColor="#888"
            value={input}
            onChangeText={setInput}
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[styles.sendButton, !input.trim() && styles.disabledButton]}
            onPress={handleSend}
            disabled={!input.trim()}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 280,
    width: '100%',
    justifyContent: 'flex-end',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 12,
  },
  messageList: {
    paddingVertical: 8,
    gap: 8,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: 6,
  },
  bubble: {
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    maxWidth: '85%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  author: {
    color: '#818CF8',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  content: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  sendingTag: {
    color: '#9CA3AF',
    fontSize: 11,
    fontStyle: 'italic',
    paddingBottom: 4,
  },
  failedTag: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '600',
    paddingBottom: 4,
  },
  endedBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    padding: 10,
    alignItems: 'center',
    margin: 12,
    borderRadius: 8,
  },
  endedText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
  inputRow: {
    flexDirection: 'row',
    padding: 10,
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    color: '#FFF',
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
  },
  disabledButton: {
    backgroundColor: '#374151',
  },
  sendButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 13,
  },
});
