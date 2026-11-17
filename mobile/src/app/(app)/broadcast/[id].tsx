import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  BackHandler,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LiveKitWrapper } from '../../../components/LiveKitWrapper';
import { LocalPreview } from '../../../components/LocalPreview';
import { ViewerBadge } from '../../../components/ViewerBadge';
import { ChatPanel } from '../../../components/ChatPanel';
import {
  MicIcon,
  MicMutedIcon,
  VideoCameraIcon,
  VideoCameraOffIcon,
  FlipCameraIcon,
} from '../../../components/Icons';
import { endStream, fetchLiveKitToken, LiveKitTokenResponse } from '../../../lib/streams';
import { useSessionStore } from '../../../stores/session';
import { useStreamChannel } from '../../../hooks/useStreamChannel';
import { useChat } from '../../../hooks/useChat';
import { usePresenceCount } from '../../../hooks/usePresenceCount';

export default function BroadcastScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const streamId = Array.isArray(id) ? id[0] : (id || '');
  const router = useRouter();
  const { session } = useSessionStore();
  const [tokenData, setTokenData] = useState<LiveKitTokenResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEnding, setIsEnding] = useState(false);

  // Broadcaster Hardware Media Controls
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // Chat hook
  const {
    messages,
    send,
    retry,
    handleIncomingMessage,
    handleStreamUpdate,
    fillGaps,
  } = useChat(streamId);

  // Presence viewer count hook
  const { viewerCount, updateFromPresence } = usePresenceCount({
    streamId,
    creatorId: session?.user?.id || '',
    isCreator: true,
  });

  // Stream channel hook
  const { channel, status: channelStatus } = useStreamChannel({
    streamId,
    isCreator: true,
    onNewMessage: handleIncomingMessage,
    onStreamUpdate: handleStreamUpdate,
    onPresenceSync: updateFromPresence,
  });

  useEffect(() => {
    if (channelStatus === 'SUBSCRIBED') {
      fillGaps();
    }
  }, [channelStatus, fillGaps]);

  // Broadcast media controls state to viewers
  useEffect(() => {
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'creator_media_state',
        payload: { isMicMuted, isVideoMuted },
      });
    }
  }, [channel, isMicMuted, isVideoMuted]);

  // Load LiveKit token
  useEffect(() => {
    if (!streamId) return;

    let isMounted = true;
    fetchLiveKitToken(streamId)
      .then((res) => {
        if (isMounted) {
          setTokenData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          Alert.alert('LiveKit Error', err.message || 'Could not connect to broadcast room');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [streamId]);

  const handleEndStream = useCallback(async () => {
    setIsEnding(true);
    try {
      await endStream(streamId);
    } catch (err) {
      // End stream handled
    } finally {
      router.replace(`/(app)/summary/${streamId}`);
    }
  }, [streamId, router]);

  // Toggle handlers
  const toggleMic = useCallback(() => {
    setIsMicMuted((prev) => !prev);
  }, []);

  const toggleVideo = useCallback(() => {
    setIsVideoMuted((prev) => !prev);
  }, []);

  const flipCamera = useCallback(() => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  }, []);

  // Confirm End Stream
  const confirmEnd = useCallback(() => {
    if (Platform.OS === 'web') {
      const ok = typeof window !== 'undefined' ? window.confirm('Are you sure you want to end this live broadcast?') : true;
      if (ok) {
        handleEndStream();
      }
      return;
    }

    Alert.alert(
      'End Broadcast',
      'Are you sure you want to end this live stream for all viewers?',
      [
        { text: 'Keep Broadcasting', style: 'cancel' },
        {
          text: 'End Stream',
          style: 'destructive',
          onPress: handleEndStream,
        },
      ]
    );
  }, [handleEndStream]);

  // Prevent accidental hardware back button on Android
  useEffect(() => {
    const backAction = () => {
      confirmEnd();
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [confirmEnd]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(app)/(tabs)');
    }
  }, [router]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#EF4444" />
        <Text style={styles.loadingText}>Initializing Studio Broadcast...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {tokenData ? (
        <LiveKitWrapper
          serverUrl={tokenData.url}
          token={tokenData.token}
          connect={true}
          audio={!isMicMuted}
          video={!isVideoMuted}
        >
          <View style={styles.room}>
            <LocalPreview
              channel={channel}
              streamId={streamId}
              isMicMuted={isMicMuted}
              isVideoMuted={isVideoMuted}
              facingMode={facingMode}
            />

            {/* Top Control Bar with Status & Controls */}
            <View style={styles.topBar}>
              {/* Row 1: Live Status, Viewers, Quality, End Stream */}
              <View style={styles.headerRow1}>
                <View style={styles.badgeRow}>
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>LIVE</Text>
                  </View>

                  <ViewerBadge count={viewerCount} />

                  <View style={styles.streamQualityPill}>
                    <Text style={styles.streamQualityText}>1080p HD</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.endButton}
                  onPress={confirmEnd}
                  disabled={isEnding}
                  activeOpacity={0.8}
                >
                  <Text style={styles.endButtonText}>
                    {isEnding ? 'Ending...' : 'End Stream'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Row 2: Broadcaster Media Controls Toolbar */}
              <View style={styles.controlsRow}>
                {/* Mic Toggle Button */}
                <TouchableOpacity
                  style={[
                    styles.mediaBtn,
                    isMicMuted ? styles.mediaBtnMuted : styles.mediaBtnActive,
                  ]}
                  onPress={toggleMic}
                  activeOpacity={0.75}
                >
                  {isMicMuted ? (
                    <MicMutedIcon size={15} color="#EF4444" />
                  ) : (
                    <MicIcon size={15} color="#22C55E" />
                  )}
                  <Text
                    style={[
                      styles.mediaBtnText,
                      isMicMuted && styles.mediaBtnTextMuted,
                    ]}
                  >
                    {isMicMuted ? 'Mic Muted' : 'Mic Active'}
                  </Text>
                  <View
                    style={[
                      styles.statusDot,
                      isMicMuted ? styles.statusDotRed : styles.statusDotGreen,
                    ]}
                  />
                </TouchableOpacity>

                {/* Video Camera Toggle Button */}
                <TouchableOpacity
                  style={[
                    styles.mediaBtn,
                    isVideoMuted ? styles.mediaBtnMuted : styles.mediaBtnActive,
                  ]}
                  onPress={toggleVideo}
                  activeOpacity={0.75}
                >
                  {isVideoMuted ? (
                    <VideoCameraOffIcon size={15} color="#EF4444" />
                  ) : (
                    <VideoCameraIcon size={15} color="#22C55E" />
                  )}
                  <Text
                    style={[
                      styles.mediaBtnText,
                      isVideoMuted && styles.mediaBtnTextMuted,
                    ]}
                  >
                    {isVideoMuted ? 'Camera Off' : 'Camera Active'}
                  </Text>
                  <View
                    style={[
                      styles.statusDot,
                      isVideoMuted ? styles.statusDotRed : styles.statusDotGreen,
                    ]}
                  />
                </TouchableOpacity>

                {/* Flip Camera Button */}
                <TouchableOpacity
                  style={styles.mediaBtn}
                  onPress={flipCamera}
                  activeOpacity={0.75}
                >
                  <FlipCameraIcon size={15} color="#CBD5E1" />
                  <Text style={styles.mediaBtnText}>Flip Cam</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Chat Overlay */}
            <View style={styles.chatOverlay}>
              <ChatPanel messages={messages} onSend={send} onRetry={retry} />
            </View>
          </View>
        </LiveKitWrapper>
      ) : (
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Unable to initiate broadcast room.</Text>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>Return</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  room: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#070913',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#D1D5DB',
    marginTop: 14,
    fontSize: 15,
    fontWeight: '600',
  },
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 24,
    left: 14,
    right: 14,
    zIndex: 100,
    backgroundColor: 'rgba(10, 14, 26, 0.92)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 12,
  },
  headerRow1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFF',
  },
  liveText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  streamQualityPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  streamQualityText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  endButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  endButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  mediaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  mediaBtnActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  mediaBtnMuted: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  mediaBtnText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  mediaBtnTextMuted: {
    color: '#FCA5A5',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 2,
  },
  statusDotGreen: {
    backgroundColor: '#22C55E',
  },
  statusDotRed: {
    backgroundColor: '#EF4444',
  },
  chatOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 15,
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  backButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
});
