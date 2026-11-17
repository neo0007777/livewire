import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

const isServer = Platform.OS === 'web' && typeof window === 'undefined';

const safeStorage = {
  getItem: async (key: string) => {
    if (isServer) return null;
    // On web, isolate auth per browser tab via sessionStorage so multiple accounts can be tested simultaneously
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
      const sessionVal = window.sessionStorage.getItem(key);
      if (sessionVal) return sessionVal;
      // Seed from localStorage on first tab load if available
      const localVal = window.localStorage.getItem(key);
      if (localVal) {
        window.sessionStorage.setItem(key, localVal);
        return localVal;
      }
      return null;
    }
    return AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    if (isServer) return;
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(key, value);
      return;
    }
    return AsyncStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    if (isServer) return;
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(key);
      return;
    }
    return AsyncStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: safeStorage,
    autoRefreshToken: !isServer,
    persistSession: !isServer,
    detectSessionInUrl: false,
  },
});

if (!isServer) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
