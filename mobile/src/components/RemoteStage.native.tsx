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
import { THEME } from '../lib/theme';

interface RemoteStageProps {
  channel?: any;
  streamId?: string;
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

export function RemoteStage({ channel }: RemoteStageProps) {
  const [p2pStream, setP2pStream] = useState<MediaStream | null>(null);
  const [renderKey, setRenderKey] = useState(0);
  const [isCreatorVideoPaused, setIsCreatorVideoPaused] = useState(false);
  const [isCreatorMicMuted, setIsCreatorMicMuted] = useState(false);
  const [isCreatorScreenSharing, setIsCreatorScreenSharing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'idle'>('connecting');

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const isP2pConnectedRef = useRef(false);
  const pendingIceRef = useRef<RTCIceCandidate[]>([]);
  const viewerIdRef = useRef(Math.random().toString(36).slice(2, 9));

  // Initialize native audio session for audio playback on Android/iOS
  useEffect(() => {
    try {
      const { AudioSession } = require('@livekit/react-native');
      AudioSession.startAudioSession().then(() => {
        try {
          AudioSession.selectAudioOutput?.('speaker');
        } catch (e) {}
      }).catch((err: any) => {
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

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    pendingIceRef.current = [];

    // Track arrival: directly bind the native remote MediaStream!
    pc.ontrack = (event: any) => {
      if (!isMounted) return;
      isP2pConnectedRef.current = true;
      setConnectionStatus('connected');

      const stream = event.streams && event.streams[0];
      if (stream) {
        stream.getTracks().forEach((t: any) => {
          t.enabled = true;
          t.onunmute = () => {
            if (isMounted) setRenderKey((k) => k + 1);
          };
        });
        setP2pStream(stream);
        setRenderKey((k) => k + 1);
      } else if (event.track) {
        event.track.enabled = true;
        event.track.onunmute = () => {
          if (isMounted) setRenderKey((k) => k + 1);
        };
        const remoteStreams = (pc as any)._remoteStreams;
        if (remoteStreams && remoteStreams.size > 0) {
          const firstStream = Array.from(remoteStreams.values())[0] as MediaStream;
          firstStream.getTracks().forEach((t: any) => {
            t.enabled = true;
          });
          setP2pStream(firstStream);
          setRenderKey((k) => k + 1);
        }
      }
    };

    // Connection state listeners
    pc.onconnectionstatechange = () => {
      if (!isMounted) return;
      if (pc.connectionState === 'connected') {
        isP2pConnectedRef.current = true;
        setConnectionStatus('connected');
      } else if (pc.connectionState === 'failed') {
        setConnectionStatus('idle');
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (!isMounted) return;
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
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

        // Flush any ICE candidates received prior to offer description
        for (const cand of pendingIceRef.current) {
          await pc.addIceCandidate(cand).catch(() => {});
        }
        pendingIceRef.current = [];

        // Force native video surface refresh on renegotiation
        setRenderKey((k) => k + 1);
        setIsCreatorVideoPaused(false);
      } catch (err) {
        console.warn('[RemoteStage.native] Error handling P2P offer:', err);
      }
    };

    // Handle incoming ICE candidate from creator
    const handleIce = async ({ payload }: any) => {
      if (payload?.targetId === viewerId && payload?.candidate) {
        const candObj = payload.candidate;
        if (candObj && (candObj.sdpMid != null || candObj.sdpMLineIndex != null)) {
          try {
            const candidate = new RTCIceCandidate(candObj);
            if (pc.remoteDescription) {
              await pc.addIceCandidate(candidate);
            } else {
              pendingIceRef.current.push(candidate);
            }
          } catch (err) {
            console.warn('[RemoteStage.native] Error adding ICE candidate:', err);
          }
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

    // Handle creator camera flip event
    const handleCameraFlipped = () => {
      if (!isMounted) return;
      setIsCreatorVideoPaused(false);
      setRenderKey((k) => k + 1);

      // Force refresh track enabled states
      if (p2pStream) {
        p2pStream.getVideoTracks().forEach((t: any) => {
          t.enabled = true;
        });
      }

      // Re-request stream offer from creator to guarantee fresh keyframe
      channel.send({
        type: 'broadcast',
        event: 'p2p_request_stream',
        payload: { viewerId, forceRefresh: true },
      });
    };

    channel.on('broadcast', { event: 'p2p_offer' }, handleOffer);
    channel.on('broadcast', { event: 'p2p_ice' }, handleIce);
    channel.on('broadcast', { event: 'creator_media_state' }, handleMediaState);
    channel.on('broadcast', { event: 'camera_flipped' }, handleCameraFlipped);

    // Initial stream request
    channel.send({
      type: 'broadcast',
      event: 'p2p_request_stream',
      payload: { viewerId },
    });

    // Re-request stream periodically until connected
    const retryInterval = setInterval(() => {
      if (isP2pConnectedRef.current) {
        clearInterval(retryInterval);
        return;
      }
      if (isMounted && channel) {
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
      pendingIceRef.current = [];
    };
  }, [channel]);

  // If P2P stream is active, render native RTCView
  if (p2pStream) {
    return (
      <View style={styles.container}>
        <RTCView
          key={`remote-stage-view-${renderKey}-${p2pStream.toURL()}`}
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
    backgroundColor: THEME.bg,
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
    fontSize: 13,
  },
  micMutedBadge: {
    position: 'absolute',
    top: 96,
    left: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  micMutedText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  screenShareBadge: {
    position: 'absolute',
    top: 96,
    left: 14,
    backgroundColor: 'rgba(30, 27, 75, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.5)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  screenShareText: {
    color: '#C7D2FE',
    fontSize: 11,
    fontWeight: '700',
  },
});
