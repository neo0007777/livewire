import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { EyeIcon } from './Icons';

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
      <EyeIcon size={isSmall ? 12 : 14} color="#CBD5E1" />
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    gap: 6,
    backdropFilter: 'blur(8px)',
  } as any,
  badgeSm: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 5,
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
