import { useState, useRef, useEffect, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface UsePresenceCountProps {
  streamId: string;
  creatorId: string;
  isCreator: boolean;
}

export function usePresenceCount({ streamId, creatorId, isCreator }: UsePresenceCountProps) {
  const [viewerCount, setViewerCount] = useState<number>(0);
  const countRef = useRef<number>(0);

  const updateFromPresence = useCallback(
    (channel: RealtimeChannel) => {
      const state = channel.presenceState<{ role: 'creator' | 'viewer' }>();
      const count = Object.entries(state).filter(
        ([key, metas]) => key !== creatorId && metas.some((m) => m.role === 'viewer')
      ).length;

      countRef.current = count;
      setViewerCount(count);
    },
    [creatorId]
  );

  // Creator persists presence count & updates heartbeat every 5s
  useEffect(() => {
    if (!isCreator || !streamId) return;

    const report = async () => {
      try {
        await supabase.rpc('report_viewer_count', {
          p_stream_id: streamId,
          p_count: countRef.current,
        });
      } catch (err) {
        // Heartbeat failure handled gracefully
      }
    };

    report();
    const interval = setInterval(report, 5000);

    return () => clearInterval(interval);
  }, [isCreator, streamId]);

  return {
    viewerCount,
    updateFromPresence,
  };
}
