import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useTracks } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { VideoTrack } from '@livekit/react-native';
import { VideoCameraOffIcon } from './Icons';

interface LocalPreviewProps {
  channel?: any;
  streamId?: string;
  isMicMuted?: boolean;
  isVideoMuted?: boolean;
  facingMode?: 'user' | 'environment';
  isScreenSharing?: boolean;
  onScreenShareChange?: (isSharing: boolean) => void;
}

export function LocalPreview({ isVideoMuted = false }: LocalPreviewProps) {
  const tracks = useTracks([Track.Source.Camera]);
  const localTrack = tracks.find((t) => t.participant.isLocal);

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

  if (!localTrack || !localTrack.publication) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Initializing Camera...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <VideoTrack trackRef={localTrack} style={styles.video} mirror={true} />
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
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#9CA3AF',
    fontSize: 16,
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
  videoMutedEmoji: {
    fontSize: 36,
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
