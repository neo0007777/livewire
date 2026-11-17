import React, { useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTracks, TrackReference } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { VideoTrack, useLocalParticipant } from '@livekit/react-native';
import { VideoCameraOffIcon } from './Icons';
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

export function LocalPreview({
  isVideoMuted = false,
  isMicMuted = false,
  facingMode = 'user',
  isScreenSharing = false,
}: LocalPreviewProps) {
  const { localParticipant, cameraTrack, isCameraEnabled, lastCameraError } = useLocalParticipant();
  const tracks = useTracks([Track.Source.Camera]);
  const trackFromHook = tracks.find((t) => t.participant.isLocal);

  // Active camera initialization: ensure setCameraEnabled is triggered
  useEffect(() => {
    if (!localParticipant) return;

    if (!isCameraEnabled && !isVideoMuted) {
      localParticipant.setCameraEnabled(true).catch((err) => {
        console.warn('Failed to enable local camera:', err);
      });
    }
  }, [localParticipant, isCameraEnabled, isVideoMuted]);

  // Synchronize video mute state directly with hardware participant
  useEffect(() => {
    if (!localParticipant) return;
    localParticipant.setCameraEnabled(!isVideoMuted).catch((err) => {
      console.warn('Failed to update camera mute state:', err);
    });
  }, [localParticipant, isVideoMuted]);

  // Synchronize microphone mute state directly with hardware participant
  useEffect(() => {
    if (!localParticipant) return;
    localParticipant.setMicrophoneEnabled(!isMicMuted).catch((err) => {
      console.warn('Failed to update mic mute state:', err);
    });
  }, [localParticipant, isMicMuted]);

  // Synchronize screen share state
  useEffect(() => {
    if (!localParticipant) return;
    localParticipant.setScreenShareEnabled(isScreenSharing).catch((err) => {
      console.warn('Failed to update screen share state:', err);
    });
  }, [localParticipant, isScreenSharing]);

  // Handle hardware camera flip between front and back sensors
  useEffect(() => {
    if (!localParticipant || !cameraTrack?.track) return;
    const videoTrack = cameraTrack.track;

    if (typeof (videoTrack as any).restartTrack === 'function') {
      (videoTrack as any).restartTrack({ facingMode }).catch((err: any) => {
        console.warn('Failed to switch camera facingMode via restartTrack:', err);
      });
    } else if (typeof (videoTrack as any).mediaStreamTrack?._switchCamera === 'function') {
      (videoTrack as any).mediaStreamTrack._switchCamera();
    }
  }, [localParticipant, cameraTrack?.track, facingMode]);

  // Render paused overlay if camera is deliberately paused
  if (isVideoMuted) {
    return (
      <View style={styles.videoMutedOverlay}>
        <View style={styles.videoMutedCircle}>
          <VideoCameraOffIcon size={36} color="#EF4444" />
        </View>
        <Text style={styles.videoMutedTitle}>Camera is Paused</Text>
        <Text style={styles.videoMutedSubtitle}>Your video feed is hidden from all viewers</Text>
      </View>
    );
  }

  // Display actionable error screen if hardware access or permission failed
  if (lastCameraError) {
    return (
      <View style={styles.placeholder}>
        <View style={styles.errorIconCircle}>
          <VideoCameraOffIcon size={32} color="#EF4444" />
        </View>
        <Text style={styles.errorTitle}>Camera Access Required</Text>
        <Text style={styles.errorSubtitle}>
          {lastCameraError.message?.toLowerCase().includes('permission')
            ? 'Camera permission was denied. Please grant permission to start streaming.'
            : lastCameraError.message || 'Could not connect to camera hardware.'}
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={async () => {
            const granted = await requestBroadcastPermissions();
            if (granted && localParticipant) {
              localParticipant.setCameraEnabled(true).catch(console.warn);
            }
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.retryButtonText}>Grant Permissions & Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Resolve active track reference from hook or local participant publication
  const activeTrackRef: TrackReference | undefined =
    trackFromHook && trackFromHook.publication
      ? trackFromHook
      : cameraTrack && localParticipant
      ? {
          participant: localParticipant,
          publication: cameraTrack,
          source: Track.Source.Camera,
        }
      : undefined;

  if (!activeTrackRef || !activeTrackRef.publication) {
    return (
      <View style={styles.placeholder}>
        <ActivityIndicator size="large" color="#EF4444" style={styles.spinner} />
        <Text style={styles.placeholderText}>Initializing Camera...</Text>
        <Text style={styles.placeholderSubtext}>Connecting to camera hardware</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <VideoTrack
        trackRef={activeTrackRef}
        style={styles.video}
        mirror={facingMode === 'user'}
        objectFit="cover"
      />
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
    backgroundColor: '#070913',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  spinner: {
    marginBottom: 8,
  },
  placeholderText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  placeholderSubtext: {
    color: '#64748B',
    fontSize: 13,
  },
  errorIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  errorTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '800',
  },
  errorSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  videoMutedOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#070913',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  videoMutedCircle: {
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
  videoMutedTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
  },
  videoMutedSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
  },
});
