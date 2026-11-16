import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { startStream } from '../../../lib/streams';

export default function GoLiveScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStartBroadcast = async () => {
    if (!title.trim()) {
      Alert.alert('Stream Title Required', 'Please enter a title for your live broadcast.');
      return;
    }

    setLoading(true);
    try {
      const stream = await startStream(title.trim());
      setTitle('');
      router.push(`/(app)/broadcast/${stream.id}`);
    } catch (err: any) {
      Alert.alert('Failed to Start Stream', err?.message || 'Could not initialize live stream.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Go Live</Text>
      <Text style={styles.subtitle}>Broadcast video and audio to viewers in real time</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Stream Title</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Building an AI agent live!"
          placeholderTextColor="#666"
          value={title}
          onChangeText={setTitle}
          maxLength={80}
        />

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>⚡ Sub-second Latency</Text>
          <Text style={styles.infoText}>
            Your broadcast is powered by LiveKit SFU. Chat messages and viewer counts sync instantly.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.startButton, !title.trim() && styles.disabledButton]}
          onPress={handleStartBroadcast}
          disabled={loading || !title.trim()}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.startButtonText}>Start Broadcast</Text>
          )}
        </TouchableOpacity>
      </View>
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
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 28,
  },
  card: {
    backgroundColor: '#171717',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#262626',
  },
  label: {
    fontSize: 14,
    color: '#E5E7EB',
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0F0F0F',
    borderWidth: 1,
    borderColor: '#2D2D2D',
    borderRadius: 10,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 15,
    marginBottom: 20,
  },
  infoBox: {
    backgroundColor: '#1E1B4B40',
    borderColor: '#312E81',
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 24,
  },
  infoTitle: {
    color: '#818CF8',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  infoText: {
    color: '#9CA3AF',
    fontSize: 12,
    lineHeight: 18,
  },
  startButton: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#374151',
  },
  startButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
