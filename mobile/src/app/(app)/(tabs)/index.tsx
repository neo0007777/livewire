import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { ViewerBadge } from '../../../components/ViewerBadge';
import {
  FILTER_CATEGORIES,
  getStreamCategory,
  cleanStreamTitle,
} from '../../../lib/categories';
import { MonitorIcon, CheckIcon } from '../../../components/Icons';

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
  const [selectedCategory, setSelectedCategory] = useState('all');

  const { data: streams = [], refetch, isLoading } = useQuery<StreamItem[]>({
    queryKey: ['live_streams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('streams')
        .select('id, title, current_viewers, started_at, creator:profiles(display_name)')
        .eq('status', 'live')
        .order('started_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as StreamItem[];
    },
    refetchInterval: 3000,
  });

  // Realtime subscription to instantly update feed when any stream starts or ends
  useEffect(() => {
    const channelName = 'streams_live_feed';
    const existing = supabase.getChannels().find((c) => c.topic === `realtime:${channelName}`);
    if (existing) {
      supabase.removeChannel(existing);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'streams' },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const getDuration = (startedAt: string) => {
    const mins = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000));
    return mins === 0 ? 'Just started' : `${mins}m ago`;
  };

  // Filter streams strictly by selected category
  const filteredStreams = streams.filter((stream) => {
    if (selectedCategory === 'all') return true;
    const cat = getStreamCategory(stream.title);
    return cat?.id === selectedCategory;
  });

  const activeCategoryObj = FILTER_CATEGORIES.find((c) => c.id === selectedCategory);

  // Deterministic mock preview visual accent for streams
  const getGradientColor = (id: string) => {
    const colors = [
      'linear-gradient(135deg, #1E1B4B 0%, #0F172A 100%)',
      'linear-gradient(135deg, #311042 0%, #0F172A 100%)',
      'linear-gradient(135deg, #064E3B 0%, #0F172A 100%)',
      'linear-gradient(135deg, #1E293B 0%, #090D16 100%)',
    ];
    const index = (id.charCodeAt(0) || 0) % colors.length;
    return colors[index];
  };

  return (
    <View style={styles.container}>
      {/* Top Branding Bar */}
      <View style={styles.topHeader}>
        <View style={styles.brandRow}>
          <View style={styles.brandLogo}>
            <View style={styles.brandLogoDot} />
          </View>
          <View>
            <Text style={styles.brandTitle}>LIVEWIRE</Text>
            <Text style={styles.brandSubtitle}>BROADCAST NETWORK</Text>
          </View>
        </View>

        <View style={styles.activePill}>
          <View style={styles.activeDot} />
          <Text style={styles.activeText}>
            {filteredStreams.length} {selectedCategory === 'all' ? 'LIVE NOW' : 'ONLINE'}
          </Text>
        </View>
      </View>

      {/* Categories Filter Ribbon */}
      <View style={styles.categoryContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {FILTER_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
                onPress={() => setSelectedCategory(cat.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.categoryText, isSelected && styles.categoryTextSelected]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Streams Feed */}
      <FlatList
        data={filteredStreams}
        keyExtractor={(item, index) => item.id || `stream-${index}`}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818CF8" />
        }
        contentContainerStyle={filteredStreams.length === 0 ? styles.emptyList : styles.list}
        renderItem={({ item }) => {
          const cat = getStreamCategory(item.title);
          const cleanTitle = cleanStreamTitle(item.title);

          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.88}
              onPress={() => router.push(`/(app)/watch/${item.id}`)}
            >
              {/* 16:9 Thumbnail Stage */}
              <View
                style={[
                  styles.previewContainer,
                  { background: getGradientColor(item.id) } as any,
                ]}
              >
                {/* Floating Top Badges */}
                <View style={styles.previewTopRow}>
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveBadgeText}>LIVE</Text>
                  </View>

                  <ViewerBadge count={item.current_viewers} size="sm" />
                </View>

                {/* Bottom tag over preview */}
                <View style={styles.previewBottomRow}>
                  <View style={styles.tagPill}>
                    <Text style={styles.tagText}>
                      {cat ? cat.badge.toUpperCase() : 'LIVE'}
                    </Text>
                  </View>
                  <Text style={styles.durationPill}>{getDuration(item.started_at)}</Text>
                </View>
              </View>

              {/* Stream Info Row */}
              <View style={styles.cardBody}>
                {/* Creator Avatar with Border */}
                <View style={styles.avatarRing}>
                  <View style={styles.avatarInner}>
                    <Text style={styles.avatarLetter}>
                      {(item.creator?.display_name || 'U').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardDetails}>
                  <Text style={styles.streamTitle} numberOfLines={1}>
                    {cleanTitle}
                  </Text>

                  <View style={styles.creatorRow}>
                    <Text style={styles.creatorName} numberOfLines={1}>
                      {item.creator?.display_name || 'Creator'}
                    </Text>
                    <View style={styles.verifiedCheck}>
                      <CheckIcon size={8} color="#38BDF8" />
                    </View>
                    <Text style={styles.metaDot}>•</Text>
                    <Text style={styles.categorySub}>{cat?.badge || 'Broadcast'}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <MonitorIcon size={28} color="#818CF8" />
              </View>
              <Text style={styles.emptyTitle}>
                {selectedCategory === 'all'
                  ? 'No Live Broadcasts'
                  : `No ${activeCategoryObj?.label} Streams`}
              </Text>
              <Text style={styles.emptySubtitle}>
                {selectedCategory === 'all'
                  ? 'There are no active broadcasts at this moment. Start broadcasting to your followers in seconds.'
                  : `No creators are currently live in ${activeCategoryObj?.label}. Be the first to start a stream in this category.`}
              </Text>
              <TouchableOpacity
                style={styles.emptyActionButton}
                onPress={() =>
                  router.push({
                    pathname: '/(app)/(tabs)/go-live',
                    params: selectedCategory !== 'all' ? { category: selectedCategory } : {},
                  })
                }
                activeOpacity={0.8}
              >
                <Text style={styles.emptyActionText}>
                  {selectedCategory === 'all'
                    ? 'Start Broadcast'
                    : `Start ${activeCategoryObj?.label} Stream`}
                </Text>
              </TouchableOpacity>
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
    backgroundColor: '#070913',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandLogo: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandLogoDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  brandTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 1.2,
  },
  brandSubtitle: {
    fontSize: 9,
    fontWeight: '800',
    color: '#818CF8',
    letterSpacing: 1,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    gap: 6,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  activeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FCA5A5',
    letterSpacing: 0.5,
  },
  categoryContainer: {
    paddingVertical: 8,
  },
  categoryScroll: {
    paddingHorizontal: 18,
    gap: 8,
  },
  categoryChip: {
    backgroundColor: '#111628',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  categoryChipSelected: {
    backgroundColor: '#4338CA',
    borderColor: '#818CF8',
  },
  categoryText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  categoryTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  list: {
    padding: 16,
    gap: 18,
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#0E1322',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  previewContainer: {
    height: 190,
    position: 'relative',
    justifyContent: 'space-between',
    padding: 14,
    overflow: 'hidden',
    backgroundColor: '#111625',
  },
  previewTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  liveBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  previewBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  tagPill: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  tagText: {
    color: '#818CF8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  durationPill: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  cardBody: {
    flexDirection: 'row',
    padding: 14,
    alignItems: 'center',
    gap: 12,
  },
  avatarRing: {
    width: 42,
    height: 42,
    borderRadius: 21,
    padding: 2,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 19,
    backgroundColor: '#1E1B4B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  cardDetails: {
    flex: 1,
  },
  streamTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  creatorName: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  verifiedCheck: {
    backgroundColor: '#3B82F6',
    width: 13,
    height: 13,
    borderRadius: 6.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 5,
  },
  checkText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: 'bold',
  },
  metaDot: {
    color: '#475569',
    marginHorizontal: 6,
  },
  categorySub: {
    color: '#818CF8',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 36,
    maxWidth: 440,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyActionButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyActionText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
