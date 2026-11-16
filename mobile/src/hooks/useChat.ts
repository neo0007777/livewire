import { useState, useEffect, useRef, useCallback } from 'react';
import * as Crypto from 'expo-crypto';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../stores/session';

export interface ChatMessage {
  id: string;
  seq?: number;
  user_id: string;
  author_name: string;
  content: string;
  created_at?: string;
  status?: 'sending' | 'sent' | 'failed';
  errorReason?: string;
}

export function useChat(streamId: string) {
  const { session, profile } = useSessionStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isEnded, setIsEnded] = useState(false);
  const lastSeqRef = useRef<number>(0);

  // Load initial chat history
  useEffect(() => {
    if (!streamId) return;

    let isMounted = true;
    supabase
      .from('chat_messages')
      .select('id, seq, user_id, author_name, content, created_at')
      .eq('stream_id', streamId)
      .order('seq', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (!isMounted || error || !data) return;
        const initial = data.reverse() as ChatMessage[];
        setMessages(initial);
        const maxSeq = initial.reduce((max, m) => Math.max(max, m.seq || 0), 0);
        lastSeqRef.current = maxSeq;
      });

    return () => {
      isMounted = false;
    };
  }, [streamId]);

  // Handle incoming realtime message
  const handleIncomingMessage = useCallback((msg: ChatMessage) => {
    if (msg.seq && msg.seq > lastSeqRef.current) {
      lastSeqRef.current = msg.seq;
    }
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === msg.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = { ...msg, status: 'sent' };
        return next;
      }
      return [...prev, { ...msg, status: 'sent' }];
    });
  }, []);

  // Handle stream update (e.g. status='ended')
  const handleStreamUpdate = useCallback((stream: { status?: string }) => {
    if (stream?.status === 'ended') {
      setIsEnded(true);
    }
  }, []);

  // Gap fill on channel reconnection
  const fillGaps = useCallback(async () => {
    if (!streamId) return;
    const sinceSeq = Math.max(0, lastSeqRef.current - 20);
    const { data } = await supabase
      .from('chat_messages')
      .select('id, seq, user_id, author_name, content, created_at')
      .eq('stream_id', streamId)
      .gt('seq', sinceSeq)
      .order('seq', { ascending: true });

    if (data && data.length > 0) {
      setMessages((prev) => {
        const map = new Map<string, ChatMessage>();
        prev.forEach((m) => map.set(m.id, m));
        data.forEach((m) => {
          map.set(m.id, { ...m, status: 'sent' });
          if (m.seq && m.seq > lastSeqRef.current) {
            lastSeqRef.current = m.seq;
          }
        });
        return Array.from(map.values()).sort((a, b) => {
          if (a.seq && b.seq) return a.seq - b.seq;
          if (a.seq) return -1;
          if (b.seq) return 1;
          return 0;
        });
      });
    }
  }, [streamId]);

  // Send message
  const send = useCallback(
    async (content: string, customId?: string) => {
      const trimmed = content.trim();
      if (!trimmed || isEnded || !session?.user?.id) return;

      const id = customId || Crypto.randomUUID();
      const meName = profile?.display_name || session.user.email?.split('@')[0] || 'Me';

      // 1. Optimistic append
      const optimisticMsg: ChatMessage = {
        id,
        user_id: session.user.id,
        author_name: meName,
        content: trimmed,
        status: 'sending',
      };

      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === id);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = optimisticMsg;
          return next;
        }
        return [...prev, optimisticMsg];
      });

      // 2. Perform DB insert
      const { error } = await supabase.from('chat_messages').insert({
        id,
        stream_id: streamId,
        content: trimmed,
      });

      if (!error) {
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, status: 'sent' } : m))
        );
      } else if (error.code === '23505') {
        // Unique violation = already inserted (idempotent success)
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, status: 'sent' } : m))
        );
      } else if (error.message?.includes('rate_limited')) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, status: 'failed', errorReason: 'Slow down' } : m
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, status: 'failed', errorReason: 'Tap to retry' } : m
          )
        );
      }
    },
    [streamId, isEnded, session?.user, profile?.display_name]
  );

  const retry = useCallback(
    (id: string) => {
      const target = messages.find((m) => m.id === id);
      if (target) {
        send(target.content, target.id);
      }
    },
    [messages, send]
  );

  return {
    messages,
    isEnded,
    send,
    retry,
    handleIncomingMessage,
    handleStreamUpdate,
    fillGaps,
  };
}
