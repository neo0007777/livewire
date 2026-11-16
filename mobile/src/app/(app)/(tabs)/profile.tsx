import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { supabase } from '../../../lib/supabase';
import { useSessionStore } from '../../../stores/session';

export default function ProfileScreen() {
  const { profile, session, signOut } = useSessionStore();

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          signOut();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Your Profile</Text>

      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(profile?.display_name || 'U').charAt(0).toUpperCase()}
          </Text>
        </View>

        <Text style={styles.name}>{profile?.display_name || 'Anonymous User'}</Text>
        <Text style={styles.email}>{session?.user?.email}</Text>
        <Text style={styles.id}>ID: {session?.user?.id}</Text>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#0A0A0A',
  },
  header: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#171717',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#262626',
    marginBottom: 32,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  id: {
    fontSize: 11,
    color: '#6B7280',
    fontFamily: 'monospace',
  },
  signOutButton: {
    backgroundColor: '#EF44441A',
    borderColor: '#EF4444',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  signOutText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
  },
});

