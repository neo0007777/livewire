import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import { InAppBanner } from '../../components/InAppBanner';
import { useSessionStore } from '../../stores/session';
import { registerForPushNotificationsAsync } from '../../lib/push';

export default function AppLayout() {
  const { session } = useSessionStore();

  useEffect(() => {
    if (session?.user?.id) {
      registerForPushNotificationsAsync(session.user.id);
    }
  }, [session?.user?.id]);

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      <InAppBanner />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0A0A0A' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="broadcast/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="watch/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="summary/[id]" options={{ headerShown: false }} />
      </Stack>
    </View>
  );
}
