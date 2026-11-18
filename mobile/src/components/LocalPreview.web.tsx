import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { VideoCameraOffIcon, VideoCameraIcon, MicMutedIcon, ScreenShareIcon } from './Icons';

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
  channel,
  isMicMuted = false,
  isVideoMuted = false,
  facingMode = 'user',
  isScreenSharing = false,
  onScreenShareChange,
}: LocalPreviewProps) {
  const videoRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidate[]>>(new Map());
  const peerCreationTimeRef = useRef<Map<string, number>>(new Map());
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

        cameraVideoTrackRef.current = stream.getVideoTracks()[0] || null;
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
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
      }
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
    if (!hasPermission || isScreenSharing) return;

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
          cameraVideoTrackRef.current = newVideoTrack;
          const oldVideoTrack = streamRef.current.getVideoTracks()[0];
          if (oldVideoTrack) {
            oldVideoTrack.stop();
            streamRef.current.removeTrack(oldVideoTrack);
          }
          newVideoTrack.enabled = !isVideoMuted;
          streamRef.current.addTrack(newVideoTrack);

          // Update active WebRTC peer connections and renegotiate offer
          peersRef.current.forEach(async (pc, viewerId) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) {
              await sender.replaceTrack(newVideoTrack).catch(() => {});
            }
            try {
              if (pc.signalingState === 'stable') {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                channel?.send({
                  type: 'broadcast',
                  event: 'p2p_offer',
                  payload: { targetId: viewerId, offer },
                });
              }
            } catch (e) {}
          });

          if (channel) {
            channel.send({
              type: 'broadcast',
              event: 'camera_flipped',
              payload: { facing: facingMode, timestamp: Date.now() },
            });
          }

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

  // 5. Handle Broadcaster Screen Sharing
  useEffect(() => {
    let isCancelled = false;

    async function handleScreenShareToggle() {
      if (isScreenSharing) {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
          onScreenShareChange?.(false);
          return;
        }

        try {
          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false,
          });

          if (isCancelled) {
            displayStream.getTracks().forEach((t) => t.stop());
            return;
          }

          const screenTrack = displayStream.getVideoTracks()[0];
          if (!screenTrack) {
            onScreenShareChange?.(false);
            return;
          }

          screenStreamRef.current = displayStream;

          // Native browser "Stop Sharing" button listener
          screenTrack.onended = () => {
            onScreenShareChange?.(false);
          };

          if (streamRef.current) {
            const currentVideo = streamRef.current.getVideoTracks()[0];
            if (currentVideo) {
              streamRef.current.removeTrack(currentVideo);
            }
            streamRef.current.addTrack(screenTrack);

            peersRef.current.forEach((pc) => {
              const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
              if (sender) {
                sender.replaceTrack(screenTrack).catch(() => {});
              }
            });

            if (videoRef.current) {
              videoRef.current.srcObject = streamRef.current;
            }
          }
        } catch (err) {
          // Screen share cancelled or rejected by user
          onScreenShareChange?.(false);
        }
      } else {
        // Revert to camera feed
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach((t) => t.stop());
          screenStreamRef.current = null;
        }

        const cameraTrack = cameraVideoTrackRef.current;
        if (cameraTrack && streamRef.current) {
          const currentTrack = streamRef.current.getVideoTracks()[0];
          if (currentTrack) {
            streamRef.current.removeTrack(currentTrack);
          }
          cameraTrack.enabled = !isVideoMuted;
          streamRef.current.addTrack(cameraTrack);

          peersRef.current.forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) {
              sender.replaceTrack(cameraTrack).catch(() => {});
            }
          });

          if (videoRef.current) {
            videoRef.current.srcObject = streamRef.current;
          }
        }
      }
    }

    handleScreenShareToggle();

    return () => {
      isCancelled = true;
    };
  }, [isScreenSharing]);

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

      const existingPc = peersRef.current.get(viewerId);
      const createdTime = peerCreationTimeRef.current.get(viewerId) || 0;
      const ageMs = Date.now() - createdTime;

      // Handle viewer forceRefresh (e.g. following camera flip)
      if (existingPc && payload?.forceRefresh) {
        try {
          if (existingPc.signalingState === 'stable') {
            const offer = await existingPc.createOffer();
            await existingPc.setLocalDescription(offer);
            channel.send({
              type: 'broadcast',
              event: 'p2p_offer',
              payload: { targetId: viewerId, offer },
            });
          }
        } catch (e) {}
        return;
      }

      // Avoid tearing down existing connection if already active or negotiating
      if (existingPc) {
        if (
          existingPc.connectionState === 'connected' ||
          existingPc.iceConnectionState === 'connected'
        ) {
          return;
        }
        if (
          existingPc.connectionState !== 'failed' &&
          existingPc.iceConnectionState !== 'failed' &&
          existingPc.connectionState !== 'closed' &&
          ageMs < 15000
        ) {
          if (existingPc.signalingState === 'have-local-offer' && ageMs > 2000 && existingPc.localDescription) {
            channel.send({
              type: 'broadcast',
              event: 'p2p_offer',
              payload: { targetId: viewerId, offer: existingPc.localDescription },
            });
          }
          return;
        }
        existingPc.close();
        peersRef.current.delete(viewerId);
        pendingIceRef.current.delete(viewerId);
      }

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun.cloudflare.com:3478' },
          {
            urls: [
              'turn:openrelay.metered.ca:80',
              'turn:openrelay.metered.ca:443',
              'turn:openrelay.metered.ca:443?transport=tcp',
            ],
            username: 'openrelayproject',
            credential: 'openrelayproject',
          },
        ],
      });
      peersRef.current.set(viewerId, pc);
      peerCreationTimeRef.current.set(viewerId, Date.now());
      pendingIceRef.current.set(viewerId, []);

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
          const pending = pendingIceRef.current.get(viewerId) || [];
          for (const cand of pending) {
            await pc.addIceCandidate(cand).catch(() => {});
          }
          pendingIceRef.current.set(viewerId, []);
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
        if (pc) {
          try {
            const cand = new RTCIceCandidate(candidate);
            if (pc.remoteDescription) {
              await pc.addIceCandidate(cand);
            } else {
              const pending = pendingIceRef.current.get(fromId) || [];
              pending.push(cand);
              pendingIceRef.current.set(fromId, pending);
            }
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
          objectFit: isScreenSharing ? 'contain' : 'cover',
          transform: isScreenSharing ? 'none' : (facingMode === 'user' ? 'scaleX(-1)' : 'none'),
          display: hasPermission && !isVideoMuted ? 'block' : 'none',
          backgroundColor: '#000',
        } as any}
      />

      {/* Screen Sharing Active floating badge */}
      {isScreenSharing && (
        <View style={styles.screenShareBadge}>
          <ScreenShareIcon size={13} color="#818CF8" />
          <Text style={styles.screenShareBadgeText}>Sharing Your Screen Live</Text>
        </View>
      )}

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
  screenShareBadge: {
    position: 'absolute',
    top: 146,
    alignSelf: 'center',
    backgroundColor: 'rgba(30, 27, 75, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  screenShareBadgeText: {
    color: '#C7D2FE',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
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
