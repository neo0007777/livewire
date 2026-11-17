import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import {
  mediaDevices,
  RTCView,
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  MediaStream,
} from '@livekit/react-native-webrtc';
import { VideoCameraOffIcon, FlipCameraIcon } from './Icons';
import { requestBroadcastPermissions } from '../lib/permissions';

interface LocalPreviewProps {
  channel?: any;
  streamId?: string;
  isMicMuted?: boolean;
  isVideoMuted?: boolean;
  facingMode?: 'user' | 'environment';
  isScreenSharing?: boolean;
  onScreenShareChange?: (isSharing: boolean) => void;
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

export function LocalPreview({
  channel,
  isVideoMuted = false,
  isMicMuted = false,
  facingMode = 'user',
}: LocalPreviewProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidate[]>>(new Map());
  const peerCreationTimeRef = useRef<Map<string, number>>(new Map());
  const currentFacingRef = useRef<'user' | 'environment'>(facingMode);

  // Start native AudioSession on host to initialize Android AudioManager and hardware microphone
  useEffect(() => {
    try {
      const { AudioSession } = require('@livekit/react-native');
      AudioSession.startAudioSession().catch((err: any) => {
        console.warn('[LocalPreview.native] AudioSession start error on host:', err);
      });

      return () => {
        try {
          AudioSession.stopAudioSession().catch(() => {});
        } catch (e) {}
      };
    } catch (e) {}
  }, []);

  // Initialize native Camera & Microphone directly via WebRTC mediaDevices
  const initHardwareCamera = useCallback(async (facing: 'user' | 'environment') => {
    setIsInitializing(true);
    setPermissionDenied(false);

    try {
      const granted = await requestBroadcastPermissions();
      if (!granted) {
        setPermissionDenied(true);
        setIsInitializing(false);
        return;
      }

      // Stop previous tracks to prevent hardware camera lock
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      let stream: MediaStream | null = null;
      // Prioritize preserving audio across all video resolutions; only fallback to video-only if audio is completely blocked
      const constraintTiers = [
        { video: { facingMode: facing, width: 1280, height: 720 }, audio: true },
        { video: { facingMode: facing, width: 640, height: 480 }, audio: true },
        { video: { facingMode: facing }, audio: true },
        { video: true, audio: true },
        { video: { facingMode: facing, width: 1280, height: 720 }, audio: false },
        { video: { facingMode: facing, width: 640, height: 480 }, audio: false },
        { video: { facingMode: facing }, audio: false },
        { video: true, audio: false },
      ];

      for (const constraints of constraintTiers) {
        try {
          stream = (await mediaDevices.getUserMedia(constraints)) as MediaStream;
          if (stream && stream.getVideoTracks().length > 0) {
            break;
          }
        } catch (e) {
          // Attempt next resolution/audio tier
        }
      }

      if (!stream || stream.getVideoTracks().length === 0) {
        throw new Error('Device camera hardware is unavailable');
      }

      // If audio track is missing from camera stream, acquire microphone explicitly
      if (stream.getAudioTracks().length === 0) {
        try {
          const audioStream = (await mediaDevices.getUserMedia({ audio: true })) as MediaStream;
          const audioTrack = audioStream.getAudioTracks()[0];
          if (audioTrack) {
            stream.addTrack(audioTrack);
          }
        } catch (e) {
          console.warn('[LocalPreview.native] Secondary audio capture error:', e);
        }
      }

      // Apply initial mute states
      stream.getVideoTracks().forEach((t) => {
        t.enabled = !isVideoMuted;
      });
      stream.getAudioTracks().forEach((t) => {
        t.enabled = !isMicMuted;
      });

      streamRef.current = stream;
      setLocalStream(stream);
      setIsInitializing(false);
      currentFacingRef.current = facing;
    } catch (err) {
      console.warn('[LocalPreview.native] Camera initialization error:', err);
      setPermissionDenied(true);
      setIsInitializing(false);
    }
  }, [isVideoMuted, isMicMuted]);

  useEffect(() => {
    initHardwareCamera(facingMode);

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
      pendingIceRef.current.clear();
      peerCreationTimeRef.current.clear();
    };
  }, []);

  // Handle camera flip when prop changes
  useEffect(() => {
    if (currentFacingRef.current !== facingMode && streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack && (videoTrack as any)._switchCamera) {
        (videoTrack as any)._switchCamera();
        currentFacingRef.current = facingMode;
      } else {
        initHardwareCamera(facingMode);
      }
    }
  }, [facingMode, initHardwareCamera]);

  // Handle mute toggles on active stream tracks
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = !isVideoMuted;
      });
    }
  }, [isVideoMuted]);

  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !isMicMuted;
      });
    }
  }, [isMicMuted]);

  // WebRTC P2P direct transmission to viewers (mobile or web) via Supabase Realtime channel
  useEffect(() => {
    if (!channel || !localStream) return;

    const handleRequestStream = async ({ payload }: any) => {
      const viewerId = payload?.viewerId;
      if (!viewerId) return;

      const existingPc = peersRef.current.get(viewerId);
      const createdTime = peerCreationTimeRef.current.get(viewerId) || 0;
      const ageMs = Date.now() - createdTime;

      // Avoid tearing down existing connection if already active or negotiating
      if (existingPc) {
        if (
          existingPc.connectionState === 'connected' ||
          existingPc.iceConnectionState === 'connected'
        ) {
          return;
        }
        // If connection was created less than 15 seconds ago and hasn't failed, keep negotiating!
        if (
          existingPc.connectionState !== 'failed' &&
          existingPc.iceConnectionState !== 'failed' &&
          existingPc.connectionState !== 'closed' &&
          ageMs < 15000
        ) {
          // If still waiting for answer and more than 2 seconds elapsed, re-send the offer
          if (existingPc.signalingState === 'have-local-offer' && ageMs > 2000 && existingPc.localDescription) {
            channel.send({
              type: 'broadcast',
              event: 'p2p_offer',
              payload: { targetId: viewerId, offer: existingPc.localDescription },
            });
          }
          return;
        }
        existingPc.close();
        peersRef.current.delete(viewerId);
        pendingIceRef.current.delete(viewerId);
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peersRef.current.set(viewerId, pc);
      peerCreationTimeRef.current.set(viewerId, Date.now());
      pendingIceRef.current.set(viewerId, []);

      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });

      pc.onicecandidate = (event: any) => {
        if (event.candidate && channel) {
          channel.send({
            type: 'broadcast',
            event: 'p2p_ice',
            payload: { targetId: viewerId, fromId: 'creator', candidate: event.candidate },
          });
        }
      };

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        channel.send({
          type: 'broadcast',
          event: 'p2p_offer',
          payload: { targetId: viewerId, offer },
        });
      } catch (err) {
        console.warn('[LocalPreview.native] Error creating P2P offer:', err);
      }
    };

    const handleAnswer = async ({ payload }: any) => {
      const viewerId = payload?.viewerId;
      const pc = peersRef.current.get(viewerId);
      if (pc && payload?.answer) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
          // Flush any pending ICE candidates received before answer
          const pending = pendingIceRef.current.get(viewerId) || [];
          for (const cand of pending) {
            await pc.addIceCandidate(cand).catch(() => {});
          }
          pendingIceRef.current.set(viewerId, []);
        } catch (err) {
          console.warn('[LocalPreview.native] Error setting P2P remote description:', err);
        }
      }
    };

    const handleIce = async ({ payload }: any) => {
      if (payload?.targetId === 'creator' && payload?.candidate) {
        const viewerId = payload?.fromId;
        const pc = peersRef.current.get(viewerId);
        const candObj = payload.candidate;
        if (pc && (candObj.sdpMid != null || candObj.sdpMLineIndex != null)) {
          try {
            const candidate = new RTCIceCandidate(candObj);
            if (pc.remoteDescription) {
              await pc.addIceCandidate(candidate);
            } else {
              const pending = pendingIceRef.current.get(viewerId) || [];
              pending.push(candidate);
              pendingIceRef.current.set(viewerId, pending);
            }
          } catch (err) {
            console.warn('[LocalPreview.native] Error adding P2P ICE candidate:', err);
          }
        }
      }
    };

    channel.on('broadcast', { event: 'p2p_request_stream' }, handleRequestStream);
    channel.on('broadcast', { event: 'p2p_answer' }, handleAnswer);
    channel.on('broadcast', { event: 'p2p_ice' }, handleIce);

    return () => {
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
      pendingIceRef.current.clear();
      peerCreationTimeRef.current.clear();
    };
  }, [channel, localStream]);

  if (permissionDenied) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorIconCircle}>
          <VideoCameraOffIcon size={36} color="#EF4444" />
        </View>
        <Text style={styles.errorTitle}>Camera Permission Required</Text>
        <Text style={styles.errorSubtitle}>
          LiveWire needs access to your camera and microphone to broadcast live video.
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => initHardwareCamera(facingMode)}
          activeOpacity={0.8}
        >
          <Text style={styles.retryButtonText}>Grant Permissions & Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isVideoMuted) {
    return (
      <View style={styles.mutedContainer}>
        <View style={styles.mutedIconCircle}>
          <VideoCameraOffIcon size={40} color="#EF4444" />
        </View>
        <Text style={styles.mutedText}>Camera is Muted</Text>
        <Text style={styles.mutedSubtext}>Audio is still streaming to your viewers</Text>
      </View>
    );
  }

  if (isInitializing || !localStream) {
    return (
      <View style={styles.container}>
        <View style={styles.initializingContainer}>
          <ActivityIndicator size="large" color="#EF4444" style={{ marginBottom: 12 }} />
          <Text style={styles.initializingText}>Initializing Camera...</Text>
          <Text style={styles.initializingSub}>Accessing hardware sensor...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <RTCView
        streamURL={localStream.toURL()}
        style={StyleSheet.absoluteFill}
        objectFit="cover"
        mirror={facingMode === 'user'}
        zOrder={0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#070913',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initializingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  initializingText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  initializingSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
  mutedContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#070913',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  mutedIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  mutedText: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  mutedSubtext: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
  },
  errorContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#070913',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  errorTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
