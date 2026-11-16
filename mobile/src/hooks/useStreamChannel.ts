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
        onNewMessage?.(payload.new);
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
        onStreamUpdate?.(payload.new);
      }
    );

    // Presence sync listener
    channel.on('presence', { event: 'sync' }, () => {
      onPresenceSync?.(channel);
    });

    channel.subscribe(async (status) => {
      setChannelStatus(status);
      if (status === 'SUBSCRIBED') {
        await channel.track({
          role: isCreator ? 'creator' : 'viewer',
          joined_at: new Date().toISOString(),
        });
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
