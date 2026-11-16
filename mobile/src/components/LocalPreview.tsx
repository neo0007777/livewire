import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useTracks } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { VideoTrack } from '@livekit/react-native';

interface LocalPreviewProps {
  channel?: any;
  streamId?: string;
}

export function LocalPreview(_props?: LocalPreviewProps) {
  const tracks = useTracks([Track.Source.Camera]);
  const localTrack = tracks.find((t) => t.participant.isLocal);

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
});
