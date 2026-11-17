import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { WifiOffIcon, SyncIcon } from './Icons';

interface OfflineBannerProps {
  isOnline: boolean;
  queueCount: number;
  isDraining?: boolean;
  onManualSync?: () => void;
}

export function OfflineBanner({
  isOnline,
  queueCount,
  isDraining = false,
  onManualSync,
}: OfflineBannerProps) {
  // Only display if offline or if there are items in the queue
  if (isOnline && queueCount === 0 && !isDraining) {
    return null;
  }

  return (
    <View style={[styles.container, !isOnline ? styles.offlineBg : styles.syncingBg]}>
      <View style={styles.leftContent}>
        {!isOnline ? (
          <WifiOffIcon size={14} color="#F59E0B" />
        ) : isDraining ? (
          <ActivityIndicator size="small" color="#818CF8" />
        ) : (
          <SyncIcon size={14} color="#34D399" />
        )}

        <Text style={styles.messageText}>
          {!isOnline
            ? queueCount > 0
              ? `Offline — ${queueCount} message${queueCount > 1 ? 's' : ''} queued`
              : 'Offline — Live chat will queue messages'
            : isDraining
            ? `Syncing ${queueCount} queued message${queueCount > 1 ? 's' : ''}...`
            : `${queueCount} queued message${queueCount > 1 ? 's' : ''} ready`}
        </Text>
      </View>

      {isOnline && queueCount > 0 && !isDraining && onManualSync && (
        <TouchableOpacity
          style={styles.syncBtn}
          onPress={onManualSync}
          activeOpacity={0.7}
        >
          <Text style={styles.syncBtnText}>Sync</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 14,
    marginBottom: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  offlineBg: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.28)',
  },
  syncingBg: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderColor: 'rgba(99, 102, 241, 0.28)',
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  messageText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
  },
  syncBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  syncBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});

