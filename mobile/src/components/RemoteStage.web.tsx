import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { VideoCameraOffIcon, MicMutedIcon, MicIcon, ScreenShareIcon } from './Icons';

interface RemoteStageProps {
  channel?: any;
  streamId?: string;
}

export function RemoteStage({ channel }: RemoteStageProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isCreatorVideoPaused, setIsCreatorVideoPaused] = useState(false);
  const [isCreatorMicMuted, setIsCreatorMicMuted] = useState(false);
  const [isCreatorScreenSharing, setIsCreatorScreenSharing] = useState(false);

  const videoRef = useRef<any>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const isConnectedRef = useRef(false);
  const pendingIceRef = useRef<RTCIceCandidate[]>([]);
  const viewerIdRef = useRef(Math.random().toString(36).slice(2, 9));

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  // Bind remote stream to video element
  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.defaultMuted = isMuted;
      videoRef.current.muted = isMuted;
      videoRef.current.srcObject = remoteStream;
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((err: any) => {
          console.warn('[RemoteStage.web] video.play() error:', err);
          if (videoRef.current && !videoRef.current.muted) {
            videoRef.current.muted = true;
            setIsMuted(true);
            videoRef.current.play().catch(() => {});
          }
        });
      }
    }
  }, [remoteStream, isMuted]);

  useEffect(() => {
    if (!channel) return;

    let isMounted = true;
    const viewerId = viewerIdRef.current;
    pendingIceRef.current = [];

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
      ],
    });
    pcRef.current = pc;

    // When remote camera/mic tracks arrive from creator
    pc.ontrack = (event) => {
      if (!isMounted) return;
      let stream = event.streams && event.streams[0];
      if (stream) {
        setRemoteStream(stream);
        isConnectedRef.current = true;
        setIsConnected(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.defaultMuted = isMuted;
          videoRef.current.muted = isMuted;
          videoRef.current.play().catch(() => {});
        }
      } else if (event.track) {
        setRemoteStream((prev) => {
          let nextStream: MediaStream;
          if (prev) {
            const exists = prev.getTracks().find((t: any) => t.id === event.track.id);
            if (!exists) {
              nextStream = new MediaStream([...prev.getTracks(), event.track]);
            } else {
              nextStream = prev;
            }
          } else {
            nextStream = new MediaStream([event.track]);
          }
          if (videoRef.current) {
            videoRef.current.srcObject = nextStream;
            videoRef.current.defaultMuted = isMuted;
            videoRef.current.muted = isMuted;
            videoRef.current.play().catch(() => {});
          }
          return nextStream;
        });
        isConnectedRef.current = true;
        setIsConnected(true);
      }
    };

    pc.onconnectionstatechange = () => {
      if (!isMounted) return;
      if (pc.connectionState === 'connected') {
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

        for (const cand of pendingIceRef.current) {
          await pc.addIceCandidate(cand).catch(() => {});
        }
        pendingIceRef.current = [];
      } catch (err) {
        // Offer handle error
      }
    };

    // Handle ICE from creator
    const handleIce = async ({ payload }: any) => {
      if (payload?.targetId === viewerId && payload?.candidate) {
        try {
          const cand = new RTCIceCandidate(payload.candidate);
          if (pc.remoteDescription) {
            await pc.addIceCandidate(cand);
          } else {
            pendingIceRef.current.push(cand);
          }
        } catch (err) {
          // ICE add error
        }
      }
    };

    // Handle creator video/mic mute states
    const handleMediaState = ({ payload }: any) => {
      if (!isMounted) return;
      if (typeof payload?.isVideoMuted === 'boolean') {
        setIsCreatorVideoPaused(payload.isVideoMuted);
      }
      if (typeof payload?.isMicMuted === 'boolean') {
        setIsCreatorMicMuted(payload.isMicMuted);
      }
      if (typeof payload?.isScreenSharing === 'boolean') {
        setIsCreatorScreenSharing(payload.isScreenSharing);
      }
    };

    // Handle creator camera flip: ensure video playback continues smoothly
    const handleCameraFlipped = () => {
      if (!isMounted) return;
      setIsCreatorVideoPaused(false);
      if (videoRef.current && remoteStream) {
        videoRef.current.play().catch(() => {});
      }
    };

    channel.on('broadcast', { event: 'p2p_offer' }, handleOffer);
    channel.on('broadcast', { event: 'p2p_ice' }, handleIce);
    channel.on('broadcast', { event: 'creator_media_state' }, handleMediaState);
    channel.on('broadcast', { event: 'camera_flipped' }, handleCameraFlipped);

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
    const interval = setInterval(requestStream, 3000);

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
        onLoadedMetadata={() => {
          if (videoRef.current) {
            videoRef.current.play().catch(() => {});
          }
        }}
        style={{
          width: '100%',
          height: '100%',
          objectFit: isCreatorScreenSharing ? 'contain' : 'cover',
          display: isConnected && !isCreatorVideoPaused ? 'block' : 'none',
          backgroundColor: '#000',
        } as any}
      />

      {/* Host Screen Sharing Indicator */}
      {isConnected && isCreatorScreenSharing && (
        <View style={styles.screenSharePill}>
          <ScreenShareIcon size={12} color="#818CF8" />
          <Text style={styles.screenShareText}>Host is Sharing Screen</Text>
        </View>
      )}

      {/* Broadcaster Video Paused State for Viewers */}
      {isConnected && isCreatorVideoPaused && (
        <View style={styles.creatorPausedOverlay}>
          <View style={styles.creatorPausedCircle}>
            <VideoCameraOffIcon size={36} color="#EF4444" />
          </View>
          <Text style={styles.creatorPausedTitle}>Broadcaster Paused Video</Text>
          <Text style={styles.creatorPausedSubtitle}>
            The host has temporarily paused their camera feed
          </Text>
        </View>
      )}

      {/* Broadcaster Mic Muted Indicator */}
      {isConnected && isCreatorMicMuted && (
        <View style={styles.creatorMicMutedPill}>
          <MicMutedIcon size={12} color="#FFF" />
          <Text style={styles.creatorMicMutedText}>Host Mic Muted</Text>
        </View>
      )}

      {/* Connecting state */}
      {!isConnected && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#818CF8" />
          <Text style={styles.loadingTitle}>Connecting to live broadcast...</Text>
          <Text style={styles.loadingSubtitle}>Establishing live video stream with creator</Text>
        </View>
      )}

      {/* Autoplay un-mute prompt banner if muted */}
      {isConnected && isMuted && (
        <TouchableOpacity style={styles.unmuteBanner} onPress={toggleMute} activeOpacity={0.85}>
          <Text style={styles.unmuteBannerText}>🔊 Browser audio is muted — Click here to Unmute</Text>
        </TouchableOpacity>
      )}

      {/* Floating Audio Toggle for Viewer */}
      {isConnected && (
        <TouchableOpacity style={styles.muteButton} onPress={toggleMute} activeOpacity={0.8}>
          {isMuted ? (
            <MicMutedIcon size={13} color="#EF4444" />
          ) : (
            <MicIcon size={13} color="#22C55E" />
          )}
          <Text style={styles.muteText}>{isMuted ? 'Unmute' : 'Audio On'}</Text>
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
    backgroundColor: '#070913',
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
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
  },
  creatorPausedOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#070913',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  creatorPausedCircle: {
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
  creatorPausedEmoji: {
    fontSize: 36,
  },
  creatorPausedTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
  },
  creatorPausedSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
  },
  creatorMicMutedPill: {
    position: 'absolute',
    top: 96,
    left: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  creatorMicMutedText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  screenSharePill: {
    position: 'absolute',
    top: 96,
    left: 14,
    backgroundColor: 'rgba(30, 27, 75, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.5)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  screenShareText: {
    color: '#C7D2FE',
    fontSize: 11,
    fontWeight: '700',
  },
  muteButton: {
    position: 'absolute',
    top: 96,
    right: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  muteText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  unmuteBanner: {
    position: 'absolute',
    top: 96,
    alignSelf: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.92)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  unmuteBannerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
