/**
 * Persistent header shown inside every meal book screen.
 * Always shows mess name + month so the user is always oriented.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';

interface Props {
  name: string;
  monthYear: string;
  role: 'manager' | 'member';
  onActivityPress?: () => void;
}

export function MealBookHeader({ name, monthYear, role, onActivityPress }: Props) {
  const isDark      = useColorScheme() === 'dark';
  const textPrimary = isDark ? '#F1F5F9' : '#1E293B';
  const textSec     = isDark ? '#94A3B8' : '#64748B';
  const border      = isDark ? '#2A2A3E' : '#E2E8F0';

  return (
    <View style={[styles.wrap, { borderBottomColor: border }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back}>
        <Ionicons name="arrow-back" size={24} color={textPrimary} />
      </TouchableOpacity>
      <View style={styles.center}>
        <Text style={[styles.name, { color: textPrimary }]} numberOfLines={1}>{name}</Text>
        <Text style={[styles.sub, { color: textSec }]}>
          {monthYear}{'  ·  '}{role === 'manager' ? '👑 Manager' : 'Member'}
        </Text>
      </View>
      {onActivityPress ? (
        <TouchableOpacity onPress={onActivityPress} style={styles.icon}>
          <Ionicons name="time-outline" size={22} color={textSec} />
        </TouchableOpacity>
      ) : <View style={styles.icon} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1,
  },
  back:   { padding: 4 },
  center: { flex: 1, marginLeft: 12 },
  name:   { fontSize: 17, fontWeight: '700' },
  sub:    { fontSize: 12, marginTop: 2 },
  icon:   { width: 32, alignItems: 'center' },
});
