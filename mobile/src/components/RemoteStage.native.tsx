import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, Platform } from 'react-native';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStream,
} from '@livekit/react-native-webrtc';
import { VideoCameraOffIcon, MicMutedIcon, ScreenShareIcon } from './Icons';

interface RemoteStageProps {
  channel?: any;
  streamId?: string;
}

export function RemoteStage({ channel }: RemoteStageProps) {
  const [p2pStream, setP2pStream] = useState<MediaStream | null>(null);
  const [isCreatorVideoPaused, setIsCreatorVideoPaused] = useState(false);
  const [isCreatorMicMuted, setIsCreatorMicMuted] = useState(false);
  const [isCreatorScreenSharing, setIsCreatorScreenSharing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'idle'>('connecting');

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const isP2pConnectedRef = useRef(false);
  const viewerIdRef = useRef(Math.random().toString(36).slice(2, 9));

  // Initialize native audio session for audio playback on Android/iOS
  useEffect(() => {
    try {
      const { AudioSession } = require('@livekit/react-native');
      AudioSession.startAudioSession().catch((err: any) => {
        console.warn('AudioSession start error on viewer:', err);
      });

      return () => {
        try {
          AudioSession.stopAudioSession().catch((err: any) => {
            console.warn('AudioSession stop error on viewer:', err);
          });
        } catch (e) {}
      };
    } catch (e) {}
  }, []);

  // WebRTC P2P Signaling via Supabase Realtime Channel
  useEffect(() => {
    if (!channel) return;

    let isMounted = true;
    const viewerId = viewerIdRef.current;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });
    pcRef.current = pc;

    // Handle remote track arrival
    pc.ontrack = (event: any) => {
      if (!isMounted) return;
      if (event.streams && event.streams[0]) {
        setP2pStream(event.streams[0]);
        isP2pConnectedRef.current = true;
        setConnectionStatus('connected');
      }
    };

    // Forward ICE candidates to creator
    pc.onicecandidate = (event: any) => {
      if (event.candidate && channel) {
        channel.send({
          type: 'broadcast',
          event: 'p2p_ice',
          payload: { targetId: 'creator', fromId: viewerId, candidate: event.candidate },
        });
      }
    };

    // Handle incoming offer from creator
    const handleOffer = async ({ payload }: any) => {
      if (payload?.targetId !== viewerId || !payload?.offer) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        channel.send({
          type: 'broadcast',
          event: 'p2p_answer',
          payload: { viewerId, answer },
        });
      } catch (err) {
        console.warn('[RemoteStage.native] Error handling P2P offer:', err);
      }
    };

    // Handle incoming ICE candidate from creator
    const handleIce = async ({ payload }: any) => {
      if (payload?.targetId === viewerId && payload?.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch (err) {
          console.warn('[RemoteStage.native] Error adding ICE candidate:', err);
        }
      }
    };

    // Handle creator media mute states
    const handleMediaState = ({ payload }: any) => {
      if (!isMounted) return;
      if (typeof payload?.isVideoMuted === 'boolean') {
        setIsCreatorVideoPaused(payload.isVideoMuted);
      }
      if (typeof payload?.isMicMuted === 'boolean') {
        setIsCreatorMicMuted(payload.isMicMuted);
      }
      if (typeof payload?.isScreenSharing === 'boolean') {
        setIsCreatorScreenSharing(payload.isScreenSharing);
      }
    };

    channel.on('broadcast', { event: 'p2p_offer' }, handleOffer);
    channel.on('broadcast', { event: 'p2p_ice' }, handleIce);
    channel.on('broadcast', { event: 'creator_media_state' }, handleMediaState);

    // Initial stream request
    channel.send({
      type: 'broadcast',
      event: 'p2p_request_stream',
      payload: { viewerId },
    });

    // Re-request stream periodically if not connected yet
    const retryInterval = setInterval(() => {
      if (!isP2pConnectedRef.current && isMounted) {
        channel.send({
          type: 'broadcast',
          event: 'p2p_request_stream',
          payload: { viewerId },
        });
      }
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(retryInterval);
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  }, [channel]);

  // If P2P stream is active, render native RTCView
  if (p2pStream) {
    return (
      <View style={styles.container}>
        <RTCView
          streamURL={p2pStream.toURL()}
          style={styles.video}
          objectFit="cover"
          zOrder={0}
        />

        {/* Creator paused camera overlay */}
        {isCreatorVideoPaused && (
          <View style={styles.creatorMutedOverlay}>
            <View style={styles.pausedIconCircle}>
              <VideoCameraOffIcon size={32} color="#EF4444" />
            </View>
            <Text style={styles.pausedText}>Camera turned off by creator</Text>
            <Text style={styles.pausedSub}>Audio is still streaming live</Text>
          </View>
        )}

        {/* Creator muted mic badge */}
        {isCreatorMicMuted && (
          <View style={styles.micMutedBadge}>
            <MicMutedIcon size={14} color="#EF4444" />
            <Text style={styles.micMutedText}>Host Muted</Text>
          </View>
        )}

        {/* Screen share indicator */}
        {isCreatorScreenSharing && (
          <View style={styles.screenShareBadge}>
            <ScreenShareIcon size={14} color="#818CF8" />
            <Text style={styles.screenShareText}>Screen Share Active</Text>
          </View>
        )}
      </View>
    );
  }

  // Connecting placeholder
  return (
    <View style={styles.placeholder}>
      <ActivityIndicator size="large" color="#818CF8" style={{ marginBottom: 16 }} />
      <Text style={styles.placeholderTitle}>Connecting to Live Broadcast...</Text>
      <Text style={styles.placeholderSub}>Waiting for video feed</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  video: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
  },
  placeholder: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#070913',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholderTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  placeholderSub: {
    color: '#64748B',
    fontSize: 13,
  },
  creatorMutedOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(7, 9, 19, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pausedIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  pausedText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  pausedSub: {
    color: '#94A3B8',
    fontSize: 12,
  },
  micMutedBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  micMutedText: {
    color: '#FCA5A5',
    fontSize: 11,
    fontWeight: '700',
  },
  screenShareBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  screenShareText: {
    color: '#C7D2FE',
    fontSize: 11,
    fontWeight: '700',
  },
});
