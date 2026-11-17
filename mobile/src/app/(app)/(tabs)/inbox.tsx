import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useInbox, AppNotification } from '../../../hooks/useInbox';

export default function InboxScreen() {
  const router = useRouter();
  const { notifications, loading, refresh, markAsRead } = useInbox();

  const handleNotificationPress = async (item: AppNotification) => {
    await markAsRead(item.id);
    if (item.data?.stream_id) {
      if (item.type === 'stream_live') {
        router.push(`/(app)/watch/${item.data.stream_id}`);
      } else {
        router.push(`/(app)/summary/${item.data.stream_id}`);
      }
    }
  };

  const getIconInfo = (type: string) => {
    switch (type) {
      case 'stream_live':
        return { emoji: '🔴', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)' };
      case 'new_follower':
        return { emoji: '👤', bg: 'rgba(99, 102, 241, 0.15)', border: 'rgba(99, 102, 241, 0.3)' };
      case 'viewer_milestone':
        return { emoji: '🏆', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)' };
      case 'highlights_ready':
        return { emoji: '🎬', bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)' };
      default:
        return { emoji: '🔔', bg: 'rgba(100, 116, 139, 0.15)', border: 'rgba(100, 116, 139, 0.3)' };
    }
  };

  const formatTime = (iso: string) => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.header}>Activity</Text>
          <Text style={styles.subtitle}>Broadcaster alerts & follower updates</Text>
        </View>
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount} New</Text>
          </View>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#818CF8" />}
        contentContainerStyle={notifications.length === 0 ? styles.emptyList : styles.list}
        renderItem={({ item }) => {
          const { emoji, bg, border } = getIconInfo(item.type);
          const isUnread = !item.read_at;

          return (
            <TouchableOpacity
              style={[styles.card, isUnread && styles.unreadCard]}
              onPress={() => handleNotificationPress(item)}
              activeOpacity={0.8}
            >
              <View style={[styles.iconCircle, { backgroundColor: bg, borderColor: border }]}>
                <Text style={styles.icon}>{emoji}</Text>
              </View>

              <View style={styles.cardContent}>
                <View style={styles.titleRow}>
                  <Text style={[styles.title, isUnread && styles.titleUnread]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.time}>{formatTime(item.created_at)}</Text>
                </View>

                <Text style={styles.body}>{item.body}</Text>
              </View>

              {isUnread && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Text style={styles.emptyIcon}>🔔</Text>
              </View>
              <Text style={styles.emptyTitle}>All Caught Up!</Text>
              <Text style={styles.emptySubtitle}>
                You will be notified when creators you follow start streaming, when viewers follow you,
                or when AI highlights are ready.
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
    backgroundColor: '#070913',
    paddingTop: Platform.OS === 'ios' ? 60 : 30,
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
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  badge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  list: {
    padding: 16,
    gap: 12,
    maxWidth: 800,
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
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  unreadCard: {
    backgroundColor: '#13192B',
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 20,
  },
  cardContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E2E8F0',
    flex: 1,
    marginRight: 8,
  },
  titleUnread: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  time: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  body: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366F1',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 36,
    maxWidth: 400,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 36,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 19,
  },
});
