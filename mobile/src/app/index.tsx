import { Redirect } from 'expo-router';
import { useSessionStore } from '../stores/session';

export default function Index() {
  const { session } = useSessionStore();
  return <Redirect href={session ? '/(app)/(tabs)' : '/(auth)/sign-in'} />;
}

