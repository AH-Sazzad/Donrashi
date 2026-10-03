import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { mealRecordsApi, mealTypesApi } from '@/services/mealApi';
import { MealRecord, MealType } from '@/types';

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export default function MealCalendarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const mealBookId = Number(id);
  const isDark  = useColorScheme() === 'dark';
  const { user } = useAuth();

  const bg          = isDark ? '#0F0F1A' : '#F8F9FF';
  const cardBg      = isDark ? '#1E1E2E' : '#FFFFFF';
  const textPrimary = isDark ? '#F1F5F9' : '#1E293B';
  const textSec     = isDark ? '#94A3B8' : '#64748B';
  const borderColor = isDark ? '#2A2A3E' : '#E2E8F0';

  const now         = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [records, setRecords] = useState<MealRecord[]>([]);
  const [types, setTypes]     = useState<MealType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const from = `${year}-${String(month).padStart(2,'0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
    try {
      const [r, t] = await Promise.all([
        mealRecordsApi.list(mealBookId, { member_id: user?.id, from, to }),
        mealTypesApi.list(mealBookId),
      ]);
      setRecords(Array.isArray(r) ? r : []);
      setTypes(Array.isArray(t) ? t : []);
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [mealBookId, user?.id, year, month]);

  useEffect(() => { load(); }, [load]);

  function navMonth(dir: 1 | -1) {
    let m = month + dir, y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1)  { m = 12; y--; }
    setMonth(m); setYear(y);
  }

  // Build day grid
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const recordsByDate: Record<string, MealRecord[]> = {};
  records.forEach(r => {
    const d = r.date.split('T')[0];
    recordsByDate[d] = [...(recordsByDate[d] ?? []), r];
  });

  const totalMeals = records.reduce((sum, r) => {
    const type = types.find(t => t.id === r.meal_type_id);
    return sum + (r.quantity * (type?.weight ?? 1));
  }, 0);

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: bg }]} edges={['top','bottom']}>
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="close" size={24} color={textPrimary} />
        </TouchableOpacity>
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => navMonth(-1)} style={{ padding: 8 }}>
            <Ionicons name="chevron-back" size={20} color={textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.monthTitle, { color: textPrimary }]}>{MONTH_NAMES[month-1]} {year}</Text>
          <TouchableOpacity onPress={() => navMonth(1)} style={{ padding: 8 }}>
            <Ionicons name="chevron-forward" size={20} color={textPrimary} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.totalMeals, { color: '#6C63FF' }]}>{totalMeals.toFixed(1)} meals</Text>
      </View>

      {loading ? (
        <View style={[styles.center]}>
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#6C63FF" colors={['#6C63FF']} />}>

          {/* Type legend */}
          <View style={[styles.legendRow]}>
            {types.filter(t => t.is_active).map(t => (
              <View key={t.id} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#6C63FF' }]} />
                <Text style={[{ fontSize: 11, color: textSec }]}>{t.name} (×{t.weight})</Text>
              </View>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={styles.calGrid}>
            {days.map(day => {
              const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const dayRecords = recordsByDate[dateStr] ?? [];
              const isToday = dateStr === toISO(new Date());
              const hasMeals = dayRecords.length > 0;

              return (
                <View key={day} style={[
                  styles.calDay,
                  { backgroundColor: hasMeals ? '#6C63FF18' : cardBg },
                  isToday && { borderWidth: 2, borderColor: '#6C63FF' },
                ]}>
                  <Text style={[styles.calDayNum, { color: isToday ? '#6C63FF' : textPrimary }]}>{day}</Text>
                  {dayRecords.map(r => {
                    const t = types.find(x => x.id === r.meal_type_id);
                    return (
                      <Text key={r.id} style={[styles.calDayMeal, { color: '#6C63FF' }]}>
                        {t?.name?.charAt(0) ?? '?'}
                      </Text>
                    );
                  })}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  monthNav:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  monthTitle: { fontSize: 16, fontWeight: '700', minWidth: 110, textAlign: 'center' },
  totalMeals: { fontSize: 13, fontWeight: '700' },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },

  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  legendItem:{ flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },

  calGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  calDay: {
    width: '13%', minHeight: 56, borderRadius: 10,
    padding: 4, alignItems: 'center',
  },
  calDayNum:  { fontSize: 13, fontWeight: '600' },
  calDayMeal: { fontSize: 9, fontWeight: '700', marginTop: 2 },
});
