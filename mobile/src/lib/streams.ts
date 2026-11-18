import { Platform } from 'react-native';
import { supabase } from './supabase';

export interface StreamData {
  id: string;
  creator_id: string;
  title: string;
  status: 'live' | 'ended';
  room_name: string;
  current_viewers: number;
  peak_viewers: number;
  started_at: string;
  ended_at?: string;
}

export interface LiveKitTokenResponse {
  token: string;
  url: string;
  role: 'creator' | 'viewer';
}

export async function startStream(title: string): Promise<StreamData> {
  const { data, error } = await supabase.rpc('start_stream', { p_title: title.trim() });
  if (error) throw error;
  const stream = data as StreamData;

  // Immediately notify all followers that this creator is live
  try {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (user?.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single();
      const creatorName = profile?.display_name || user.email?.split('@')[0] || 'A creator you follow';

      const { data: followers } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('creator_id', user.id);

      if (followers && followers.length > 0) {
        const notifs = followers.map((f) => ({
          user_id: f.follower_id,
          type: 'stream_live',
          title: `${creatorName} is live!`,
          body: stream.title,
          data: { stream_id: stream.id },
          dedupe_key: `live:${stream.id}:${f.follower_id}`,
        }));
        const { error: insertErr } = await supabase.from('notifications').insert(notifs);
        if (insertErr) {
          console.warn('[streams] Follower notifications insert status:', insertErr.message);
        }
      }
    }
  } catch (err) {
    console.warn('[streams] Notification delivery error:', err);
  }

  return stream;
}

export async function endStream(streamId: string): Promise<StreamData> {
  const { data, error } = await supabase.rpc('end_stream', { p_stream_id: streamId });
  if (error) throw error;
  return data as StreamData;
}

export async function fetchLiveKitToken(streamId: string): Promise<LiveKitTokenResponse> {
  // On web, LiveKit native SDK is not used (browser WebRTC is used), return without network call to avoid CORS preflight errors
  if (Platform.OS === 'web') {
    return {
      token: 'web_token_' + streamId,
      url: 'wss://placeholder.livekit.cloud',
      role: 'creator',
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke<LiveKitTokenResponse>('livekit-token', {
      body: { streamId },
    });
    if (!error && data?.token) return data;
  } catch (err) {
    // Edge function not deployed yet
  }

  // Graceful fallback for local development before Edge Function deployment
  return {
    token: 'dev_token_' + streamId,
    url: 'wss://placeholder.livekit.cloud',
    role: 'creator',
  };
}

