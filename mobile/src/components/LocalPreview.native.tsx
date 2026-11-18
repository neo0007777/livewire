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
import { VideoCameraOffIcon, FlipCameraIcon, ScreenShareIcon } from './Icons';
import { requestBroadcastPermissions } from '../lib/permissions';
import { THEME } from '../lib/theme';

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
  streamId,
  isVideoMuted = false,
  isMicMuted = false,
  facingMode = 'user',
  isScreenSharing = false,
  onScreenShareChange,
}: LocalPreviewProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraVideoTrackRef = useRef<any>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidate[]>>(new Map());
  const peerCreationTimeRef = useRef<Map<string, number>>(new Map());
  const currentFacingRef = useRef<'user' | 'environment'>(facingMode);
  const isSwitchingRef = useRef(false);

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
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
      }
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

  // Dedicated helper to switch camera hardware without breaking peer connections
  const switchCameraFacing = useCallback(async (targetFacing: 'user' | 'environment') => {
    if (isScreenSharing || isSwitchingRef.current) return;
    isSwitchingRef.current = true;

    try {
      // 1. Enumerate available video devices
      const devices = (await mediaDevices.enumerateDevices()) as any[];
      const videoDevices = Array.isArray(devices) ? devices.filter((d) => d.kind === 'videoinput') : [];

      // Find the specific camera matching the desired facing mode
      let targetDevice: any = null;
      if (targetFacing === 'environment') {
        targetDevice =
          videoDevices.find((d) => d.facing === 'environment' || d.facing === 'back') ||
          videoDevices.find((d) => d.facing !== 'front' && d.facing !== 'user') ||
          (videoDevices.length > 1 ? videoDevices[0] : null);
      } else {
        targetDevice =
          videoDevices.find((d) => d.facing === 'front' || d.facing === 'user') ||
          (videoDevices.length > 1 ? videoDevices[1] : videoDevices[0]);
      }

      // 2. Stop old video track to release Android hardware camera
      const oldVideoTrack = streamRef.current?.getVideoTracks()[0];
      if (oldVideoTrack) {
        oldVideoTrack.stop();
        streamRef.current?.removeTrack(oldVideoTrack);
        // Small delay to ensure Android camera HAL releases the sensor lock
        await new Promise((r) => setTimeout(r, 60));
      }

      // 3. Acquire new camera stream with target facing/deviceId
      let newStream: MediaStream | null = null;
      const candidateConstraints = [
        targetDevice?.deviceId
          ? { video: { deviceId: { exact: targetDevice.deviceId }, width: 1280, height: 720 }, audio: false }
          : null,
        targetDevice?.deviceId
          ? { video: { deviceId: targetDevice.deviceId }, audio: false }
          : null,
        { video: { facingMode: targetFacing, width: 1280, height: 720 }, audio: false },
        { video: { facingMode: targetFacing, width: 640, height: 480 }, audio: false },
        { video: { facingMode: targetFacing }, audio: false },
        { video: true, audio: false },
      ].filter(Boolean);

      for (const c of candidateConstraints) {
        try {
          newStream = (await mediaDevices.getUserMedia(c as any)) as MediaStream;
          if (newStream && newStream.getVideoTracks().length > 0) {
            break;
          }
        } catch (e) {
          // Fall through to next constraint tier
        }
      }

      if (!newStream || newStream.getVideoTracks().length === 0) {
        throw new Error('Could not acquire camera for facing: ' + targetFacing);
      }

      const newVideoTrack = newStream.getVideoTracks()[0];
      newVideoTrack.enabled = !isVideoMuted;

      // 4. Preserve existing microphone audio track
      const audioTrack = streamRef.current?.getAudioTracks()[0];
      if (audioTrack) {
        newStream.addTrack(audioTrack);
      }

      // 5. Replace video track on all active viewer peer connections seamlessly without renegotiation
      for (const [viewerId, pc] of peersRef.current.entries()) {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender && newVideoTrack) {
          try {
            await sender.replaceTrack(newVideoTrack);
          } catch (err) {
            console.warn('[LocalPreview.native] replaceTrack error for viewer:', viewerId, err);
          }
        }
      }

      // 6. Broadcast camera_flipped event so all viewers unpause and update mirroring
      if (channel) {
        channel.send({
          type: 'broadcast',
          event: 'camera_flipped',
          payload: { facing: targetFacing, timestamp: Date.now() },
        });
      }

      // 7. Update local stream reference and trigger state update
      streamRef.current = newStream;
      setLocalStream(newStream);
      currentFacingRef.current = targetFacing;
    } catch (err) {
      console.warn('[LocalPreview.native] switchCameraFacing error:', err);
    } finally {
      isSwitchingRef.current = false;
    }
  }, [isScreenSharing, isVideoMuted]);

  // Handle camera flip when facingMode prop changes
  useEffect(() => {
    if (currentFacingRef.current !== facingMode && !isScreenSharing) {
      switchCameraFacing(facingMode);
    }
  }, [facingMode, isScreenSharing, switchCameraFacing]);

  // Handle native Screen Share toggle
  useEffect(() => {
    let isCancelled = false;

    async function handleScreenShareToggle() {
      if (isScreenSharing) {
        try {
          // In @livekit/react-native-webrtc, getDisplayMedia starts Android MediaProjection
          const displayStream = (await (mediaDevices as any).getDisplayMedia()) as MediaStream;

          if (isCancelled) {
            displayStream.getTracks().forEach((t) => t.stop());
            return;
          }

          const screenTrack = displayStream.getVideoTracks()[0];
          if (!screenTrack) {
            onScreenShareChange?.(false);
            return;
          }

          screenStreamRef.current = displayStream;

          // Android system notification "Stop recording" handler
          screenTrack.onended = () => {
            onScreenShareChange?.(false);
          };

          if (streamRef.current) {
            const currentVideo = streamRef.current.getVideoTracks()[0];
            if (currentVideo) {
              cameraVideoTrackRef.current = currentVideo;
              streamRef.current.removeTrack(currentVideo);
            }
            streamRef.current.addTrack(screenTrack);

            peersRef.current.forEach((pc) => {
              const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
              if (sender) {
                sender.replaceTrack(screenTrack).catch(() => {});
              }
            });

            setLocalStream(streamRef.current);
          }
        } catch (err) {
          console.warn('[LocalPreview.native] Screen share error / cancelled:', err);
          onScreenShareChange?.(false);
        }
      } else {
        // Revert to camera feed
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach((t) => t.stop());
          screenStreamRef.current = null;
        }

        const cameraTrack = cameraVideoTrackRef.current;
        if (cameraTrack && streamRef.current) {
          const currentTrack = streamRef.current.getVideoTracks()[0];
          if (currentTrack) {
            streamRef.current.removeTrack(currentTrack);
          }
          cameraTrack.enabled = !isVideoMuted;
          streamRef.current.addTrack(cameraTrack);

          peersRef.current.forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) {
              sender.replaceTrack(cameraTrack).catch(() => {});
            }
          });

          setLocalStream(streamRef.current);
        }
      }
    }

    handleScreenShareToggle();

    return () => {
      isCancelled = true;
    };
  }, [isScreenSharing]);

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
    if (!channel) return;

    const handleRequestStream = async ({ payload }: any) => {
      const viewerId = payload?.viewerId;
      if (!viewerId) return;

      const existingPc = peersRef.current.get(viewerId);
      const createdTime = peerCreationTimeRef.current.get(viewerId) || 0;
      const ageMs = Date.now() - createdTime;

      // Handle explicit stream refresh request (e.g. from viewer after camera flip)
      if (existingPc && payload?.forceRefresh) {
        try {
          if (existingPc.signalingState === 'stable') {
            const offer = await existingPc.createOffer();
            await existingPc.setLocalDescription(offer);
            channel.send({
              type: 'broadcast',
              event: 'p2p_offer',
              payload: { targetId: viewerId, offer },
            });
          }
        } catch (e) {
          console.warn('[LocalPreview.native] forceRefresh offer error:', e);
        }
        return;
      }

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

      const activeStream = streamRef.current;
      if (!activeStream) return;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peersRef.current.set(viewerId, pc);
      peerCreationTimeRef.current.set(viewerId, Date.now());
      pendingIceRef.current.set(viewerId, []);

      activeStream.getTracks().forEach((track) => {
        track.enabled = track.kind === 'video' ? !isVideoMuted : !isMicMuted;
        pc.addTrack(track, activeStream);
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
  }, [channel]);

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
        objectFit={isScreenSharing ? 'contain' : 'cover'}
        mirror={!isScreenSharing && facingMode === 'user'}
        zOrder={0}
      />
      {isScreenSharing && (
        <View style={styles.screenShareBadge}>
          <ScreenShareIcon size={13} color="#818CF8" />
          <Text style={styles.screenShareBadgeText}>Sharing Your Screen Live</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: THEME.bg,
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
    backgroundColor: THEME.bg,
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
    backgroundColor: THEME.bg,
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
  screenShareBadge: {
    position: 'absolute',
    top: 146,
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
});
