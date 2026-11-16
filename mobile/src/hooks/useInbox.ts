import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../stores/session';

export interface AppNotification {
  id: string;
  user_id: string;
  type: 'stream_live' | 'viewer_milestone' | 'highlights_ready' | 'daily_digest';
  title: string;
  body: string;
  data: {
    stream_id?: string;
    milestone?: number;
    digest_date?: string;
  };
  dedupe_key: string;
  read_at: string | null;
  created_at: string;
}

export function useInbox() {
  const { session } = useSessionStore();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  // Load initial notifications
  const loadNotifications = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setNotifications(data as AppNotification[]);
    }
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Real-time inbox subscription
  useEffect(() => {
    if (!session?.user?.id) return;

    const channel = supabase
      .channel(`inbox:${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${session.user.id}`,
        },
        (payload) => {
          const newNotif = payload.new as AppNotification;
          setNotifications((prev) => [newNotif, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  const markAsRead = async (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n))
    );

    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId);
  };

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return {
    notifications,
    unreadCount,
    loading,
    refresh: loadNotifications,
    markAsRead,
  };
}
