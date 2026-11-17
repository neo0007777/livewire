import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { startStream } from '../../../lib/streams';
import { STREAM_CATEGORIES, StreamCategory } from '../../../lib/categories';
import {
  VideoCameraIcon,
  MicIcon,
  BroadcastIcon,
  BellIcon,
  UserIcon,
} from '../../../components/Icons';
import { useSessionStore } from '../../../stores/session';
import { supabase } from '../../../lib/supabase';

export default function GoLiveScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const initialCat = STREAM_CATEGORIES.find((c) => c.id === params.category) || STREAM_CATEGORIES[0];
  const [title, setTitle] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<StreamCategory>(initialCat);
  const [loading, setLoading] = useState(false);
  const { session, profile, setSession, setProfile } = useSessionStore();

  const handleStartBroadcast = async () => {
    if (!title.trim()) {
      Alert.alert('Stream Title Required', 'Please enter a title for your live stream.');
      return;
    }

    setLoading(true);
    try {
      // Build title with clear category tag e.g. "[Gaming] Playing Minecraft"
      const formattedTitle = `${selectedCategory.tag} ${title.trim()}`.slice(0, 80);
      const stream = await startStream(formattedTitle);
      setTitle('');
      router.push(`/(app)/broadcast/${stream.id}`);
    } catch (err: any) {
      Alert.alert('Broadcast Error', err?.message || 'Could not initiate live stream room.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSwitch = async (email: string, displayName: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: 'password123',
      });
      if (error) {
        Alert.alert('Switch Account Failed', error.message);
      } else if (data?.session) {
        setSession(data.session);
        setProfile({
          id: data.session.user.id,
          display_name: displayName,
          created_at: new Date().toISOString(),
        });
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const currentEmail = session?.user?.email || '';
  const isShiva = currentEmail === 'shiva@test.com';
  const targetEmail = isShiva ? 'cdsc@test.com' : 'shiva@test.com';
  const targetName = isShiva ? 'cdsc' : 'shiva';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Studio Header */}
      <View style={styles.headerRow}>
        <View style={styles.studioBadge}>
          <Text style={styles.studioBadgeText}>CREATOR STUDIO</Text>
        </View>
        <Text style={styles.title}>Go Live</Text>
        <Text style={styles.subtitle}>
          Broadcast real-time video, audio, and interactive chat to your audience worldwide.
        </Text>
      </View>

      {/* Broadcaster Account Card & Tab-Level Account Switcher */}
      <View style={styles.accountCard}>
        <View style={styles.accountLeft}>
          <View style={styles.accountAvatar}>
            <Text style={styles.accountAvatarText}>
              {(profile?.display_name || currentEmail.charAt(0) || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.accountDetails}>
            <Text style={styles.accountLabel}>CURRENT BROADCASTER</Text>
            <Text style={styles.accountTitle}>
              {profile?.display_name || currentEmail.split('@')[0] || 'Broadcaster'}{' '}
              <Text style={styles.accountEmail}>({currentEmail})</Text>
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.switchButton}
          onPress={() => handleQuickSwitch(targetEmail, targetName)}
          disabled={loading}
          activeOpacity={0.75}
        >
          <Text style={styles.switchButtonText}>Switch to {targetName}</Text>
        </TouchableOpacity>
      </View>

      {/* Hardware & Network Status Cards */}
      <View style={styles.hardwareGrid}>
        <View style={styles.hwCard}>
          <View style={styles.hwIconWrap}>
            <VideoCameraIcon size={16} color="#22C55E" />
          </View>
          <View>
            <Text style={styles.hwTitle}>Camera Input</Text>
            <View style={styles.statusRow}>
              <View style={styles.dotActive} />
              <Text style={styles.hwStatus}>1080p Ready</Text>
            </View>
          </View>
        </View>

        <View style={styles.hwCard}>
          <View style={styles.hwIconWrap}>
            <MicIcon size={16} color="#22C55E" />
          </View>
          <View>
            <Text style={styles.hwTitle}>Microphone</Text>
            <View style={styles.statusRow}>
              <View style={styles.dotActive} />
              <Text style={styles.hwStatus}>Stereo Ready</Text>
            </View>
          </View>
        </View>

        <View style={styles.hwCard}>
          <View style={styles.hwIconWrap}>
            <BroadcastIcon size={16} color="#22C55E" />
          </View>
          <View>
            <Text style={styles.hwTitle}>Latency</Text>
            <View style={styles.statusRow}>
              <View style={styles.dotActive} />
              <Text style={styles.hwStatus}>Ultra-Low</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Stream Configuration Form */}
      <View style={styles.formCard}>
        {/* Stream Title */}
        <View style={styles.inputHeaderRow}>
          <Text style={styles.inputLabel}>STREAM TITLE</Text>
          <Text style={styles.charCount}>{title.length}/80</Text>
        </View>

        <TextInput
          style={styles.textInput}
          placeholder="e.g. Building an Autonomous Real-Time Stream Platform"
          placeholderTextColor="#475569"
          value={title}
          onChangeText={setTitle}
          maxLength={80}
        />

        {/* Category Selector */}
        <Text style={styles.inputLabel}>CATEGORY & TAGS</Text>
        <View style={styles.categoryPillsRow}>
          {STREAM_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory.id === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryPill, isSelected && styles.categoryPillSelected]}
                onPress={() => setSelectedCategory(cat)}
                activeOpacity={0.7}
              >
                <Text style={[styles.categoryText, isSelected && styles.categoryTextSelected]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Notification Alert Info */}
        <View style={styles.perkBox}>
          <View style={styles.perkIconWrap}>
            <BellIcon size={18} color="#818CF8" />
          </View>
          <View style={styles.perkContent}>
            <Text style={styles.perkTitle}>Instant Audience Dispatch</Text>
            <Text style={styles.perkDescription}>
              All of your followers will be alerted in real-time the moment you start broadcasting.
            </Text>
          </View>
        </View>

        {/* Launch Broadcast Button */}
        <TouchableOpacity
          style={[styles.launchButton, !title.trim() && styles.launchButtonDisabled]}
          onPress={handleStartBroadcast}
          disabled={loading || !title.trim()}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <View style={styles.buttonInner}>
              <View style={styles.pulseDot} />
              <Text style={styles.launchButtonText}>START LIVE BROADCAST</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070913',
  },
  contentContainer: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 30,
    paddingBottom: 40,
    maxWidth: 720,
    alignSelf: 'center',
    width: '100%',
  },
  headerRow: {
    marginBottom: 20,
  },
  studioBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 10,
  },
  studioBadgeText: {
    color: '#818CF8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
  },
  accountCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0E1322',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 18,
    gap: 12,
  },
  accountLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  accountAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4338CA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountAvatarText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  accountDetails: {
    flex: 1,
  },
  accountLabel: {
    color: '#818CF8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  accountTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 1,
  },
  accountEmail: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '500',
  },
  switchButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  switchButtonText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
  },
  hardwareGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  hwCard: {
    flex: 1,
    backgroundColor: '#0E1322',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hwIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hwTitle: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  dotActive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  hwStatus: {
    fontSize: 11,
    color: '#34D399',
    fontWeight: '700',
  },
  formCard: {
    backgroundColor: '#0E1322',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  inputHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#CBD5E1',
    letterSpacing: 0.8,
  },
  charCount: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: '#070913',
    borderWidth: 1.5,
    borderColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    color: '#F8FAFC',
    fontSize: 15,
    marginBottom: 20,
  },
  categoryPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    marginBottom: 22,
  },
  categoryPill: {
    backgroundColor: '#161B2E',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  categoryPillSelected: {
    backgroundColor: '#4338CA',
    borderColor: '#818CF8',
  },
  categoryText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  categoryTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  perkBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  perkIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  perkContent: {
    flex: 1,
  },
  perkTitle: {
    color: '#818CF8',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  perkDescription: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
  },
  launchButton: {
    backgroundColor: '#EF4444',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  launchButtonDisabled: {
    backgroundColor: '#334155',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  launchButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
