import { useState, useEffect, useRef, useCallback } from 'react';
import * as Crypto from 'expo-crypto';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../stores/session';
import { useNetworkStatus } from './useNetworkStatus';
import { useOfflineQueue } from './useOfflineQueue';
import { QueuedMessage } from '../lib/offlineQueue';

export interface ChatMessage {
  id: string;
  seq?: number;
  user_id: string;
  author_name: string;
  content: string;
  created_at?: string;
  status?: 'sending' | 'sent' | 'failed' | 'queued';
  errorReason?: string;
}

export function useChat(streamId: string) {
  const { session, profile } = useSessionStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isEnded, setIsEnded] = useState(false);
  const lastSeqRef = useRef<number>(0);

  // Network connectivity status
  const { isOnline } = useNetworkStatus();

  // Handle message sent from offline queue
  const handleQueueMessageSent = useCallback((id: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: 'sent', errorReason: undefined } : m))
    );
  }, []);

  // Handle message failed from offline queue
  const handleQueueMessageFailed = useCallback((id: string, reason: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: 'failed', errorReason: reason } : m))
    );
  }, []);

  // Persistent offline queue hook
  const {
    queuedMessages,
    queueCount,
    isDraining,
    drainQueue,
    enqueue: enqueueToOffline,
    remove: removeFromOffline,
    refreshQueue,
  } = useOfflineQueue({
    streamId,
    isOnline,
    onMessageSent: handleQueueMessageSent,
    onMessageFailed: handleQueueMessageFailed,
  });

  // Load initial chat history & combine with persisted queued messages
  useEffect(() => {
    if (!streamId) return;

    let isMounted = true;
    Promise.all([
      supabase
        .from('chat_messages')
        .select('id, seq, user_id, author_name, content, created_at')
        .eq('stream_id', streamId)
        .order('seq', { ascending: false })
        .limit(100),
      refreshQueue(),
    ]).then(([historyResult]) => {
      if (!isMounted) return;
      const data = historyResult.data;
      if (!data) return;

      const initial = (data.reverse() as ChatMessage[]).map((m) => ({
        ...m,
        status: 'sent' as const,
      }));

      const maxSeq = initial.reduce((max, m) => Math.max(max, m.seq || 0), 0);
      lastSeqRef.current = maxSeq;

      setMessages((prev) => {
        // Keep any active queued items that aren't yet in history
        const map = new Map<string, ChatMessage>();
        initial.forEach((m) => map.set(m.id, m));
        prev.forEach((m) => {
          if (m.status === 'queued' || m.status === 'sending' || m.status === 'failed') {
            if (!map.has(m.id)) {
              map.set(m.id, m);
            }
          }
        });
        return Array.from(map.values());
      });
    });

    return () => {
      isMounted = false;
    };
  }, [streamId, refreshQueue]);

  // Sync queued items into messages array whenever queuedMessages changes
  useEffect(() => {
    if (queuedMessages.length === 0) return;

    setMessages((prev) => {
      const map = new Map<string, ChatMessage>();
      prev.forEach((m) => map.set(m.id, m));

      queuedMessages.forEach((qm) => {
        const existing = map.get(qm.id);
        if (!existing || existing.status !== 'sent') {
          map.set(qm.id, {
            id: qm.id,
            user_id: qm.user_id,
            author_name: qm.author_name,
            content: qm.content,
            created_at: qm.created_at,
            status: qm.status === 'sending' ? 'sending' : qm.status === 'failed' ? 'failed' : 'queued',
            errorReason: qm.last_error || (qm.status === 'queued' ? 'Queued (offline)' : undefined),
          });
        }
      });

      return Array.from(map.values());
    });
  }, [queuedMessages]);

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

  // Send message with offline queue fallback
  const send = useCallback(
    async (content: string, customId?: string) => {
      const trimmed = content.trim();
      if (!trimmed || isEnded || !session?.user?.id) return;

      const id = customId || Crypto.randomUUID();
      const meName = profile?.display_name || session.user.email?.split('@')[0] || 'Me';

      // 1. If currently offline, enqueue to persistent storage immediately
      if (!isOnline) {
        const optimisticMsg: ChatMessage = {
          id,
          user_id: session.user.id,
          author_name: meName,
          content: trimmed,
          status: 'queued',
          errorReason: 'Offline - queued',
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

        await enqueueToOffline({
          id,
          stream_id: streamId,
          user_id: session.user.id,
          author_name: meName,
          content: trimmed,
          errorReason: 'Offline - queued',
        });
        return;
      }

      // 2. Online: Optimistic append with 'sending' status
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

      // 3. Perform DB insert
      try {
        const { error } = await supabase.from('chat_messages').insert({
          id,
          stream_id: streamId,
          content: trimmed,
        });

        if (!error || error.code === '23505') {
          // Success or already inserted
          setMessages((prev) =>
            prev.map((m) => (m.id === id ? { ...m, status: 'sent', errorReason: undefined } : m))
          );
          await removeFromOffline(id);
        } else if (error.message?.includes('rate_limited')) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === id ? { ...m, status: 'failed', errorReason: 'Slow down' } : m
            )
          );
        } else {
          // Network or server issue -> persist to offline queue for automatic retry
          setMessages((prev) =>
            prev.map((m) =>
              m.id === id ? { ...m, status: 'queued', errorReason: 'Network error - queued' } : m
            )
          );
          await enqueueToOffline({
            id,
            stream_id: streamId,
            user_id: session.user.id,
            author_name: meName,
            content: trimmed,
            errorReason: error.message || 'Send failed',
          });
        }
      } catch (err: any) {
        // Uncaught network exception (e.g. fetch failed) -> save to offline queue
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, status: 'queued', errorReason: 'Network error - queued' } : m
          )
        );
        await enqueueToOffline({
          id,
          stream_id: streamId,
          user_id: session.user.id,
          author_name: meName,
          content: trimmed,
          errorReason: err?.message || 'Network unreachable',
        });
      }
    },
    [streamId, isEnded, session?.user, profile?.display_name, isOnline, enqueueToOffline, removeFromOffline]
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
    isOnline,
    queueCount,
    isDraining,
    send,
    retry,
    drainQueue,
    handleIncomingMessage,
    handleStreamUpdate,
    fillGaps,
  };
}
