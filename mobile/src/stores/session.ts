import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  display_name: string;
  created_at: string;
}

interface SessionState {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  signOut: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  profile: null,
  isLoading: true,
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setIsLoading: (isLoading) => set({ isLoading }),
  signOut: () => set({ session: null, profile: null, isLoading: false }),
}));
