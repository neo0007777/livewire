import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { ChatMessage } from '../hooks/useChat';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../stores/session';
import { SendIcon } from './Icons';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (content: string) => Promise<void>;
  onRetry: (id: string) => void;
  isEnded?: boolean;
}

const QUICK_CHATS = ['GG', 'HYPE', 'W', 'FIRE', 'LFG', '100%'];

export function ChatPanel({ messages, onSend, onRetry, isEnded }: ChatPanelProps) {
  const { session, profile } = useSessionStore();
  const [input, setInput] = useState('');
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const flatListRef = useRef<FlatList>(null);

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

  const handleSend = (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isEnded) return;
    onSend(text);
    if (!textToSend) setInput('');
  };

  // Render newest at bottom
  const displayMessages = [...messages].reverse();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      style={styles.container}
    >
      {/* Messages Stream */}
      <FlatList
        ref={flatListRef}
        data={displayMessages}
        keyExtractor={(item, index) => item.id || `msg-${index}`}
        inverted
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.messageList}
        renderItem={({ item }) => {
          const isMe = item.user_id === session?.user?.id;
          const isFollowed = item.user_id ? followedIds.has(item.user_id) : false;

          return (
            <View style={styles.messageRow}>
              <View style={styles.bubble}>
                <View style={styles.authorRow}>
                  {/* Avatar dot */}
                  <View style={styles.avatarMini}>
                    <Text style={styles.avatarMiniText}>
                      {(item.author_name || 'V').charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <Text style={[styles.author, isMe && styles.authorMe]}>
                    {item.author_name || 'Viewer'}
                  </Text>

                  {session?.user?.id && item.user_id && item.user_id !== session.user.id && (
                    <TouchableOpacity
                      style={[styles.chatFollowBtn, isFollowed && styles.chatFollowingBtn]}
                      onPress={() => handleToggleFollow(item.user_id!, item.author_name)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chatFollowBtnText, isFollowed && styles.chatFollowingBtnText]}>
                        {isFollowed ? 'Following' : '+ Follow'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={styles.content}>{item.content}</Text>
              </View>

              {item.status === 'sending' && (
                <ActivityIndicator size="small" color="#818CF8" style={styles.statusIndicator} />
              )}
              {item.status === 'failed' && (
                <TouchableOpacity
                  onPress={() => onRetry(item.id)}
                  style={styles.retryBtn}
                >
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />

      {/* Quick Reaction Chips */}
      {!isEnded && (
        <View style={styles.reactionRibbon}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reactionsScroll}>
            {QUICK_CHATS.map((label) => (
              <TouchableOpacity
                key={label}
                style={styles.reactionPill}
                onPress={() => handleSend(label)}
                activeOpacity={0.65}
              >
                <Text style={styles.reactionLabel}>{label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Input Bar */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={isEnded ? 'Stream has ended' : 'Say something in live chat...'}
          placeholderTextColor="#64748B"
          value={input}
          onChangeText={setInput}
          editable={!isEnded}
          onSubmitEditing={() => handleSend()}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendButton, (!input.trim() || isEnded) && styles.sendButtonDisabled]}
          onPress={() => handleSend()}
          disabled={!input.trim() || isEnded}
          activeOpacity={0.8}
        >
          <SendIcon size={14} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 310,
    width: '100%',
    justifyContent: 'flex-end',
  },
  messageList: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    gap: 8,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  bubble: {
    backgroundColor: 'rgba(10, 14, 26, 0.82)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    maxWidth: '90%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  avatarMini: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#4338CA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarMiniText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
  },
  author: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '700',
  },
  authorMe: {
    color: '#A5B4FC',
  },
  chatFollowBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  chatFollowingBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  chatFollowBtnText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '700',
  },
  chatFollowingBtnText: {
    color: '#94A3B8',
  },
  content: {
    color: '#F8FAFC',
    fontSize: 13,
    lineHeight: 18,
  },
  statusIndicator: {
    marginBottom: 6,
  },
  retryBtn: {
    backgroundColor: '#7F1D1D',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  retryText: {
    color: '#FCA5A5',
    fontSize: 10,
    fontWeight: '700',
  },
  reactionRibbon: {
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  reactionsScroll: {
    gap: 6,
  },
  reactionPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  reactionLabel: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    paddingTop: 4,
    gap: 8,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#1E293B',
    shadowOpacity: 0,
    elevation: 0,
  },
});
