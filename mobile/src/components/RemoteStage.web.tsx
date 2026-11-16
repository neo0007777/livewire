import React from 'react';
import { View, StyleSheet, Text } from 'react-native';

export function RemoteStage() {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>📺</Text>
      <Text style={styles.text}>Live Stream Player</Text>
      <Text style={styles.subtext}>Web Preview Mode (Native WebRTC runs on Android)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    fontSize: 48,
  },
  text: {
    color: '#F3F4F6',
    fontSize: 16,
    fontWeight: '700',
  },
  subtext: {
    color: '#9CA3AF',
    fontSize: 12,
  },
});
