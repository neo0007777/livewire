import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { BroadcastIcon } from '../../components/Icons';

export default function SignUpScreen() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!displayName.trim() || !email.trim() || !password) {
      Alert.alert('Missing Fields', 'Please fill in all fields to create your account');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          display_name: displayName.trim(),
        },
      },
    });
    setLoading(false);
    if (error) {
      Alert.alert('Registration Failed', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Brand Header */}
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <BroadcastIcon size={20} color="#EF4444" />
          </View>
          <View>
            <Text style={styles.brandTitle}>LIVEWIRE</Text>
            <Text style={styles.brandSubtitle}>JOIN THE BROADCAST NETWORK</Text>
          </View>
        </View>

        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Stream, chat, and connect in real-time</Text>

        <View style={styles.form}>
          <Text style={styles.label}>CREATOR DISPLAY NAME</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Elena Streams"
            placeholderTextColor="#475569"
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={30}
          />

          <Text style={styles.label}>EMAIL ADDRESS</Text>
          <TextInput
            style={styles.input}
            placeholder="elena@livewire.dev"
            placeholderTextColor="#475569"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>PASSWORD</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••••••"
            placeholderTextColor="#475569"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.button}
            onPress={handleSignUp}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>Get Started on LiveWire</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/sign-in" asChild>
              <TouchableOpacity>
                <Text style={styles.linkText}>Sign In</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#070913',
  },
  card: {
    backgroundColor: '#0E1322',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 440,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  logoBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoIcon: {
    fontSize: 22,
    color: '#FFF',
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 1.5,
  },
  brandSubtitle: {
    fontSize: 9,
    fontWeight: '800',
    color: '#818CF8',
    letterSpacing: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 22,
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#CBD5E1',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#070913',
    borderWidth: 1.5,
    borderColor: '#1E293B',
    borderRadius: 12,
    padding: 13,
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 22,
  },
  footerText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  linkText: {
    color: '#818CF8',
    fontSize: 13,
    fontWeight: '700',
  },
});
