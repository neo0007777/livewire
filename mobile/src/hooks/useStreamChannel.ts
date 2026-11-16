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

  // Store callbacks in refs to avoid stale closures in event listeners
  const onNewMessageRef = useRef(onNewMessage);
  onNewMessageRef.current = onNewMessage;

  const onStreamUpdateRef = useRef(onStreamUpdate);
  onStreamUpdateRef.current = onStreamUpdate;

  const onPresenceSyncRef = useRef(onPresenceSync);
  onPresenceSyncRef.current = onPresenceSync;

  useEffect(() => {
    if (!streamId || !session?.user?.id) return;

    const channelName = `stream:${streamId}`;
    const channel = supabase.channel(channelName, {
      config: {
        presence: { key: session.user.id },
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
        filter: `stream_id=eq.${streamId}`,
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
        filter: `id=eq.${streamId}`,
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
        await channel.track({
          role: isCreator ? 'creator' : 'viewer',
          joined_at: new Date().toISOString(),
        });
        // Immediately sync presence after tracking
        handlePresence();
      }
    });

    return () => {
      channel.untrack().finally(() => {
        supabase.removeChannel(channel);
      });
      channelRef.current = null;
    };
  }, [streamId, session?.user?.id, isCreator]);

  return {
    channel: channelRef.current,
    status: channelStatus,
  };
}


