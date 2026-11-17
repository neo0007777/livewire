import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { VideoCameraOffIcon, VideoCameraIcon, MicMutedIcon } from './Icons';

interface LocalPreviewProps {
  channel?: any;
  streamId?: string;
  isMicMuted?: boolean;
  isVideoMuted?: boolean;
  facingMode?: 'user' | 'environment';
}

export function LocalPreview({
  channel,
  isMicMuted = false,
  isVideoMuted = false,
  facingMode = 'user',
}: LocalPreviewProps) {
  const videoRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Initialize local webcam and mic
  useEffect(() => {
    let isMounted = true;

    async function startCamera() {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setHasPermission(false);
        setErrorMsg('Webcam not supported in this browser');
        return;
      }

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
      } catch (err: any) {
        // Fallback to video only if audio request fails
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          });
        } catch (videoErr: any) {
          if (isMounted) {
            setHasPermission(false);
            setErrorMsg(
              videoErr.name === 'NotAllowedError'
                ? 'Camera access denied by browser'
                : 'Camera device not accessible'
            );
          }
          return;
        }
      }

      if (!isMounted) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }

      if (stream) {
        // Apply initial mute states
        stream.getAudioTracks().forEach((t) => (t.enabled = !isMicMuted));
        stream.getVideoTracks().forEach((t) => (t.enabled = !isVideoMuted));

        streamRef.current = stream;
        setLocalStream(stream);
        setHasPermission(true);
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

  // 2. Handle Microphone Mute/Unmute
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !isMicMuted;
      });
    }
  }, [isMicMuted]);

  // 3. Handle Video Camera Mute/Unmute
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !isVideoMuted;
      });
    }
  }, [isVideoMuted]);

  // 4. Handle Camera Flip (front / environment)
  useEffect(() => {
    if (!hasPermission) return;

    let isCurrent = true;
    async function switchCamera() {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });

        if (!isCurrent) {
          newStream.getTracks().forEach((t) => t.stop());
          return;
        }

        const newVideoTrack = newStream.getVideoTracks()[0];
        if (newVideoTrack && streamRef.current) {
          const oldVideoTrack = streamRef.current.getVideoTracks()[0];
          if (oldVideoTrack) {
            oldVideoTrack.stop();
            streamRef.current.removeTrack(oldVideoTrack);
          }
          newVideoTrack.enabled = !isVideoMuted;
          streamRef.current.addTrack(newVideoTrack);

          // Update active WebRTC peer connections
          peersRef.current.forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) {
              sender.replaceTrack(newVideoTrack).catch(() => {});
            }
          });

          if (videoRef.current) {
            videoRef.current.srcObject = streamRef.current;
          }
        }
      } catch (err) {
        // Device might not have secondary camera (e.g. laptop desktop), ignore
      }
    }

    switchCamera();
    return () => {
      isCurrent = false;
    };
  }, [facingMode]);

  // Bind local stream to video element
  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
      videoRef.current.play().catch(() => {});
    }
  }, [localStream]);

  // 5. WebRTC P2P signaling to transmit camera to connected viewers
  useEffect(() => {
    if (!channel) return;

    // Handle viewer request for live video stream
    const handleRequestStream = async ({ payload }: any) => {
      const viewerId = payload?.viewerId;
      if (!viewerId || !streamRef.current) return;

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

      // Add local tracks (with mute state preserved)
      streamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, streamRef.current!);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate && channel) {
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
        // Offer generation error
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
          // Handled
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
            // Handled
          }
        }
      }
    };

    channel.on('broadcast', { event: 'p2p_request_stream' }, handleRequestStream);
    channel.on('broadcast', { event: 'p2p_answer' }, handleAnswer);
    channel.on('broadcast', { event: 'p2p_ice' }, handleIceCandidate);
  }, [channel]);

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
          transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
          display: hasPermission && !isVideoMuted ? 'block' : 'none',
        } as any}
      />

      {/* Video Muted Overlay */}
      {hasPermission && isVideoMuted && (
        <View style={styles.videoMutedOverlay}>
          <View style={styles.videoMutedCircle}>
            <VideoCameraOffIcon size={36} color="#EF4444" />
          </View>
          <Text style={styles.videoMutedTitle}>Camera is Paused</Text>
          <Text style={styles.videoMutedSubtitle}>Your video feed is hidden from all viewers</Text>
        </View>
      )}

      {/* Mic Muted floating alert */}
      {hasPermission && isMicMuted && (
        <View style={styles.micMutedAlert}>
          <MicMutedIcon size={12} color="#FFF" />
          <Text style={styles.micMutedAlertText}>Microphone Muted</Text>
        </View>
      )}

      {hasPermission === false && (
        <View style={styles.fallbackContainer}>
          <View style={styles.fallbackIconCircle}>
            <VideoCameraIcon size={32} color="#94A3B8" />
          </View>
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
  micMutedAlert: {
    position: 'absolute',
    top: 150,
    alignSelf: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  micMutedAlertText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  fallbackContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    padding: 24,
  },
  fallbackIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
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
