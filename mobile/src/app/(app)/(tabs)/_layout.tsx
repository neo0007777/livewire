import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInbox } from '../../../hooks/useInbox';
import { MonitorIcon, BroadcastIcon, BellIcon, UserIcon } from '../../../components/Icons';
import { THEME } from '../../../lib/theme';

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
          backgroundColor: THEME.tabBar,
          borderTopColor: THEME.tabBarBorder,
          borderTopWidth: 1,
          height: barHeight,
          paddingBottom: bottomPadding,
          paddingTop: 6,
          elevation: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.45,
          shadowRadius: 14,
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 4,
        },
        tabBarActiveTintColor: THEME.primary,
        tabBarInactiveTintColor: THEME.textSubtle,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          marginTop: 2,
          letterSpacing: 0.2,
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
              <MonitorIcon size={20} color={focused ? THEME.primary : THEME.textSubtle} />
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
          tabBarActiveTintColor: THEME.live,
          tabBarInactiveTintColor: THEME.live,
          tabBarIcon: ({ focused }) => (
            <View style={styles.iconContainer}>
              <View style={[styles.goLiveBtn, focused && styles.goLiveBtnFocused]}>
                <BroadcastIcon
                  size={16}
                  color={focused ? '#FFFFFF' : THEME.live}
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
            backgroundColor: THEME.live,
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
              <BellIcon size={20} color={focused ? THEME.primary : THEME.textSubtle} />
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
              <UserIcon size={20} color={focused ? THEME.primary : THEME.textSubtle} />
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
    backgroundColor: THEME.primary,
    position: 'absolute',
    bottom: -3,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  goLiveBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: THEME.liveBadgeBg,
    borderWidth: 1.5,
    borderColor: THEME.live,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goLiveBtnFocused: {
    backgroundColor: THEME.live,
    borderColor: '#FF6B8B',
    transform: [{ scale: 1.05 }],
  },
  activeDotRed: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: THEME.live,
    position: 'absolute',
    bottom: -4,
  },
});
