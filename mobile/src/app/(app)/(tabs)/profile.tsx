import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform, ScrollView } from 'react-native';
import { supabase } from '../../../lib/supabase';
import { useSessionStore } from '../../../stores/session';
import { CheckIcon } from '../../../components/Icons';

export default function ProfileScreen() {
  const { profile, session, signOut } = useSessionStore();
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [streamCount, setStreamCount] = useState(0);

  useEffect(() => {
    if (!session?.user?.id) return;

    // Fetch followers count
    supabase
      .from('follows')
      .select('id', { count: 'exact', head: true })
      .eq('creator_id', session.user.id)
      .then(({ count }) => setFollowerCount(count || 0));

    // Fetch following count
    supabase
      .from('follows')
      .select('id', { count: 'exact', head: true })
      .eq('follower_id', session.user.id)
      .then(({ count }) => setFollowingCount(count || 0));

    // Fetch stream count
    supabase
      .from('streams')
      .select('id', { count: 'exact', head: true })
      .eq('creator_id', session.user.id)
      .then(({ count }) => setStreamCount(count || 0));
  }, [session?.user?.id]);

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
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

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{followerCount}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{followingCount}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{streamCount}</Text>
            <Text style={styles.statLabel}>Streams</Text>
          </View>
        </View>
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
  verifiedText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
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
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
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
    marginBottom: 24,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#818CF8',
    letterSpacing: 1,
    marginBottom: 4,
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
