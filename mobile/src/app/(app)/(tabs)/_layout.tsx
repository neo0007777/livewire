import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useInbox } from '../../../hooks/useInbox';

export default function TabLayout() {
  const { unreadCount } = useInbox();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0A0D18',
          borderTopColor: 'rgba(255, 255, 255, 0.07)',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 8,
          elevation: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.35,
          shadowRadius: 12,
        },
        tabBarActiveTintColor: '#818CF8',
        tabBarInactiveTintColor: '#64748B',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Live',
          tabBarLabel: 'Live',
          tabBarIcon: ({ focused }) => (
            <View style={styles.iconContainer}>
              <Text style={[styles.tabEmoji, focused && styles.tabEmojiFocused]}>📺</Text>
              {focused && <View style={styles.activeDot} />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="go-live"
        options={{
          title: 'Go Live',
          tabBarLabel: ({ focused }) => (
            <Text style={[styles.goLiveLabel, focused && styles.goLiveLabelFocused]}>
              Go Live
            </Text>
          ),
          tabBarIcon: ({ focused }) => (
            <View style={[styles.goLiveBtn, focused && styles.goLiveBtnFocused]}>
              <View style={styles.livePulseInner} />
              <Text style={styles.goLiveIcon}>🔴</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarLabel: 'Inbox',
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#EF4444',
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: '800',
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            lineHeight: 18,
          },
          tabBarIcon: ({ focused }) => (
            <View style={styles.iconContainer}>
              <Text style={[styles.tabEmoji, focused && styles.tabEmojiFocused]}>🔔</Text>
              {focused && <View style={styles.activeDot} />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused }) => (
            <View style={styles.iconContainer}>
              <Text style={[styles.tabEmoji, focused && styles.tabEmojiFocused]}>👤</Text>
              {focused && <View style={styles.activeDot} />}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
  },
  tabEmoji: {
    fontSize: 20,
    opacity: 0.65,
  },
  tabEmojiFocused: {
    opacity: 1,
    transform: [{ scale: 1.1 }],
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#818CF8',
    position: 'absolute',
    bottom: -4,
  },
  goLiveBtn: {
    width: 46,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  goLiveBtnFocused: {
    backgroundColor: '#EF4444',
    borderColor: '#F87171',
    transform: [{ scale: 1.05 }],
  },
  livePulseInner: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  goLiveIcon: {
    fontSize: 12,
  },
  goLiveLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  goLiveLabelFocused: {
    color: '#F87171',
  },
});
