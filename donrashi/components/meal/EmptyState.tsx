import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';

interface Props {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, message, actionLabel, onAction }: Props) {
  const isDark    = useColorScheme() === 'dark';
  const cardBg    = isDark ? '#1E1E2E' : '#FFFFFF';
  const textPrim  = isDark ? '#F1F5F9' : '#1E293B';
  const textSec   = isDark ? '#94A3B8' : '#64748B';

  return (
    <View style={[styles.card, { backgroundColor: cardBg }]}>
      <Ionicons name={icon} size={48} color={textSec} />
      <Text style={[styles.title, { color: textPrim }]}>{title}</Text>
      {message ? <Text style={[styles.message, { color: textSec }]}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction} style={styles.btn}>
          <Text style={styles.btnText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    margin: 20, borderRadius: 20, padding: 36,
    alignItems: 'center', gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  title:   { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  message: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  btn: {
    marginTop: 6, backgroundColor: '#6C63FF',
    paddingHorizontal: 24, paddingVertical: 11, borderRadius: 12,
  },
  btnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
});
