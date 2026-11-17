import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ViewerBadgeProps {
  count: number;
  size?: 'sm' | 'md';
}

export function ViewerBadge({ count, size = 'md' }: ViewerBadgeProps) {
  const formatCount = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toString();
  };

  const isSmall = size === 'sm';

  return (
    <View style={[styles.badge, isSmall && styles.badgeSm]}>
      <View style={styles.liveIndicator}>
        <View style={styles.dotPulse} />
      </View>
      <Text style={[styles.text, isSmall && styles.textSm]}>
        {formatCount(count)} {count === 1 ? 'viewer' : 'viewers'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backdropFilter: 'blur(8px)',
  } as any,
  badgeSm: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 14,
  },
  liveIndicator: {
    marginRight: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  text: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  textSm: {
    fontSize: 11,
  },
});
