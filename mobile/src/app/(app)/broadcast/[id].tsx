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
          audio={true}
          video={true}
        >
          <View style={styles.room}>
            <LocalPreview channel={channel} streamId={streamId} />

            {/* Top Control Bar */}
            <View style={styles.topBar}>
              <View style={styles.badgeRow}>
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>

                <ViewerBadge count={viewerCount} />

                <View style={styles.streamQualityPill}>
                  <Text style={styles.streamQualityText}>⚡ 1080p</Text>
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
    top: Platform.OS === 'ios' ? 52 : 36,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
    backgroundColor: 'rgba(10, 14, 26, 0.75)',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
  } as any,
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
    borderRadius: 14,
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
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  streamQualityText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  endButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.95)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  endButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
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
