import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';

export function LocalPreview() {
  const videoRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function startCamera() {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setHasPermission(false);
        setErrorMsg('Webcam not supported in this browser');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setHasPermission(true);
      } catch (err: any) {
        if (isMounted) {
          setHasPermission(false);
          setErrorMsg(err.name === 'NotAllowedError' ? 'Camera access denied by browser' : 'Camera device not accessible');
        }
      }
    }

    startCamera();

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      {/* HTML5 video element for live browser webcam preview */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scaleX(-1)',
          display: hasPermission ? 'block' : 'none',
        } as any}
      />

      {hasPermission === false && (
        <View style={styles.fallbackContainer}>
          <Text style={styles.icon}>📷</Text>
          <Text style={styles.text}>{errorMsg || 'Camera unavailable'}</Text>
          <Text style={styles.subtext}>Please grant camera permission in your browser URL bar</Text>
        </View>
      )}

      {hasPermission === null && (
        <View style={styles.fallbackContainer}>
          <ActivityIndicator size="large" color="#EF4444" />
          <Text style={styles.subtext}>Starting camera...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  fallbackContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    padding: 24,
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
