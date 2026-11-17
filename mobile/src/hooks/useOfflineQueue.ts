import { useState, useEffect, useCallback, useRef } from 'react';
import {
  QueuedMessage,
  getStreamQueue,
  enqueueOfflineMessage,
  removeOfflineMessage,
  updateOfflineMessage,
  clearOfflineQueue,
} from '../lib/offlineQueue';
import { supabase } from '../lib/supabase';

interface UseOfflineQueueProps {
  streamId: string;
  isOnline: boolean;
  onMessageSent?: (id: string) => void;
  onMessageFailed?: (id: string, reason: string) => void;
}

export function useOfflineQueue({
  streamId,
  isOnline,
  onMessageSent,
  onMessageFailed,
}: UseOfflineQueueProps) {
  const [queuedMessages, setQueuedMessages] = useState<QueuedMessage[]>([]);
  const [isDraining, setIsDraining] = useState(false);
  const isDrainingRef = useRef(false);

  // Load existing queued messages from persistent storage on mount
  const refreshQueue = useCallback(async () => {
    if (!streamId) return;
    const items = await getStreamQueue(streamId);
    setQueuedMessages(items);
  }, [streamId]);

  useEffect(() => {
    refreshQueue();
  }, [refreshQueue]);

  // Drain the queue when online
  const drainQueue = useCallback(async () => {
    if (!isOnline || isDrainingRef.current || !streamId) return;

    const queue = await getStreamQueue(streamId);
    if (queue.length === 0) return;

    isDrainingRef.current = true;
    setIsDraining(true);

    try {
      for (const item of queue) {
        // Mark as sending
        await updateOfflineMessage(item.id, { status: 'sending' });
        setQueuedMessages((prev) =>
          prev.map((m) => (m.id === item.id ? { ...m, status: 'sending' } : m))
        );

        // Attempt insert with client UUID idempotency
        const { error } = await supabase.from('chat_messages').insert({
          id: item.id,
          stream_id: item.stream_id,
          content: item.content,
        });

        if (!error || error.code === '23505') {
          // Success or already inserted
          await removeOfflineMessage(item.id);
          onMessageSent?.(item.id);
          setQueuedMessages((prev) => prev.filter((m) => m.id !== item.id));
        } else if (error.message?.includes('rate_limited')) {
          // Rate limit: stop draining, wait backoff
          await updateOfflineMessage(item.id, {
            status: 'failed',
            last_error: 'Slow down',
            retry_count: item.retry_count + 1,
          });
          onMessageFailed?.(item.id, 'Slow down');
          break; // Stop draining remaining items until next try
        } else {
          // Generic failure: increment retry
          const reason = error.message || 'Send failed';
          await updateOfflineMessage(item.id, {
            status: 'failed',
            last_error: reason,
            retry_count: item.retry_count + 1,
          });
          onMessageFailed?.(item.id, reason);
          setQueuedMessages((prev) =>
            prev.map((m) =>
              m.id === item.id
                ? {
                    ...m,
                    status: 'failed',
                    last_error: reason,
                    retry_count: item.retry_count + 1,
                  }
                : m
            )
          );
        }

        // Small spacing between drains to avoid flood
        await new Promise((r) => setTimeout(r, 200));
      }
    } finally {
      isDrainingRef.current = false;
      setIsDraining(false);
      refreshQueue();
    }
  }, [isOnline, streamId, onMessageSent, onMessageFailed, refreshQueue]);

  // Auto-drain when online changes to true
  useEffect(() => {
    if (isOnline) {
      // Short delay to let connection settle
      const timer = setTimeout(() => {
        drainQueue();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOnline, drainQueue]);

  // Enqueue a message to persistent storage
  const enqueue = useCallback(
    async (params: {
      id: string;
      stream_id: string;
      user_id: string;
      author_name: string;
      content: string;
      errorReason?: string;
    }) => {
      const entry = await enqueueOfflineMessage(params);
      setQueuedMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === entry.id);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = entry;
          return next;
        }
        return [...prev, entry];
      });
      return entry;
    },
    []
  );

  // Remove message from queue
  const remove = useCallback(async (id: string) => {
    await removeOfflineMessage(id);
    setQueuedMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // Clear queue
  const clear = useCallback(async () => {
    await clearOfflineQueue(streamId);
    setQueuedMessages([]);
  }, [streamId]);

  return {
    queuedMessages,
    queueCount: queuedMessages.length,
    isDraining,
    drainQueue,
    enqueue,
    remove,
    clear,
    refreshQueue,
  };
}

