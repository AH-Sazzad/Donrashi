import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Modal, Pressable,
  RefreshControl, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { bazarApi, mealBooksApi } from '@/services/mealApi';
import { BazarSchedule, MealBook, MealBookMember } from '@/types';

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function MealBazarScreen() {
  const { id }     = useLocalSearchParams<{ id: string }>();
  const mealBookId = Number(id);
  const isDark     = useColorScheme() === 'dark';
  const { user }   = useAuth();

  const bg          = isDark ? '#0F0F1A' : '#F8F9FF';
  const cardBg      = isDark ? '#1E1E2E' : '#FFFFFF';
  const textPrimary = isDark ? '#F1F5F9' : '#1E293B';
  const textSec     = isDark ? '#94A3B8' : '#64748B';
  const inputBg     = isDark ? '#2A2A3E' : '#F1F5F9';
  const borderColor = isDark ? '#2A2A3E' : '#E2E8F0';

  const [book, setBook]             = useState<MealBook | null>(null);
  const [schedules, setSchedules]   = useState<BazarSchedule[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm]     = useState(false);
  const [generating, setGenerating] = useState(false);

  // Date range for generation
  const [fromDate, setFromDate] = useState(toISO(new Date()));
  const [toDate, setToDate]     = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 13);
    return toISO(d);
  });

  const load = useCallback(async () => {
    try {
      const [b, s] = await Promise.all([
        mealBooksApi.get(mealBookId),
        bazarApi.list(mealBookId),
      ]);
      setBook(b);
      setSchedules(Array.isArray(s) ? s : []);
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [mealBookId]);

  useEffect(() => { load(); }, [load]);

  const isManager = book?.meal_book_members?.find((m: MealBookMember) => m.user_id === user?.id)?.role === 'manager';

  function buildDateRange(from: string, to: string): string[] {
    const dates: string[] = [];
    const cur = new Date(from);
    const end = new Date(to);
    while (cur <= end) {
      dates.push(toISO(new Date(cur)));
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  }

  async function handleGenerate() {
    if (!fromDate || !toDate) { Alert.alert('Missing', 'Select a date range.'); return; }
    const dates = buildDateRange(fromDate, toDate);
    if (dates.length > 60) { Alert.alert('Too wide', 'Maximum 60 days at once.'); return; }
    setGenerating(true);
    try {
      await bazarApi.generate(mealBookId, dates);
      setShowForm(false);
      load();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to generate schedule.');
    } finally { setGenerating(false); }
  }

  function isToday(dateStr: string) {
    return dateStr === toISO(new Date());
  }

  function isUpcoming(dateStr: string) {
    return dateStr >= toISO(new Date());
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color={textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textPrimary }]}>Bazar Schedule</Text>
        {isManager && (
          <TouchableOpacity onPress={() => setShowForm(true)} style={styles.addBtn}>
            <Ionicons name="calendar-outline" size={18} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      ) : (
        <FlatList
          data={schedules}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor="#6C63FF" colors={['#6C63FF']} />
          }
          ListEmptyComponent={
            <View style={[styles.emptyCard, { backgroundColor: cardBg }]}>
              <Ionicons name="cart-outline" size={48} color={textSec} />
              <Text style={[styles.emptyTitle, { color: textPrimary }]}>No bazar schedule</Text>
              {isManager && (
                <TouchableOpacity onPress={() => setShowForm(true)} style={styles.genBtn}>
                  <Text style={styles.genBtnText}>Generate Schedule</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item }) => {
            const upcoming = isUpcoming(item.date);
            const today    = isToday(item.date);
            return (
              <View style={[
                styles.schedCard,
                { backgroundColor: today ? '#6C63FF' : cardBg },
              ]}>
                <View style={[styles.dateBox, {
                  backgroundColor: today ? 'rgba(255,255,255,0.2)' : '#6C63FF18',
                }]}>
                  <Text style={[styles.dateDay, { color: today ? '#FFF' : '#6C63FF' }]}>
                    {new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' })}
                  </Text>
                  <Text style={[styles.dateNum, { color: today ? '#FFF' : '#6C63FF' }]}>
                    {new Date(item.date).getDate()}
                  </Text>
                  <Text style={[styles.dateMon, { color: today ? 'rgba(255,255,255,0.75)' : textSec }]}>
                    {new Date(item.date).toLocaleDateString('en-US', { month: 'short' })}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  {(item.team_members?.length ?? 0) > 0
                    ? item.team_members!.map(m => (
                        <View key={m.id} style={styles.memberRow}>
                          <View style={[styles.memberDot, { backgroundColor: today ? 'rgba(255,255,255,0.4)' : '#6C63FF44' }]} />
                          <Text style={[styles.memberName, { color: today ? '#FFF' : textPrimary }]}>
                            {m.user?.name ?? `User #${m.user_id}`}
                          </Text>
                        </View>
                      ))
                    : <Text style={[styles.noTeam, { color: today ? 'rgba(255,255,255,0.6)' : textSec }]}>No team assigned</Text>
                  }
                </View>
                {today && (
                  <View style={styles.todayBadge}>
                    <Text style={styles.todayBadgeText}>Today</Text>
                  </View>
                )}
                {!today && upcoming && (
                  <Ionicons name="time-outline" size={16} color={textSec} />
                )}
              </View>
            );
          }}
        />
      )}

      {/* Generate modal */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowForm(false)} />
        <View style={[styles.sheet, { backgroundColor: cardBg }]}>
          <View style={styles.sheetHandle} />
          <Text style={[styles.sheetTitle, { color: textPrimary }]}>Generate Bazar Schedule</Text>
          <Text style={[styles.sheetSub, { color: textSec }]}>
            System will auto-assign teams fairly based on duty history.
            Members on leave are excluded.
          </Text>

          <Text style={[styles.formLabel, { color: textSec }]}>From Date</Text>
          <TextInput
            style={[styles.input, { backgroundColor: inputBg, color: textPrimary }]}
            value={fromDate} onChangeText={setFromDate}
            placeholder="YYYY-MM-DD" placeholderTextColor={textSec}
          />

          <Text style={[styles.formLabel, { color: textSec }]}>To Date</Text>
          <TextInput
            style={[styles.input, { backgroundColor: inputBg, color: textPrimary }]}
            value={toDate} onChangeText={setToDate}
            placeholder="YYYY-MM-DD" placeholderTextColor={textSec}
          />

          <TouchableOpacity
            onPress={handleGenerate}
            disabled={generating}
            style={[styles.genBtn2, generating && { opacity: 0.5 }]}>
            {generating
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.genBtnText2}>Generate</Text>}
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', flex: 1, marginLeft: 12 },
  addBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#6C63FF',
    justifyContent: 'center', alignItems: 'center',
  },

  list: { padding: 16, gap: 10, paddingBottom: 60 },

  emptyCard: {
    borderRadius: 20, padding: 40, alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  genBtn: {
    backgroundColor: '#6C63FF', paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 12, marginTop: 4,
  },
  genBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },

  schedCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 16,
    padding: 14, gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  dateBox: {
    width: 52, borderRadius: 12, padding: 8, alignItems: 'center',
  },
  dateDay: { fontSize: 11, fontWeight: '600' },
  dateNum: { fontSize: 20, fontWeight: '800', lineHeight: 24 },
  dateMon: { fontSize: 11 },

  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  memberDot: { width: 6, height: 6, borderRadius: 3 },
  memberName:{ fontSize: 14, fontWeight: '600' },
  noTeam:    { fontSize: 13 },

  todayBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  todayBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40, gap: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 16, elevation: 10,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 8 },
  sheetTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  sheetSub:   { fontSize: 12, lineHeight: 18, marginBottom: 12 },

  formLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  input: { borderRadius: 12, padding: 12, fontSize: 15, marginBottom: 12 },

  genBtn2: {
    backgroundColor: '#6C63FF', borderRadius: 14, height: 52,
    justifyContent: 'center', alignItems: 'center', marginTop: 8,
  },
  genBtnText2: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
