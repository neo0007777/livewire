import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ViewerBadgeProps {
  count: number;
}

export function ViewerBadge({ count }: ViewerBadgeProps) {
  return (
    <View style={styles.badge}>
      <Text style={styles.icon}>👁</Text>
      <Text style={styles.text}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  icon: {
    fontSize: 12,
    marginRight: 5,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
