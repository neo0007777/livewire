import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
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

  const getIcon = (type: string) => {
    switch (type) {
      case 'stream_live':
        return '🔴';
      case 'viewer_milestone':
        return '🎉';
      case 'highlights_ready':
        return '🎬';
      case 'daily_digest':
        return '📰';
      default:
        return '🔔';
    }
  };

  const formatTime = (iso: string) => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Notifications</Text>
        <Text style={styles.badge}>{notifications.filter((n) => !n.read_at).length} Unread</Text>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#818CF8" />}
        contentContainerStyle={notifications.length === 0 ? styles.emptyList : styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, !item.read_at && styles.unreadCard]}
            onPress={() => handleNotificationPress(item)}
            activeOpacity={0.8}
          >
            <View style={styles.iconCircle}>
              <Text style={styles.icon}>{getIcon(item.type)}</Text>
            </View>

            <View style={styles.cardContent}>
              <View style={styles.titleRow}>
                <Text style={styles.title} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.time}>{formatTime(item.created_at)}</Text>
              </View>

              <Text style={styles.body}>{item.body}</Text>
            </View>

            {!item.read_at && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyTitle}>All caught up!</Text>
              <Text style={styles.emptySubtitle}>
                You will be notified when creators go live, reach milestones, or publish daily digests.
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
  badge: {
    backgroundColor: '#1E1B4B',
    color: '#818CF8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    fontSize: 12,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: 16,
    gap: 10,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171717',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#262626',
  },
  unreadCard: {
    backgroundColor: '#1C1A2E',
    borderColor: '#3730A3',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#262626',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  time: {
    color: '#9CA3AF',
    fontSize: 11,
  },
  body: {
    color: '#D1D5DB',
    fontSize: 13,
    lineHeight: 18,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#818CF8',
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 48,
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
    lineHeight: 20,
  },
});
