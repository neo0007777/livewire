import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useInbox } from '../../../hooks/useInbox';

export default function TabLayout() {
  const { unreadCount } = useInbox();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#121212',
          borderTopColor: '#262626',
        },
        tabBarActiveTintColor: '#818CF8',
        tabBarInactiveTintColor: '#6B7280',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Live',
          tabBarLabel: 'Live',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>📺</Text>,
        }}
      />
      <Tabs.Screen
        name="go-live"
        options={{
          title: 'Go Live',
          tabBarLabel: 'Go Live',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🔴</Text>,
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
            fontSize: 10,
            fontWeight: 'bold',
          },
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🔔</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>👤</Text>,
        }}
      />
    </Tabs>
  );
}

