import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';

interface Props {
  label: string;
  value: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  onPress?: () => void;
  /** Optional sub-label shown below value */
  sub?: string;
}

export function StatCard({ label, value, icon, color, onPress, sub }: Props) {
  const isDark      = useColorScheme() === 'dark';
  const cardBg      = isDark ? '#1E1E2E' : '#FFFFFF';
  const textPrimary = isDark ? '#F1F5F9' : '#1E293B';
  const textSec     = isDark ? '#94A3B8' : '#64748B';

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: cardBg }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}>
      <View style={[styles.icon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.value, { color: textPrimary }]}>{value}</Text>
      {sub ? <Text style={[styles.sub, { color: color }]}>{sub}</Text> : null}
      <Text style={[styles.label, { color: textSec }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1, minWidth: '45%', borderRadius: 16, padding: 14,
    alignItems: 'center', gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  icon:  { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  value: { fontSize: 18, fontWeight: '800' },
  sub:   { fontSize: 11, fontWeight: '700' },
  label: { fontSize: 11, textAlign: 'center' },
});
