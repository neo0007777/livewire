import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, Platform } from 'react-native';
import { useTracks } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { VideoTrack, AudioSession } from '@livekit/react-native';
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
  // 1. LiveKit SFU Cloud Track subscription (Camera & ScreenShare)
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare]);
  const liveKitTrack = tracks.find((t) => !t.participant.isLocal);

  // 2. WebRTC P2P Mesh state (for cross-platform compatibility with web broadcasters)
  const [p2pStream, setP2pStream] = useState<MediaStream | null>(null);
  const [isCreatorVideoPaused, setIsCreatorVideoPaused] = useState(false);
  const [isCreatorMicMuted, setIsCreatorMicMuted] = useState(false);
  const [isCreatorScreenSharing, setIsCreatorScreenSharing] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const isP2pConnectedRef = useRef(false);
  const viewerIdRef = useRef(Math.random().toString(36).slice(2, 9));

  // Initialize native audio session for audio playback on Android/iOS
  useEffect(() => {
    if (Platform.OS !== 'web') {
      AudioSession.startAudioSession().catch((err) => {
        console.warn('AudioSession start error on viewer:', err);
      });
    }

    return () => {
      if (Platform.OS !== 'web') {
        AudioSession.stopAudioSession().catch((err) => {
          console.warn('AudioSession stop error on viewer:', err);
        });
      }
    };
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
        console.warn('Error handling P2P offer:', err);
      }
    };

    // Handle incoming ICE candidate from creator
    const handleIce = async ({ payload }: any) => {
      if (payload?.targetId === viewerId && payload?.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch (err) {
          console.warn('Error adding ICE candidate:', err);
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

    // Request stream from broadcaster every 2 seconds until video arrives
    const requestStream = () => {
      if (!isP2pConnectedRef.current && !liveKitTrack && channel) {
        channel.send({
          type: 'broadcast',
          event: 'p2p_request_stream',
          payload: { viewerId },
        });
      }
    };

    requestStream();
    const interval = setInterval(requestStream, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  }, [channel, liveKitTrack]);

  // If creator has paused their camera
  if (isCreatorVideoPaused) {
    return (
      <View style={styles.pausedOverlay}>
        <View style={styles.pausedIconCircle}>
          <VideoCameraOffIcon size={36} color="#EF4444" />
        </View>
        <Text style={styles.pausedTitle}>Creator Paused Camera</Text>
        <Text style={styles.pausedSubtitle}>Broadcast will resume in a moment</Text>
      </View>
    );
  }

  // Priority 1: LiveKit SFU Cloud video track (native mobile broadcaster)
  if (liveKitTrack && liveKitTrack.publication) {
    return (
      <View style={styles.container}>
        <VideoTrack trackRef={liveKitTrack} style={styles.video} objectFit="cover" />
      </View>
    );
  }

  // Priority 2: WebRTC P2P direct stream (web / cross-platform broadcaster)
  if (p2pStream) {
    return (
      <View style={styles.container}>
        <RTCView
          streamURL={p2pStream.toURL()}
          style={styles.video}
          objectFit="cover"
        />

        {/* Floating Screen Share Badge */}
        {isCreatorScreenSharing && (
          <View style={styles.screenShareBadge}>
            <ScreenShareIcon size={13} color="#818CF8" />
            <Text style={styles.screenShareBadgeText}>Creator Screen Share</Text>
          </View>
        )}

        {/* Floating Creator Mic Muted Alert */}
        {isCreatorMicMuted && (
          <View style={styles.micMutedAlert}>
            <MicMutedIcon size={12} color="#FFF" />
            <Text style={styles.micMutedAlertText}>Creator Mic Muted</Text>
          </View>
        )}
      </View>
    );
  }

  // Waiting for video feed placeholder
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
  },
  video: {
    ...StyleSheet.absoluteFill,
  },
  placeholder: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0B0F19',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  placeholderTitle: {
    color: '#F3F4F6',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  placeholderSub: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  pausedOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#070913',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  pausedIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  pausedTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
  },
  pausedSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
  },
  screenShareBadge: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    backgroundColor: 'rgba(30, 27, 75, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  screenShareBadgeText: {
    color: '#C7D2FE',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  micMutedAlert: {
    position: 'absolute',
    top: 120,
    alignSelf: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  micMutedAlertText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
});
