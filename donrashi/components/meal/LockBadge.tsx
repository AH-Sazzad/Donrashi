/**
 * Shows a 🔒 badge with an explanation instead of hiding locked controls.
 * Principle: show locked states with an explanation, never hide them silently.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  reason: string;
  color?: string;
}

export function LockBadge({ reason, color = '#F59E0B' }: Props) {
  return (
    <View style={[styles.wrap, { backgroundColor: color + '18', borderColor: color + '40' }]}>
      <Text style={[styles.icon, { color }]}>🔒</Text>
      <Text style={[styles.text, { color }]}>{reason}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1,
  },
  icon: { fontSize: 13 },
  text: { fontSize: 12, fontWeight: '600', flex: 1 },
});
