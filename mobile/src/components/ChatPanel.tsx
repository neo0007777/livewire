import React, { useState, useEffect, useCallback } from 'react';
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
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../stores/session';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onRetry: (id: string) => void;
  isEnded?: boolean;
}

export function ChatPanel({ messages, onSend, onRetry, isEnded }: ChatPanelProps) {
  const { session, profile } = useSessionStore();
  const [input, setInput] = useState('');
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());

  // Load who the current user follows
  useEffect(() => {
    if (!session?.user?.id) return;

    supabase
      .from('follows')
      .select('creator_id')
      .eq('follower_id', session.user.id)
      .then(({ data }) => {
        if (data) {
          setFollowedIds(new Set(data.map((f) => f.creator_id)));
        }
      });
  }, [session?.user?.id]);

  // Toggle follow user from chat
  const handleToggleFollow = useCallback(
    async (targetUserId: string, targetName: string) => {
      if (!session?.user?.id || !targetUserId || targetUserId === session.user.id) return;

      const isFollowing = followedIds.has(targetUserId);

      if (isFollowing) {
        setFollowedIds((prev) => {
          const next = new Set(prev);
          next.delete(targetUserId);
          return next;
        });

        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', session.user.id)
          .eq('creator_id', targetUserId);
      } else {
        setFollowedIds((prev) => new Set(prev).add(targetUserId));

        const { error } = await supabase.from('follows').insert({
          follower_id: session.user.id,
          creator_id: targetUserId,
        });

        if (!error) {
          // Send real-time follower notification
          try {
            const myName = profile?.display_name || session.user.email?.split('@')[0] || 'Someone';
            await supabase.from('notifications').insert({
              user_id: targetUserId,
              type: 'new_follower',
              title: 'New Follower!',
              body: `${myName} started following you from live chat.`,
              data: { follower_id: session.user.id },
              dedupe_key: `follow:${session.user.id}:${targetUserId}:${Date.now()}`,
            });
          } catch (e) {
            // Best-effort notification delivery
          }
        }
      }
    },
    [session?.user?.id, session?.user?.email, profile?.display_name, followedIds]
  );

  const handleSend = () => {
    if (!input.trim() || isEnded) return;
    onSend(input);
    setInput('');
  };

  // Render newest at bottom
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
                <View style={styles.authorRow}>
                  <Text style={styles.author}>{item.author_name || 'Viewer'}</Text>
                  {session?.user?.id && item.user_id && item.user_id !== session.user.id && (
                    <TouchableOpacity
                      style={[
                        styles.chatFollowBtn,
                        followedIds.has(item.user_id) && styles.chatFollowingBtn,
                      ]}
                      onPress={() => handleToggleFollow(item.user_id, item.author_name)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.chatFollowBtnText}>
                        {followedIds.has(item.user_id) ? '✓ Following' : '+ Follow'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
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
    height: 290,
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    maxWidth: '88%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  author: {
    color: '#818CF8',
    fontSize: 11,
    fontWeight: '700',
  },
  chatFollowBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  chatFollowingBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  chatFollowBtnText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '700',
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
