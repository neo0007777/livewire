import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, TouchableOpacity } from 'react-native';

interface RemoteStageProps {
  channel?: any;
  streamId?: string;
}

export function RemoteStage({ channel }: RemoteStageProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<any>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const isConnectedRef = useRef(false);
  const viewerIdRef = useRef(Math.random().toString(36).slice(2, 9));

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  useEffect(() => {
    if (!channel) return;

    let isMounted = true;
    const viewerId = viewerIdRef.current;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });
    pcRef.current = pc;

    // When remote camera/mic tracks arrive from creator
    pc.ontrack = (event) => {
      if (!isMounted) return;
      if (event.streams && event.streams[0]) {
        if (videoRef.current) {
          videoRef.current.srcObject = event.streams[0];
          videoRef.current.play().catch(() => {});
        }
        isConnectedRef.current = true;
        setIsConnected(true);
      }
    };

    // Forward ICE candidates to creator
    pc.onicecandidate = (event) => {
      if (event.candidate && channel) {
        channel.send({
          type: 'broadcast',
          event: 'p2p_ice',
          payload: { targetId: 'creator', fromId: viewerId, candidate: event.candidate },
        });
      }
    };

    // Handle creator offer
    const handleOffer = async ({ payload }: any) => {
      if (payload?.targetId !== viewerId || !payload?.offer) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        channel.send({
          type: 'broadcast',
          event: 'p2p_answer',
          payload: { viewerId, answer },
        });
      } catch (err) {
        // Offer handle error
      }
    };

    // Handle ICE from creator
    const handleIce = async ({ payload }: any) => {
      if (payload?.targetId === viewerId && payload?.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch (err) {
          // ICE add error
        }
      }
    };

    channel.on('broadcast', { event: 'p2p_offer' }, handleOffer);
    channel.on('broadcast', { event: 'p2p_ice' }, handleIce);

    // Ping creator to request stream
    const requestStream = () => {
      if (!isConnectedRef.current && channel) {
        channel.send({
          type: 'broadcast',
          event: 'p2p_request_stream',
          payload: { viewerId },
        });
      }
    };

    requestStream();
    const interval = setInterval(requestStream, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  }, [channel]);

  return (
    <View style={styles.container}>
      {/* HTML5 video element rendering the broadcaster's real camera feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isMuted}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: isConnected ? 'block' : 'none',
        } as any}
      />

      {/* Connecting state */}
      {!isConnected && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#818CF8" />
          <Text style={styles.loadingTitle}>Connecting to live broadcast...</Text>
          <Text style={styles.loadingSubtitle}>Establishing live video stream with creator</Text>
        </View>
      )}

      {/* Floating Audio Toggle for Viewer */}
      {isConnected && (
        <TouchableOpacity style={styles.muteButton} onPress={toggleMute}>
          <Text style={styles.muteText}>{isMuted ? '🔇 Unmute' : '🔊 Audio On'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0A0A0A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  loadingTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  loadingSubtitle: {
    color: '#9CA3AF',
    fontSize: 13,
    textAlign: 'center',
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
