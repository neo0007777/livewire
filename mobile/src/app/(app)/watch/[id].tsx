import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LiveKitWrapper } from '../../../components/LiveKitWrapper';
import { RemoteStage } from '../../../components/RemoteStage';
import { ViewerBadge } from '../../../components/ViewerBadge';
import { ChatPanel } from '../../../components/ChatPanel';
import { fetchLiveKitToken, LiveKitTokenResponse } from '../../../lib/streams';
import { supabase } from '../../../lib/supabase';
import { useSessionStore } from '../../../stores/session';
import { useStreamChannel } from '../../../hooks/useStreamChannel';
import { useChat } from '../../../hooks/useChat';
import { usePresenceCount } from '../../../hooks/usePresenceCount';

export default function WatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const streamId = Array.isArray(id) ? id[0] : (id || '');
  const router = useRouter();
  const { session } = useSessionStore();
  const [tokenData, setTokenData] = useState<LiveKitTokenResponse | null>(null);
  const [streamInfo, setStreamInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

  // Chat hook
  const {
    messages,
    isEnded,
    send,
    retry,
    handleIncomingMessage,
    handleStreamUpdate,
    fillGaps,
  } = useChat(streamId);

  // Presence count hook
  const { viewerCount, updateFromPresence, updateFromStream } = usePresenceCount({
    streamId,
    creatorId: streamInfo?.creator_id || '',
    isCreator: false,
  });

  const handleMergedStreamUpdate = useCallback((stream: any) => {
    handleStreamUpdate(stream);
    updateFromStream(stream);
  }, [handleStreamUpdate, updateFromStream]);

  // Stream channel hook
  const { status: channelStatus } = useStreamChannel({
    streamId,
    isCreator: false,
    onNewMessage: handleIncomingMessage,
    onStreamUpdate: handleMergedStreamUpdate,
    onPresenceSync: updateFromPresence,
  });

  useEffect(() => {
    if (channelStatus === 'SUBSCRIBED') {
      fillGaps();
    }
  }, [channelStatus, fillGaps]);

  // Load stream info & follow status
  useEffect(() => {
    if (!streamId || !session?.user?.id) return;

    supabase
      .from('streams')
      .select('id, creator_id, title, status, current_viewers, started_at, creator:profiles(display_name)')
      .eq('id', streamId)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setStreamInfo(data);
          updateFromStream(data);
          // Check follow status
          supabase
            .from('follows')
            .select('*')
            .eq('follower_id', session.user.id)
            .eq('creator_id', data.creator_id)
            .single()
            .then(({ data: followData }) => {
              setIsFollowing(!!followData);
            });
        }
      });
  }, [streamId, session?.user?.id]);

  // Toggle follow creator
  const toggleFollow = async () => {
    if (!streamInfo?.creator_id || !session?.user?.id) return;

    if (isFollowing) {
      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', session.user.id)
        .eq('creator_id', streamInfo.creator_id);
      setIsFollowing(false);
    } else {
      await supabase.from('follows').insert({
        follower_id: session.user.id,
        creator_id: streamInfo.creator_id,
      });
      setIsFollowing(true);
    }
  };

  // Load LiveKit subscribe token
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
          Alert.alert('Unable to Join', err.message || 'Stream is no longer live.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [streamId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#818CF8" />
        <Text style={styles.loadingText}>Connecting to stream...</Text>
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
          audio={false}
          video={false}
        >
          <View style={styles.room}>
            <RemoteStage />

            {/* Top Bar with Stream Info & Controls */}
            <View style={styles.topBar}>
              <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Text style={styles.backIcon}>✕</Text>
              </TouchableOpacity>

              <View style={styles.metaContainer}>
                <Text style={styles.streamTitle} numberOfLines={1}>
                  {streamInfo?.title || 'Live Broadcast'}
                </Text>
                <Text style={styles.creatorName} numberOfLines={1}>
                  {streamInfo?.creator?.display_name || 'Creator'}
                </Text>
              </View>

              <View style={styles.rightActions}>
                <TouchableOpacity
                  style={[styles.followButton, isFollowing && styles.followingButton]}
                  onPress={toggleFollow}
                >
                  <Text style={styles.followButtonText}>
                    {isFollowing ? 'Following' : '+ Follow'}
                  </Text>
                </TouchableOpacity>
                <ViewerBadge count={viewerCount} />
              </View>
            </View>

            {/* Ended Overlay */}
            {isEnded && (
              <View style={styles.endedOverlay}>
                <Text style={styles.endedIcon}>📺</Text>
                <Text style={styles.endedTitle}>This stream has ended</Text>
                <Text style={styles.endedSubtitle}>Thank you for tuning in!</Text>
                <TouchableOpacity
                  style={styles.summaryLinkButton}
                  onPress={() => router.replace(`/(app)/summary/${streamId}`)}
                >
                  <Text style={styles.summaryLinkText}>View Stream Recap</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Chat Overlay */}
            <View style={styles.chatOverlay}>
              <ChatPanel
                messages={messages}
                onSend={send}
                onRetry={retry}
                isEnded={isEnded}
              />
            </View>
          </View>
        </LiveKitWrapper>
      ) : (
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Stream is offline or ended.</Text>
          <TouchableOpacity style={styles.returnButton} onPress={() => router.back()}>
            <Text style={styles.returnButtonText}>Back to Streams</Text>
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
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
    gap: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  metaContainer: {
    flex: 1,
  },
  streamTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  creatorName: {
    color: '#A5B4FC',
    fontSize: 12,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  followButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  followingButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  followButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  chatOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  endedOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 20,
  },
  endedIcon: {
    fontSize: 52,
    marginBottom: 16,
  },
  endedTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  },
  endedSubtitle: {
    color: '#9CA3AF',
    fontSize: 14,
    marginBottom: 24,
  },
  summaryLinkButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  summaryLinkText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 15,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 16,
    marginBottom: 16,
  },
  returnButton: {
    backgroundColor: '#374151',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  returnButtonText: {
    color: '#FFF',
  },
});
