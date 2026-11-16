import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';

interface LocalPreviewProps {
  channel?: any;
  streamId?: string;
}

export function LocalPreview({ channel }: LocalPreviewProps) {
  const videoRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Initialize local camera feed
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
          audio: true,
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
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // 2. WebRTC P2P signaling to transmit camera to connected viewers
  useEffect(() => {
    if (!channel || !hasPermission) return;

    // Handle viewer request for live video stream
    const handleRequestStream = async ({ payload }: any) => {
      const viewerId = payload?.viewerId;
      if (!viewerId || !streamRef.current) return;

      // Close previous connection if any
      if (peersRef.current.has(viewerId)) {
        peersRef.current.get(viewerId)?.close();
        peersRef.current.delete(viewerId);
      }

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });
      peersRef.current.set(viewerId, pc);

      // Add local camera and mic tracks
      streamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, streamRef.current!);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          channel.send({
            type: 'broadcast',
            event: 'p2p_ice',
            payload: { targetId: viewerId, candidate: event.candidate },
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
        // Offer generation error handled
      }
    };

    // Handle viewer answer
    const handleAnswer = async ({ payload }: any) => {
      const { viewerId, answer } = payload || {};
      const pc = peersRef.current.get(viewerId);
      if (pc && pc.signalingState === 'have-local-offer') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
          // Set remote description handled
        }
      }
    };

    // Handle viewer ICE candidate
    const handleIceCandidate = async ({ payload }: any) => {
      const { targetId, candidate, fromId } = payload || {};
      if (targetId === 'creator' && fromId && candidate) {
        const pc = peersRef.current.get(fromId);
        if (pc && pc.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            // ICE candidate error handled
          }
        }
      }
    };

    channel.on('broadcast', { event: 'p2p_request_stream' }, handleRequestStream);
    channel.on('broadcast', { event: 'p2p_answer' }, handleAnswer);
    channel.on('broadcast', { event: 'p2p_ice' }, handleIceCandidate);
  }, [channel, hasPermission]);

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
