import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { useSessionStore } from '../../../stores/session';
import { CheckIcon, UserIcon } from '../../../components/Icons';
import { toggleFollowUser } from '../../../lib/follows';

interface UserProfileItem {
  id: string;
  display_name: string;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, session, signOut } = useSessionStore();
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [streamCount, setStreamCount] = useState(0);

  const [activeTab, setActiveTab] = useState<'followers' | 'following'>('followers');
  const [followers, setFollowers] = useState<UserProfileItem[]>([]);
  const [following, setFollowing] = useState<UserProfileItem[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Fetch follow relationships and counts
  const loadFollowData = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoadingLists(true);

    try {
      const [followersRes, followingRes, streamsRes] = await Promise.all([
        supabase
          .from('follows')
          .select('created_at, follower:profiles!follows_follower_id_fkey(id, display_name)')
          .eq('creator_id', session.user.id),
        supabase
          .from('follows')
          .select('created_at, creator:profiles!follows_creator_id_fkey(id, display_name)')
          .eq('follower_id', session.user.id),
        supabase
          .from('streams')
          .select('id', { count: 'exact', head: true })
          .eq('creator_id', session.user.id),
      ]);

      const followersList: UserProfileItem[] = (followersRes.data || [])
        .map((row: any) => row.follower)
        .filter(Boolean);

      const followingList: UserProfileItem[] = (followingRes.data || [])
        .map((row: any) => row.creator)
        .filter(Boolean);

      setFollowers(followersList);
      setFollowing(followingList);
      setFollowerCount(followersList.length);
      setFollowingCount(followingList.length);
      setStreamCount(streamsRes.count || 0);
    } catch (err) {
      console.warn('[Profile] Failed to load follow data:', err);
    } finally {
      setLoadingLists(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    loadFollowData();
  }, [loadFollowData]);

  // Toggle follow / unfollow directly from profile
  const handleToggleFollow = async (targetUserId: string) => {
    if (!session?.user?.id || !targetUserId || actionLoadingId) return;
    setActionLoadingId(targetUserId);

    try {
      const myName = profile?.display_name || session.user.email?.split('@')[0];
      await toggleFollowUser(session.user.id, targetUserId, myName);
      await loadFollowData();
    } catch (err) {
      console.error('[Profile] toggleFollowUser failed:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const performSignOut = async () => {
    if (session?.user?.id) {
      try {
        await supabase.from('push_tokens').delete().eq('user_id', session.user.id);
      } catch (err) {
        // Best-effort cleanup
      }
    }
    await supabase.auth.signOut();
    signOut();
  };

  const handleSignOut = async () => {
    if (Platform.OS === 'web') {
      const ok = typeof window !== 'undefined' ? window.confirm('Are you sure you want to sign out?') : true;
      if (ok) {
        await performSignOut();
      }
      return;
    }

    Alert.alert('Sign Out', 'Are you sure you want to sign out of LiveWire?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: performSignOut,
      },
    ]);
  };

  // Helper set to check if you follow someone back
  const followingIdsSet = new Set(following.map((f) => f.id));
  const currentList = activeTab === 'followers' ? followers : following;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingTop: Math.max(insets.top + 8, Platform.OS === 'ios' ? 56 : 24) },
      ]}
    >
      <Text style={styles.header}>Creator Profile</Text>

      {/* Profile Identity Card */}
      <View style={styles.card}>
        <View style={styles.avatarBorder}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(profile?.display_name || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.nameRow}>
          <Text style={styles.name}>{profile?.display_name || 'Broadcaster'}</Text>
          <View style={styles.verifiedBadge}>
            <CheckIcon size={9} color="#38BDF8" />
          </View>
        </View>

        <Text style={styles.email}>{session?.user?.email}</Text>

        {/* Interactive Stats Row */}
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={[styles.statItem, activeTab === 'followers' && styles.statItemActive]}
            onPress={() => setActiveTab('followers')}
            activeOpacity={0.7}
          >
            <Text style={[styles.statNumber, activeTab === 'followers' && styles.statNumberActive]}>
              {followerCount}
            </Text>
            <Text style={[styles.statLabel, activeTab === 'followers' && styles.statLabelActive]}>
              Followers
            </Text>
          </TouchableOpacity>

          <View style={styles.statDivider} />

          <TouchableOpacity
            style={[styles.statItem, activeTab === 'following' && styles.statItemActive]}
            onPress={() => setActiveTab('following')}
            activeOpacity={0.7}
          >
            <Text style={[styles.statNumber, activeTab === 'following' && styles.statNumberActive]}>
              {followingCount}
            </Text>
            <Text style={[styles.statLabel, activeTab === 'following' && styles.statLabelActive]}>
              Following
            </Text>
          </TouchableOpacity>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{streamCount}</Text>
            <Text style={styles.statLabel}>Streams</Text>
          </View>
        </View>
      </View>

      {/* Community Connections Card (Followers / Following List) */}
      <View style={styles.sectionCard}>
        <View style={styles.connectionsHeader}>
          <Text style={styles.sectionTitle}>COMMUNITY CONNECTIONS</Text>
          <View style={styles.tabSwitcher}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'followers' && styles.tabBtnActive]}
              onPress={() => setActiveTab('followers')}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabBtnText, activeTab === 'followers' && styles.tabBtnTextActive]}>
                Followers ({followerCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'following' && styles.tabBtnActive]}
              onPress={() => setActiveTab('following')}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabBtnText, activeTab === 'following' && styles.tabBtnTextActive]}>
                Following ({followingCount})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Members List */}
        {loadingLists ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#818CF8" />
            <Text style={styles.loadingText}>Loading network...</Text>
          </View>
        ) : currentList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <UserIcon size={24} color="#475569" />
            <Text style={styles.emptyTitle}>
              {activeTab === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === 'followers'
                ? 'Broadcast live and engage in live chat to build your following!'
                : 'Join live events from the discovery feed and tap follow on creators!'}
            </Text>
          </View>
        ) : (
          <View style={styles.membersList}>
            {currentList.map((user) => {
              const isFollowingUser = followingIdsSet.has(user.id);
              const isLoading = actionLoadingId === user.id;

              return (
                <View key={user.id} style={styles.memberRow}>
                  <View style={styles.memberLeft}>
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberAvatarText}>
                        {(user.display_name || 'U').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.memberName}>{user.display_name || 'Viewer'}</Text>
                      <Text style={styles.memberSub}>
                        {activeTab === 'followers'
                          ? isFollowingUser
                            ? 'Mutual follow'
                            : 'Follows you'
                          : 'Broadcaster'}
                      </Text>
                    </View>
                  </View>

                  {/* Follow/Unfollow Action */}
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      isFollowingUser ? styles.unfollowBtn : styles.followBtn,
                    ]}
                    onPress={() => handleToggleFollow(user.id)}
                    disabled={isLoading}
                    activeOpacity={0.75}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text
                        style={[
                          styles.actionBtnText,
                          isFollowingUser ? styles.unfollowBtnText : styles.followBtnText,
                        ]}
                      >
                        {isFollowingUser
                          ? activeTab === 'following'
                            ? 'Unfollow'
                            : 'Following'
                          : '+ Follow'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Broadcast System Config Card */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>BROADCAST CONFIGURATION</Text>

        <View style={styles.configItem}>
          <Text style={styles.configLabel}>Streaming Engine</Text>
          <Text style={styles.configValue}>LiveKit Cloud SFU + WebRTC</Text>
        </View>

        <View style={styles.configItem}>
          <Text style={styles.configLabel}>Video Resolution</Text>
          <Text style={styles.configValue}>Full HD 1080p (Adaptive)</Text>
        </View>

        <View style={styles.configItem}>
          <Text style={styles.configLabel}>Realtime Architecture</Text>
          <Text style={styles.configValue}>Supabase Realtime v2</Text>
        </View>

        <View style={styles.configItem}>
          <Text style={styles.configLabel}>AI Highlights Model</Text>
          <Text style={styles.configValue}>Claude 3.5 Haiku via n8n</Text>
        </View>
      </View>

      {/* Sign Out Button */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.8}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070913',
  },
  contentContainer: {
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 30,
    paddingBottom: 40,
    maxWidth: 640,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    fontSize: 26,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 0.5,
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#0E1322',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  avatarBorder: {
    width: 86,
    height: 86,
    borderRadius: 43,
    padding: 3,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
    backgroundColor: '#1E1B4B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFF',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  verifiedBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  email: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#070913',
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 6,
    borderRadius: 10,
  },
  statItemActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  statNumberActive: {
    color: '#818CF8',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  statLabelActive: {
    color: '#A5B4FC',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  sectionCard: {
    backgroundColor: '#0E1322',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 20,
    gap: 14,
  },
  connectionsHeader: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#818CF8',
    letterSpacing: 1,
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#070913',
    padding: 4,
    borderRadius: 10,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#1E293B',
  },
  tabBtnText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  tabBtnTextActive: {
    color: '#F8FAFC',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 6,
  },
  emptyTitle: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  emptySubtitle: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 16,
  },
  membersList: {
    gap: 10,
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#312E81',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4338CA',
  },
  memberAvatarText: {
    color: '#E0E7FF',
    fontSize: 14,
    fontWeight: '800',
  },
  memberName: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  memberSub: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 1,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  followBtn: {
    backgroundColor: '#4F46E5',
  },
  followBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  unfollowBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  unfollowBtnText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  configItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  configLabel: {
    fontSize: 13,
    color: '#94A3B8',
  },
  configValue: {
    fontSize: 13,
    color: '#E2E8F0',
    fontWeight: '700',
  },
  signOutButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
