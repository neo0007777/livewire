import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
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
  );
}
