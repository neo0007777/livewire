import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  BackHandler,
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
  } = useChat(id);

  // Presence viewer count hook
  const { viewerCount, updateFromPresence } = usePresenceCount({
    streamId: id,
    creatorId: session?.user?.id || '',
    isCreator: true,
  });

  // Stream channel hook
  const { status: channelStatus } = useStreamChannel({
    streamId: id,
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
    if (!id) return;

    let isMounted = true;
    fetchLiveKitToken(id)
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
  }, [id]);

  // Confirm End Stream
  const confirmEnd = useCallback(() => {
    Alert.alert('End Stream', 'Are you sure you want to conclude this live broadcast?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Stream',
        style: 'destructive',
        onPress: async () => {
          setIsEnding(true);
          try {
            await endStream(id);
          } catch (err) {
            // End stream handled
          } finally {
            router.replace(`/(app)/summary/${id}`);
          }
        },
      },
    ]);
  }, [id, router]);

  // Intercept Android hardware back button
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      confirmEnd();
      return true;
    });
    return () => sub.remove();
  }, [confirmEnd]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#EF4444" />
        <Text style={styles.loadingText}>Connecting to broadcast server...</Text>
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
            <LocalPreview />

            {/* Top Control Bar */}
            <View style={styles.topBar}>
              <View style={styles.badgeRow}>
                <View style={styles.liveBadge}>
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
                <ViewerBadge count={viewerCount} />
              </View>

              <TouchableOpacity style={styles.endButton} onPress={confirmEnd} disabled={isEnding}>
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
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
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
    backgroundColor: '#0A0A0A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#D1D5DB',
    marginTop: 14,
    fontSize: 15,
  },
  topBar: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  liveText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  endButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  endButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
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
    fontSize: 16,
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: '#374151',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFF',
  },
});
