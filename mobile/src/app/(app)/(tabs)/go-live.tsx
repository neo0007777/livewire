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
import { useRouter } from 'expo-router';
import { startStream } from '../../../lib/streams';

const STREAM_CATEGORIES = [
  '💻 Tech & Coding',
  '🎮 Gaming',
  '💬 Just Chatting',
  '🎵 Music & Audio',
  '🎨 Creative & Design',
];

export default function GoLiveScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(STREAM_CATEGORIES[0]);
  const [loading, setLoading] = useState(false);

  const handleStartBroadcast = async () => {
    if (!title.trim()) {
      Alert.alert('Stream Title Required', 'Please enter a catchy title for your live stream.');
      return;
    }

    setLoading(true);
    try {
      const fullTitle = `[${selectedCategory.split(' ')[1] || 'Live'}] ${title.trim()}`;
      const stream = await startStream(fullTitle);
      setTitle('');
      router.push(`/(app)/broadcast/${stream.id}`);
    } catch (err: any) {
      Alert.alert('Broadcast Error', err?.message || 'Could not initiate live stream room.');
    } finally {
      setLoading(false);
    }
  };

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

      {/* Hardware & Network Status Cards */}
      <View style={styles.hardwareGrid}>
        <View style={styles.hwCard}>
          <Text style={styles.hwIcon}>📹</Text>
          <View>
            <Text style={styles.hwTitle}>Camera</Text>
            <Text style={styles.hwStatus}>🟢 1080p Ready</Text>
          </View>
        </View>

        <View style={styles.hwCard}>
          <Text style={styles.hwIcon}>🎙️</Text>
          <View>
            <Text style={styles.hwTitle}>Microphone</Text>
            <Text style={styles.hwStatus}>🟢 Stereo Input</Text>
          </View>
        </View>

        <View style={styles.hwCard}>
          <Text style={styles.hwIcon}>⚡</Text>
          <View>
            <Text style={styles.hwTitle}>Latency</Text>
            <Text style={styles.hwStatus}>⚡ Sub-Second</Text>
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
          placeholder="e.g. Building an Autonomous AI Swarm from Scratch 🚀"
          placeholderTextColor="#475569"
          value={title}
          onChangeText={setTitle}
          maxLength={80}
        />

        {/* Category Selector */}
        <Text style={styles.inputLabel}>CATEGORY & TAGS</Text>
        <View style={styles.categoryPillsRow}>
          {STREAM_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryPill, isSelected && styles.categoryPillSelected]}
                onPress={() => setSelectedCategory(cat)}
                activeOpacity={0.7}
              >
                <Text style={[styles.categoryText, isSelected && styles.categoryTextSelected]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Notification Perks Alert */}
        <View style={styles.perkBox}>
          <Text style={styles.perkIcon}>🔔</Text>
          <View style={styles.perkContent}>
            <Text style={styles.perkTitle}>Instant Audience Dispatch</Text>
            <Text style={styles.perkDescription}>
              All of your followers will be alerted in real-time the moment you click Start Broadcast.
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
    marginBottom: 24,
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
  hwIcon: {
    fontSize: 22,
  },
  hwTitle: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  hwStatus: {
    fontSize: 11,
    color: '#34D399',
    fontWeight: '700',
    marginTop: 2,
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
  perkIcon: {
    fontSize: 22,
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
