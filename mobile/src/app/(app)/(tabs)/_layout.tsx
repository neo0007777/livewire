import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInbox } from '../../../hooks/useInbox';
import { MonitorIcon, BroadcastIcon, BellIcon, UserIcon } from '../../../components/Icons';

export default function TabLayout() {
  const { unreadCount } = useInbox();
  const insets = useSafeAreaInsets();

  // Dynamic safe bar height and bottom padding
  const bottomPadding = insets.bottom > 0 ? insets.bottom : (Platform.OS === 'ios' ? 20 : 8);
  const barHeight = Platform.OS === 'ios' ? 58 + insets.bottom : 64;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarLabelPosition: 'below-icon',
        tabBarStyle: {
          backgroundColor: '#0A0D18',
          borderTopColor: 'rgba(255, 255, 255, 0.08)',
          borderTopWidth: 1,
          height: barHeight,
          paddingBottom: bottomPadding,
          paddingTop: 6,
          elevation: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.35,
          shadowRadius: 12,
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 4,
        },
        tabBarActiveTintColor: '#818CF8',
        tabBarInactiveTintColor: '#64748B',
        tabBarLabelStyle: {
          fontSize: 10,
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
              <MonitorIcon size={20} color={focused ? '#818CF8' : '#64748B'} />
              {focused && <View style={styles.activeDot} />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="go-live"
        options={{
          title: 'Go Live',
          tabBarLabel: 'Go Live',
          tabBarActiveTintColor: '#EF4444',
          tabBarInactiveTintColor: '#EF4444',
          tabBarIcon: ({ focused }) => (
            <View style={styles.iconContainer}>
              <View style={[styles.goLiveBtn, focused && styles.goLiveBtnFocused]}>
                <BroadcastIcon
                  size={16}
                  color={focused ? '#FFFFFF' : '#EF4444'}
                />
              </View>
              {focused && <View style={styles.activeDotRed} />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Activity',
          tabBarLabel: 'Activity',
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
              <BellIcon size={20} color={focused ? '#818CF8' : '#64748B'} />
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
              <UserIcon size={20} color={focused ? '#818CF8' : '#64748B'} />
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
    height: 24,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#818CF8',
    position: 'absolute',
    bottom: -3,
  },
  goLiveBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goLiveBtnFocused: {
    backgroundColor: '#EF4444',
    borderColor: '#F87171',
    transform: [{ scale: 1.05 }],
  },
  activeDotRed: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#EF4444',
    position: 'absolute',
    bottom: -4,
  },
});
