import React, { useRef, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';

export function RemoteStage() {
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<any>(null);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  return (
    <View style={styles.container}>
      {/* HTML5 video element for live stream player on web */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        loop
        src="https://vjs.zencdn.net/v/oceans.mp4"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        } as any}
      />

      {/* Floating Audio Toggle for Viewer */}
      <TouchableOpacity style={styles.muteButton} onPress={toggleMute}>
        <Text style={styles.muteText}>{isMuted ? '🔇 Unmute' : '🔊 Muted'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  muteButton: {
    position: 'absolute',
    top: 90,
    right: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 10,
  },
  muteText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
