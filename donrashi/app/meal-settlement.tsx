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
import { mealBooksApi, settlementsApi } from '@/services/mealApi';
import { MealBook, MealBookMember, MonthlySettlement } from '@/types';

function toSymbol(currency?: string) {
  if (currency === 'USD') return '$';
  if (currency === 'EUR') return '€';
  return '৳';
}

function statusColor(status: string) {
  if (status === 'open')        return '#43C59E';
  if (status === 'calculating') return '#F59E0B';
  if (status === 'finalized')   return '#6C63FF';
  return '#94A3B8'; // closed
}

export default function MealSettlementScreen() {
  const { id }     = useLocalSearchParams<{ id: string }>();
  const mealBookId = Number(id);
  const isDark     = useColorScheme() === 'dark';
  const { user }   = useAuth();

  const bg          = isDark ? '#0F0F1A' : '#F8F9FF';
  const cardBg      = isDark ? '#1E1E2E' : '#FFFFFF';
  const textPrimary = isDark ? '#F1F5F9' : '#1E293B';
  const textSec     = isDark ? '#94A3B8' : '#64748B';
  const borderColor = isDark ? '#2A2A3E' : '#E2E8F0';

  const [book, setBook]               = useState<MealBook | null>(null);
  const [settlements, setSettlements] = useState<MonthlySettlement[]>([]);
  const [selected, setSelected]       = useState<MonthlySettlement | null>(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [calculating, setCalculating] = useState(false);

  const load = useCallback(async () => {
    try {
      const [b, s] = await Promise.all([
        mealBooksApi.get(mealBookId),
        settlementsApi.list(mealBookId),
      ]);
      setBook(b);
      const arr = Array.isArray(s) ? s : [];
      setSettlements(arr);
      if (arr.length > 0) setSelected(prev => prev ? arr.find(x => x.id === prev.id) ?? arr[0] : arr[0]);
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [mealBookId]);

  useEffect(() => { load(); }, [load]);

  const isManager = book?.meal_book_members?.find((m: MealBookMember) => m.user_id === user?.id)?.role === 'manager';
  const sym = toSymbol(book?.currency);

  async function handleCalculate() {
    if (!selected) return;
    setCalculating(true);
    try {
      const updated = await settlementsApi.calculate(mealBookId, selected.id);
      setSelected(updated);
      load();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Calculation failed.');
    } finally { setCalculating(false); }
  }

  async function handleClose() {
    if (!selected) return;
    Alert.alert('Close Month', 'This permanently locks the settlement. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Close', style: 'destructive',
        onPress: async () => {
          try {
            const updated = await settlementsApi.close(mealBookId, selected.id);
            setSelected(updated); load();
          } catch (e: unknown) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Failed to close.');
          }
        },
      },
    ]);
  }

  async function handleOpenThisMonth() {
    const monthYear = new Date().toISOString().slice(0, 7);
    try {
      const s = await settlementsApi.create(mealBookId, monthYear);
      setSelected(s); load();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to open settlement.');
    }
  }

  const myMember = selected?.member_settlements?.find(m => m.member_id === user?.id);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color={textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textPrimary }]}>Settlement</Text>
        {isManager && !settlements.find(s => s.month_year === new Date().toISOString().slice(0, 7)) && (
          <TouchableOpacity onPress={handleOpenThisMonth} style={styles.addBtn}>
            <Ionicons name="add" size={20} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor="#6C63FF" colors={['#6C63FF']} />
          }>

          {/* Month selector chips */}
          {settlements.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
              {settlements.map(s => (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => setSelected(s)}
                  style={[
                    styles.monthChip,
                    { borderColor: selected?.id === s.id ? '#6C63FF' : borderColor },
                    selected?.id === s.id && { backgroundColor: '#6C63FF' },
                  ]}>
                  <Text style={[styles.monthChipText, { color: selected?.id === s.id ? '#FFF' : textPrimary }]}>
                    {s.month_year}
                  </Text>
                  <View style={[styles.statusDot, { backgroundColor: statusColor(s.status) }]} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Empty state */}
          {settlements.length === 0 && (
            <View style={[styles.emptyCard, { backgroundColor: cardBg }]}>
              <Ionicons name="calculator-outline" size={48} color={textSec} />
              <Text style={[styles.emptyTitle, { color: textPrimary }]}>No settlements yet</Text>
              {isManager && (
                <TouchableOpacity onPress={handleOpenThisMonth} style={styles.openBtn}>
                  <Text style={styles.openBtnText}>Open This Month</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {selected && (
            <>
              {/* Totals card */}
              <View style={[styles.card, { backgroundColor: cardBg }]}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { color: textPrimary }]}>{selected.month_year}</Text>
                  <View style={[styles.badge, { backgroundColor: statusColor(selected.status) + '22' }]}>
                    <Text style={[styles.badgeText, { color: statusColor(selected.status) }]}>
                      {selected.status}
                    </Text>
                  </View>
                </View>

                {[
                  ['Food Expense',    `${sym}${Number(selected.total_food_expense).toLocaleString('en-US', { minimumFractionDigits: 2 })}`],
                  ['Utilities',       `${sym}${Number(selected.total_utility_expense).toLocaleString('en-US', { minimumFractionDigits: 2 })}`],
                  ['Other',           `${sym}${Number(selected.total_other_expense).toLocaleString('en-US', { minimumFractionDigits: 2 })}`],
                  ['Total Meals (weighted)', Number(selected.total_actual_meals).toFixed(2)],
                  ['Meal Rate',       `${sym}${Number(selected.meal_rate).toFixed(4)}/meal`],
                ].map(([label, value]) => (
                  <View key={label as string} style={[styles.row, { borderBottomColor: borderColor }]}>
                    <Text style={[styles.rowLabel, { color: textSec }]}>{label}</Text>
                    <Text style={[styles.rowValue, { color: textPrimary }]}>{value}</Text>
                  </View>
                ))}
              </View>

              {/* My settlement card */}
              {myMember && (
                <View style={[styles.card, {
                  backgroundColor: Number(myMember.due_amount) >= 0 ? '#FF658412' : '#43C59E12',
                }]}>
                  <Text style={[styles.cardTitle, { color: textPrimary, marginBottom: 12 }]}>My Settlement</Text>

                  {[
                    ['Actual Meals',    `${Number(myMember.actual_meals).toFixed(2)} meals`],
                    ['Billable Meals',  `${Number(myMember.billable_meals).toFixed(2)} meals`],
                    ['Meal Cost',       `${sym}${Number(myMember.meal_cost).toLocaleString('en-US', { minimumFractionDigits: 2 })}`],
                    ['Utility Share',   `${sym}${Number(myMember.utility_share).toLocaleString('en-US', { minimumFractionDigits: 2 })}`],
                    ['Other Share',     `${sym}${Number(myMember.other_share).toLocaleString('en-US', { minimumFractionDigits: 2 })}`],
                    ['Total Bill',      `${sym}${Number(myMember.total_bill).toLocaleString('en-US', { minimumFractionDigits: 2 })}`],
                    ['Deposited',       `${sym}${Number(myMember.total_deposited).toLocaleString('en-US', { minimumFractionDigits: 2 })}`],
                  ].map(([label, value]) => (
                    <View key={label as string} style={[styles.row, { borderBottomColor: borderColor }]}>
                      <Text style={[styles.rowLabel, { color: textSec }]}>{label}</Text>
                      <Text style={[styles.rowValue, { color: textPrimary }]}>{value}</Text>
                    </View>
                  ))}

                  <View style={styles.dueRow}>
                    <Text style={[styles.dueLabel, { color: textSec }]}>
                      {Number(myMember.due_amount) >= 0 ? 'Amount Due' : 'Refund Due'}
                    </Text>
                    <Text style={[styles.dueAmount, {
                      color: Number(myMember.due_amount) >= 0 ? '#FF6584' : '#43C59E',
                    }]}>
                      {Number(myMember.due_amount) >= 0 ? '' : '+'}{sym}
                      {Math.abs(Number(myMember.due_amount)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                </View>
              )}

              {/* All members */}
              {(selected.member_settlements?.length ?? 0) > 0 && (
                <View style={[styles.card, { backgroundColor: cardBg }]}>
                  <Text style={[styles.cardTitle, { color: textPrimary, marginBottom: 12 }]}>All Members</Text>
                  {selected.member_settlements!.map(m => (
                    <View key={m.member_id} style={[styles.memberRow, { borderBottomColor: borderColor }]}>
                      <Text style={[styles.memberName, { color: textPrimary }]}>
                        {m.member?.name ?? `#${m.member_id}`}
                      </Text>
                      <Text style={[styles.memberMeals, { color: textSec }]}>
                        {Number(m.billable_meals).toFixed(1)} meals
                      </Text>
                      <Text style={[styles.memberDue, {
                        color: Number(m.due_amount) >= 0 ? '#FF6584' : '#43C59E',
                      }]}>
                        {Number(m.due_amount) >= 0 ? '-' : '+'}{sym}
                        {Math.abs(Number(m.due_amount)).toLocaleString()}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Manager action buttons */}
              {isManager && selected.status !== 'closed' && (
                <View style={styles.actions}>
                  <TouchableOpacity
                    onPress={handleCalculate}
                    disabled={calculating}
                    style={[styles.actionBtn, { backgroundColor: '#6C63FF' }, calculating && { opacity: 0.5 }]}>
                    {calculating
                      ? <ActivityIndicator color="#FFF" />
                      : <>
                          <Ionicons name="calculator-outline" size={18} color="#FFF" />
                          <Text style={styles.actionBtnText}>Calculate Settlement</Text>
                        </>
                    }
                  </TouchableOpacity>

                  {selected.status === 'finalized' && (
                    <TouchableOpacity onPress={handleClose} style={[styles.actionBtn, { backgroundColor: '#FF6584' }]}>
                      <Ionicons name="lock-closed-outline" size={18} color="#FFF" />
                      <Text style={styles.actionBtnText}>Close Month</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll:    { padding: 16, gap: 16, paddingBottom: 60 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', flex: 1, marginLeft: 12 },
  addBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#6C63FF',
    justifyContent: 'center', alignItems: 'center',
  },

  monthChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5,
  },
  monthChipText: { fontSize: 13, fontWeight: '700' },
  statusDot:     { width: 8, height: 8, borderRadius: 4 },

  emptyCard: {
    borderRadius: 20, padding: 40, alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  openBtn: {
    backgroundColor: '#6C63FF', paddingHorizontal: 24,
    paddingVertical: 12, borderRadius: 12, marginTop: 4,
  },
  openBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },

  card: {
    borderRadius: 20, padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  cardTitle:  { fontSize: 15, fontWeight: '700' },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1 },
  rowLabel: { fontSize: 13 },
  rowValue: { fontSize: 13, fontWeight: '600' },

  dueRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 12, paddingTop: 12, borderTopWidth: 1.5, borderTopColor: 'rgba(0,0,0,0.08)',
  },
  dueLabel:  { fontSize: 14, fontWeight: '700' },
  dueAmount: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },

  memberRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, gap: 8,
  },
  memberName:  { flex: 1, fontSize: 14, fontWeight: '600' },
  memberMeals: { fontSize: 12, minWidth: 70, textAlign: 'center' },
  memberDue:   { fontSize: 14, fontWeight: '700', minWidth: 80, textAlign: 'right' },

  actions:   { gap: 10 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 52, borderRadius: 14,
  },
  actionBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
