import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInbox, AppNotification } from '../../../hooks/useInbox';
import { BroadcastIcon, UserIcon, EyeIcon, MonitorIcon, BellIcon } from '../../../components/Icons';
import { THEME } from '../../../lib/theme';

export default function InboxScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  const renderIcon = (type: string) => {
    switch (type) {
      case 'stream_live':
        return (
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.35)' }]}>
            <BroadcastIcon size={18} color="#EF4444" />
          </View>
        );
      case 'new_follower':
        return (
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(99, 102, 241, 0.15)', borderColor: 'rgba(99, 102, 241, 0.35)' }]}>
            <UserIcon size={18} color="#818CF8" />
          </View>
        );
      case 'viewer_milestone':
        return (
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.35)' }]}>
            <EyeIcon size={18} color="#F59E0B" />
          </View>
        );
      case 'highlights_ready':
        return (
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.35)' }]}>
            <MonitorIcon size={18} color="#3B82F6" />
          </View>
        );
      default:
        return (
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(100, 116, 139, 0.15)', borderColor: 'rgba(100, 116, 139, 0.35)' }]}>
            <BellIcon size={18} color="#94A3B8" />
          </View>
        );
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
    <View
      style={[
        styles.container,
        { paddingTop: Math.max(insets.top + 8, Platform.OS === 'ios' ? 56 : 24) },
      ]}
    >
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
        keyExtractor={(item, index) => item.id || `notif-${index}`}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#818CF8" />}
        contentContainerStyle={
          notifications.length === 0
            ? styles.emptyList
            : [styles.list, { paddingBottom: Math.max(80, insets.bottom + 64) }]
        }
        renderItem={({ item }) => {
          const isUnread = !item.read_at;

          return (
            <TouchableOpacity
              style={[styles.card, isUnread && styles.unreadCard]}
              onPress={() => handleNotificationPress(item)}
              activeOpacity={0.8}
            >
              {renderIcon(item.type)}

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
                <BellIcon size={32} color="#818CF8" />
              </View>
              <Text style={styles.emptyTitle}>All Caught Up</Text>
              <Text style={styles.emptySubtitle}>
                You will be notified when creators you follow start streaming, when viewers follow you,
                or when highlights are ready.
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
    backgroundColor: THEME.bg,
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
    color: THEME.text,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 13,
    color: THEME.textMuted,
    marginTop: 2,
  },
  badge: {
    backgroundColor: THEME.live,
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
    backgroundColor: THEME.card,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
  },
  unreadCard: {
    backgroundColor: THEME.cardElevated,
    borderColor: 'rgba(0, 229, 255, 0.35)',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
