import React from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { useTracks } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { VideoTrack } from '@livekit/react-native';

export function RemoteStage() {
  const tracks = useTracks([Track.Source.Camera]);
  const remoteTrack = tracks.find((t) => !t.participant.isLocal);

  if (!remoteTrack || !remoteTrack.publication) {
    return (
      <View style={styles.placeholder}>
        <ActivityIndicator size="large" color="#818CF8" style={{ marginBottom: 16 }} />
        <Text style={styles.placeholderTitle}>Connecting to Live Broadcast...</Text>
        <Text style={styles.placeholderSub}>Waiting for video feed</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <VideoTrack trackRef={remoteTrack} style={styles.video} />
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
    fontWeight: '600',
    marginBottom: 6,
  },
  placeholderSub: {
    color: '#9CA3AF',
    fontSize: 13,
  },
});
