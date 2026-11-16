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
  return data as StreamData;
}

export async function endStream(streamId: string): Promise<StreamData> {
  const { data, error } = await supabase.rpc('end_stream', { p_stream_id: streamId });
  if (error) throw error;
  return data as StreamData;
}

export async function fetchLiveKitToken(streamId: string): Promise<LiveKitTokenResponse> {
  const { data, error } = await supabase.functions.invoke<LiveKitTokenResponse>('livekit-token', {
    body: { streamId },
  });
  if (error) throw error;
  if (!data) throw new Error('No token returned from server');
  return data;
}

