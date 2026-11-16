import { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';

interface StreamItem {
  id: string;
  title: string;
  current_viewers: number;
  started_at: string;
  creator: {
    display_name: string;
  } | null;
}

export default function LiveStreamsScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data: streams = [], refetch, isLoading } = useQuery<StreamItem[]>({
    queryKey: ['live_streams'],
    queryFn: async () => {
      const recent = new Date(Date.now() - 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('streams')
        .select('id, title, current_viewers, started_at, creator:profiles(display_name)')
        .eq('status', 'live')
        .gt('last_heartbeat_at', recent)
        .order('current_viewers', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as StreamItem[];
    },
    refetchInterval: 10000,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const getDuration = (startedAt: string) => {
    const mins = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000));
    return mins === 0 ? 'just started' : `live for ${mins}m`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Browse Live</Text>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>REALTIME</Text>
        </View>
      </View>

      <FlatList
        data={streams}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818CF8" />}
        contentContainerStyle={streams.length === 0 ? styles.emptyList : styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => router.push(`/(app)/watch/${item.id}`)}
          >
            <View style={styles.previewPlaceholder}>
              <Text style={styles.previewIcon}>📺</Text>
              <View style={styles.badgeRow}>
                <View style={styles.liveBadge}>
                  <Text style={styles.liveBadgeText}>LIVE</Text>
                </View>
                <View style={styles.viewersBadge}>
                  <Text style={styles.viewersText}>👁 {item.current_viewers}</Text>
                </View>
              </View>
            </View>

            <View style={styles.cardContent}>
              <Text style={styles.streamTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <View style={styles.metaRow}>
                <Text style={styles.creatorName}>
                  {item.creator?.display_name || 'Broadcaster'}
                </Text>
                <Text style={styles.dot}>•</Text>
                <Text style={styles.duration}>{getDuration(item.started_at)}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📡</Text>
              <Text style={styles.emptyTitle}>No live broadcasts right now</Text>
              <Text style={styles.emptySubtitle}>
                Tap 'Go Live' in the tabs to start broadcasting!
              </Text>
            </View>
          ) : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    backgroundColor: '#0A0A0A',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  header: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFF',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1B4B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
    marginRight: 6,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#A5B4FC',
  },
  list: {
    padding: 16,
    gap: 16,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#171717',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#262626',
  },
  previewPlaceholder: {
    height: 180,
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  previewIcon: {
    fontSize: 48,
    opacity: 0.3,
  },
  badgeRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  liveBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  liveBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  viewersBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  viewersText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  cardContent: {
    padding: 14,
  },
  streamTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  creatorName: {
    fontSize: 13,
    color: '#D1D5DB',
    fontWeight: '500',
  },
  dot: {
    color: '#6B7280',
    marginHorizontal: 6,
  },
  duration: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 54,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E5E7EB',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
