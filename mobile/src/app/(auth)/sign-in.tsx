import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '../../lib/supabase';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Missing Fields', 'Please enter your email and password');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) {
      Alert.alert('Sign In Failed', error.message);
    }
  };

  const quickFill = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('password123');
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Brand Header */}
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoIcon}>⚡</Text>
          </View>
          <View>
            <Text style={styles.brandTitle}>LIVEWIRE</Text>
            <Text style={styles.brandSubtitle}>NEXT-GEN STREAMING PLATFORM</Text>
          </View>
        </View>

        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to broadcast or tune in to live events</Text>

        {/* Inputs */}
        <View style={styles.form}>
          <Text style={styles.label}>EMAIL ADDRESS</Text>
          <TextInput
            style={styles.input}
            placeholder="creator@livewire.dev"
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
            onPress={handleSignIn}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>Sign In to LiveWire</Text>
            )}
          </TouchableOpacity>

          {/* Quick Demo Credentials for Fast Testing */}
          <View style={styles.quickFillContainer}>
            <Text style={styles.quickFillLabel}>⚡ QUICK TEST PRESETS</Text>
            <View style={styles.presetButtonsRow}>
              <TouchableOpacity
                style={styles.presetBtn}
                onPress={() => quickFill('shiva@test.com')}
                activeOpacity={0.7}
              >
                <Text style={styles.presetBtnText}>Broadcaster (Shiva)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetBtn}
                onPress={() => quickFill('cdsc@test.com')}
                activeOpacity={0.7}
              >
                <Text style={styles.presetBtnText}>Viewer (cdsc)</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Link href="/(auth)/sign-up" asChild>
              <TouchableOpacity>
                <Text style={styles.linkText}>Create Account</Text>
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
  quickFillContainer: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  quickFillLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#818CF8',
    letterSpacing: 0.8,
    marginBottom: 8,
    textAlign: 'center',
  },
  presetButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  presetBtn: {
    flex: 1,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  presetBtnText: {
    color: '#A5B4FC',
    fontSize: 11,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
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
