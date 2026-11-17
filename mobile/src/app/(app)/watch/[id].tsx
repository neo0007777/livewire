import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LiveKitWrapper } from '../../../components/LiveKitWrapper';
import { RemoteStage } from '../../../components/RemoteStage';
import { ViewerBadge } from '../../../components/ViewerBadge';
import { ChatPanel } from '../../../components/ChatPanel';
import { fetchLiveKitToken, LiveKitTokenResponse } from '../../../lib/streams';
import { useSessionStore } from '../../../stores/session';
import { useStreamChannel } from '../../../hooks/useStreamChannel';
import { useChat } from '../../../hooks/useChat';
import { usePresenceCount } from '../../../hooks/usePresenceCount';
import { supabase } from '../../../lib/supabase';
import { getStreamCategory, cleanStreamTitle } from '../../../lib/categories';
import { CloseIcon, MonitorIcon, CheckIcon } from '../../../components/Icons';

export default function WatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const streamId = Array.isArray(id) ? id[0] : (id || '');
  const router = useRouter();
  const { session, profile } = useSessionStore();
  const [tokenData, setTokenData] = useState<LiveKitTokenResponse | null>(null);
  const [streamInfo, setStreamInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isEnded, setIsEnded] = useState(false);

  // Chat hook
  const {
    messages,
    send,
    retry,
    handleIncomingMessage,
    handleStreamUpdate,
    fillGaps,
  } = useChat(streamId);

  // Presence hook
  const { viewerCount, updateFromPresence, updateFromStream } = usePresenceCount({
    streamId,
    creatorId: streamInfo?.creator_id || '',
    isCreator: false,
  });

  const handleMergedStreamUpdate = useCallback((stream: any) => {
    handleStreamUpdate(stream);
    updateFromStream(stream);
    if (stream?.status === 'ended') {
      setIsEnded(true);
    }
  }, [handleStreamUpdate, updateFromStream]);

  // Stream channel hook
  const { channel, status: channelStatus } = useStreamChannel({
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
          if (data.status === 'ended') {
            setIsEnded(true);
          }
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
    if (session.user.id === streamInfo.creator_id) return; // Cannot follow yourself

    if (isFollowing) {
      setIsFollowing(false);
      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', session.user.id)
        .eq('creator_id', streamInfo.creator_id);
    } else {
      setIsFollowing(true);
      const { error } = await supabase.from('follows').insert({
        follower_id: session.user.id,
        creator_id: streamInfo.creator_id,
      });

      if (!error) {
        try {
          const myName = profile?.display_name || session.user.email?.split('@')[0] || 'Someone';
          await supabase
            .from('notifications')
            .insert({
              user_id: streamInfo.creator_id,
              type: 'new_follower',
              title: 'New Follower!',
              body: `${myName} started following you.`,
              data: { follower_id: session.user.id },
              dedupe_key: `follow:${session.user.id}:${streamInfo.creator_id}:${Date.now()}`,
            });
        } catch (notifErr) {
          // Best-effort notification delivery
        }
      }
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
        <ActivityIndicator size="large" color="#818CF8" />
        <Text style={styles.loadingText}>Connecting to live stream...</Text>
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
            <RemoteStage channel={channel} streamId={streamId} />

            {/* Top Bar with Stream Info & Controls */}
            <View style={styles.topBar}>
              <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
                <CloseIcon size={14} color="#FFF" />
              </TouchableOpacity>

              <View style={styles.creatorAvatarCircle}>
                <Text style={styles.creatorAvatarText}>
                  {(streamInfo?.creator?.display_name || 'C').charAt(0).toUpperCase()}
                </Text>
              </View>

              <View style={styles.metaContainer}>
                <Text style={styles.streamTitle} numberOfLines={1}>
                  {cleanStreamTitle(streamInfo?.title) || 'Live Broadcast'}
                </Text>
                <View style={styles.creatorSubRow}>
                  <Text style={styles.creatorName} numberOfLines={1}>
                    {streamInfo?.creator?.display_name || 'Creator'}
                  </Text>
                  <View style={styles.verifiedDot}>
                    <CheckIcon size={8} color="#38BDF8" />
                  </View>
                  {getStreamCategory(streamInfo?.title) && (
                    <Text style={styles.categoryPillHeader}>
                      {getStreamCategory(streamInfo?.title)?.badge}
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.rightActions}>
                {session?.user?.id !== streamInfo?.creator_id && (
                  <TouchableOpacity
                    style={[styles.followButton, isFollowing && styles.followingButton]}
                    onPress={toggleFollow}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                      {isFollowing ? 'Following' : '+ Follow'}
                    </Text>
                  </TouchableOpacity>
                )}
                <ViewerBadge count={viewerCount} />
              </View>
            </View>

            {/* Ended Overlay */}
            {isEnded && (
              <View style={styles.endedOverlay}>
                <View style={styles.endedCard}>
                  <View style={styles.endedIconWrap}>
                    <MonitorIcon size={32} color="#818CF8" />
                  </View>
                  <Text style={styles.endedTitle}>This stream has ended</Text>
                  <Text style={styles.endedSubtitle}>
                    Thank you for tuning in! The broadcaster has concluded this live event.
                  </Text>
                  <TouchableOpacity
                    style={styles.summaryLinkButton}
                    onPress={() => router.replace(`/(app)/summary/${streamId}`)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.summaryLinkText}>View Stream Recap & Highlights</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.homeLinkButton}
                    onPress={handleBack}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.homeLinkText}>Back to Streams Feed</Text>
                  </TouchableOpacity>
                </View>
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
          <TouchableOpacity style={styles.returnButton} onPress={handleBack}>
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
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
    gap: 8,
    backgroundColor: 'rgba(10, 14, 26, 0.75)',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
  } as any,
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  creatorAvatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  creatorAvatarText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  metaContainer: {
    flex: 1,
    paddingRight: 4,
  },
  streamTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  creatorSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  creatorName: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  categoryPillHeader: {
    color: '#818CF8',
    fontSize: 10,
    fontWeight: '700',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    marginLeft: 4,
  },
  verifiedDot: {
    backgroundColor: '#3B82F6',
    width: 12,
    height: 12,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedDotText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: 'bold',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  followButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  followingButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    shadowOpacity: 0,
    elevation: 0,
  },
  followButtonText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  followingButtonText: {
    color: '#CBD5E1',
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
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 20,
  },
  endedCard: {
    backgroundColor: '#0E1322',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
  },
  endedIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  endedIcon: {
    fontSize: 52,
    marginBottom: 16,
  },
  endedTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  endedSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
  },
  summaryLinkButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLinkText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
  homeLinkButton: {
    paddingVertical: 8,
  },
  homeLinkText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
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
