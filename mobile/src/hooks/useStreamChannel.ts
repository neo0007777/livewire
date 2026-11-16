import { useEffect, useState, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../stores/session';

interface UseStreamChannelOptions {
  streamId: string;
  isCreator: boolean;
  onNewMessage?: (message: any) => void;
  onStreamUpdate?: (stream: any) => void;
  onPresenceSync?: (channel: RealtimeChannel) => void;
}

export function useStreamChannel({
  streamId,
  isCreator,
  onNewMessage,
  onStreamUpdate,
  onPresenceSync,
}: UseStreamChannelOptions) {
  const { session } = useSessionStore();
  const [channelStatus, setChannelStatus] = useState<string>('DISCONNECTED');
  const channelRef = useRef<RealtimeChannel | null>(null);
  const viewerSessionIdRef = useRef(Math.random().toString(36).slice(2, 7));

  // Store callbacks in refs to avoid stale closures in event listeners
  const onNewMessageRef = useRef(onNewMessage);
  onNewMessageRef.current = onNewMessage;

  const onStreamUpdateRef = useRef(onStreamUpdate);
  onStreamUpdateRef.current = onStreamUpdate;

  const onPresenceSyncRef = useRef(onPresenceSync);
  onPresenceSyncRef.current = onPresenceSync;

  const cleanStreamId = Array.isArray(streamId) ? streamId[0] : streamId;

  useEffect(() => {
    if (!cleanStreamId || !session?.user?.id) return;

    const channelName = `stream:${cleanStreamId}`;

    // Clean up any existing channel with this name to prevent "cannot add callbacks after subscribe" error
    const existing = supabase.getChannels().find((c) => c.topic === `realtime:${channelName}`);
    if (existing) {
      supabase.removeChannel(existing);
    }

    const presenceKey = isCreator
      ? `${session.user.id}:creator`
      : `${session.user.id}:viewer:${viewerSessionIdRef.current}`;
    const channel = supabase.channel(channelName, {
      config: {
        presence: { key: presenceKey },
      },
    });

    channelRef.current = channel;

    // Chat INSERT listener
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `stream_id=eq.${cleanStreamId}`,
      },
      (payload) => {
        onNewMessageRef.current?.(payload.new);
      }
    );

    // Stream status UPDATE listener (e.g. ended)
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'streams',
        filter: `id=eq.${cleanStreamId}`,
      },
      (payload) => {
        onStreamUpdateRef.current?.(payload.new);
      }
    );

    // Presence listeners (sync, join, leave)
    const handlePresence = () => {
      onPresenceSyncRef.current?.(channel);
    };

    channel.on('presence', { event: 'sync' }, handlePresence);
    channel.on('presence', { event: 'join' }, handlePresence);
    channel.on('presence', { event: 'leave' }, handlePresence);

    channel.subscribe(async (status) => {
      setChannelStatus(status);
      if (status === 'SUBSCRIBED') {
        try {
          await channel.track({
            role: isCreator ? 'creator' : 'viewer',
            user_id: session.user.id,
            joined_at: new Date().toISOString(),
          });
        } catch (e) {
          // Track handled
        }
        handlePresence();
      }
    });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [cleanStreamId, session?.user?.id, isCreator]);

  return {
    channel: channelRef.current,
    status: channelStatus,
  };
}


