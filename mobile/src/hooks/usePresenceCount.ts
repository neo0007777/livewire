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
  const creatorIdRef = useRef(creatorId);
  creatorIdRef.current = creatorId;
  const lastChannelRef = useRef<RealtimeChannel | null>(null);

  const cleanStreamId = Array.isArray(streamId) ? streamId[0] : streamId;

  const updateFromPresence = useCallback((channel: RealtimeChannel) => {
    lastChannelRef.current = channel;
    const state = channel.presenceState<{ role?: 'creator' | 'viewer'; user_id?: string }>();
    const count = Object.entries(state).filter(([key, metas]) => {
      // Exclude creator by presence key suffix
      if (key.endsWith(':creator')) return false;
      // Exclude creator by ID if known
      if (creatorIdRef.current && (key === creatorIdRef.current || key.startsWith(`${creatorIdRef.current}:`))) return false;
      // Exclude creator by role or metadata user_id
      if (metas.some((m) => m?.role === 'creator' || (creatorIdRef.current && m?.user_id === creatorIdRef.current))) return false;
      return true;
    }).length;

    countRef.current = count;
    setViewerCount(count);
  }, []);

  // When creatorId arrives (e.g. async fetch), re-evaluate existing presence state
  useEffect(() => {
    if (lastChannelRef.current) {
      updateFromPresence(lastChannelRef.current);
    }
  }, [creatorId, updateFromPresence]);

  // Sync count from streams table database updates
  const updateFromStream = useCallback((stream: { current_viewers?: number }) => {
    if (typeof stream?.current_viewers === 'number') {
      const dbCount = Math.max(0, stream.current_viewers);
      setViewerCount((prev) => Math.max(prev, dbCount));
    }
  }, []);

  // Creator persists presence count & updates heartbeat every 5s
  useEffect(() => {
    if (!isCreator || !cleanStreamId) return;

    const report = async () => {
      try {
        await supabase.rpc('report_viewer_count', {
          p_stream_id: cleanStreamId,
          p_count: countRef.current,
        });
      } catch (err) {
        // Heartbeat failure handled gracefully
      }
    };

    report();
    const interval = setInterval(report, 5000);

    return () => clearInterval(interval);
  }, [isCreator, cleanStreamId]);

  return {
    viewerCount,
    updateFromPresence,
    updateFromStream,
  };
}

