/**
 * Settlement screen — shows separate Utility Due and Meal Due per member.
 * Manager can also toggle meal participation per member per month.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, RefreshControl, ScrollView,
  StyleSheet, Switch, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { mealBooksApi, mealMembersApi, settlementsApi } from '@/services/mealApi';
import { MealBook, MealBookMember, MonthlySettlement, MonthlySettlementMember } from '@/types';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function pad(n: number) { return String(n).padStart(2, '0'); }

function statusColor(status: string): string {
  if (status === 'open')        return '#43C59E';
  if (status === 'calculating') return '#F59E0B';
  if (status === 'finalized')   return '#6C63FF';
  return '#94A3B8';
}

function toSym(currency?: string) {
  return currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '৳';
}

function fmt(n: number, sym: string) {
  return `${sym}${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

// ─── Member Bill Card ─────────────────────────────────────────────────────────

function MemberBillCard({ ms, sym, isDark }: {
  ms: MonthlySettlementMember; sym: string; isDark: boolean;
}) {
  const cardBg      = isDark ? '#1E1E2E' : '#FFFFFF';
  const textPrimary = isDark ? '#F1F5F9' : '#1E293B';
  const textSec     = isDark ? '#94A3B8' : '#64748B';
  const borderColor = isDark ? '#2A2A3E' : '#F1F5F9';

  const mealDue    = Number(ms.meal_due);
  const utilityDue = Number(ms.utility_due);
  const totalDue   = mealDue + utilityDue;
  const mealCredit = Number(ms.meal_credit ?? 0);
  const utilityCredit = Number(ms.utility_credit ?? 0);

  return (
    <View style={[mbStyles.card, { backgroundColor: cardBg }]}>
      {/* Member name + meal status */}
      <View style={mbStyles.header}>
        <View style={mbStyles.avatar}>
          <Text style={mbStyles.avatarText}>
            {(ms.member?.name ?? '?').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[mbStyles.name, { color: textPrimary }]}>
            {ms.member?.name ?? `Member #${ms.member_id}`}
          </Text>
          {!ms.is_meal_active && (
            <View style={mbStyles.inactiveBadge}>
              <Ionicons name="moon-outline" size={11} color="#94A3B8" />
              <Text style={mbStyles.inactiveText}>Meal inactive this month</Text>
            </View>
          )}
        </View>
        {/* Total due badge */}
        <View style={[mbStyles.totalBadge, { backgroundColor: totalDue > 0 ? '#FF658418' : '#43C59E18' }]}>
          <Text style={[mbStyles.totalBadgeText, { color: totalDue > 0 ? '#FF6584' : '#43C59E' }]}>
            {totalDue > 0 ? `Owes ${fmt(totalDue, sym)}` : 'Settled ✓'}
          </Text>
        </View>
      </View>

      {/* Utility row */}
      <View style={[mbStyles.dueRow, { borderBottomColor: borderColor }]}>
        <View style={[mbStyles.dueIcon, { backgroundColor: '#F59E0B18' }]}>
          <Ionicons name="bulb-outline" size={15} color="#F59E0B" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[mbStyles.dueLabel, { color: textSec }]}>Utility</Text>
          <Text style={[mbStyles.dueShareText, { color: textSec }]}>
            Share: {fmt(Number(ms.utility_share) + Number(ms.other_share), sym)}
            {'  ·  '}Paid: {fmt(Number(ms.utility_paid), sym)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[mbStyles.dueAmt, { color: utilityDue > 0 ? '#F59E0B' : '#43C59E' }]}>
            {utilityDue > 0 ? `Due ${fmt(utilityDue, sym)}` : '✓'}
          </Text>
          {utilityCredit > 0 && (
            <Text style={[mbStyles.creditText, { color: '#43C59E' }]}>
              Credit {fmt(utilityCredit, sym)}
            </Text>
          )}
        </View>
      </View>

      {/* Meal row */}
      <View style={mbStyles.dueRow}>
        <View style={[mbStyles.dueIcon, { backgroundColor: '#6C63FF18' }]}>
          <Ionicons name="restaurant-outline" size={15} color="#6C63FF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[mbStyles.dueLabel, { color: textSec }]}>Meal</Text>
          {ms.is_meal_active ? (
            <Text style={[mbStyles.dueShareText, { color: textSec }]}>
              {Number(ms.actual_meals).toFixed(1)} meals · {fmt(Number(ms.meal_cost), sym)}
              {'  ·  '}Paid: {fmt(Number(ms.meal_paid), sym)}
            </Text>
          ) : (
            <Text style={[mbStyles.dueShareText, { color: '#94A3B8' }]}>Not participating this month</Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {ms.is_meal_active ? (
            <>
              <Text style={[mbStyles.dueAmt, { color: mealDue > 0 ? '#FF6584' : '#43C59E' }]}>
                {mealDue > 0 ? `Due ${fmt(mealDue, sym)}` : '✓'}
              </Text>
              {mealCredit > 0 && (
                <Text style={[mbStyles.creditText, { color: '#43C59E' }]}>
                  Credit {fmt(mealCredit, sym)}
                </Text>
              )}
            </>
          ) : (
            <Text style={[mbStyles.dueAmt, { color: '#94A3B8' }]}>৳0</Text>
          )}
        </View>
      </View>

      {/* Total */}
      <View style={[mbStyles.totalRow, { borderTopColor: borderColor }]}>
        <Text style={[mbStyles.totalLabel, { color: textSec }]}>Total Due</Text>
        <Text style={[mbStyles.totalAmt, { color: totalDue > 0 ? '#FF6584' : '#43C59E' }]}>
          {fmt(totalDue, sym)}
        </Text>
      </View>
    </View>
  );
}

const mbStyles = StyleSheet.create({
  card: {
    borderRadius: 18, padding: 16, gap: 0,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  avatar:      { width: 36, height: 36, borderRadius: 18, backgroundColor: '#6C63FF22', justifyContent: 'center', alignItems: 'center' },
  avatarText:  { fontSize: 16, fontWeight: '800', color: '#6C63FF' },
  name:        { fontSize: 14, fontWeight: '700' },
  inactiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  inactiveText:  { fontSize: 10, color: '#94A3B8' },
  totalBadge:    { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  totalBadgeText:{ fontSize: 11, fontWeight: '800' },
  dueRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10, borderBottomWidth: 1 },
  dueIcon:     { width: 30, height: 30, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  dueLabel:    { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  dueShareText:{ fontSize: 11 },
  dueAmt:      { fontSize: 13, fontWeight: '700' },
  creditText:  { fontSize: 10, fontWeight: '600' },
  totalRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1 },
  totalLabel:  { fontSize: 13, fontWeight: '700' },
  totalAmt:    { fontSize: 16, fontWeight: '800' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

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

  const [book, setBook]             = useState<MealBook | null>(null);
  const [members, setMembers]       = useState<MealBookMember[]>([]);
  const [settlements, setSettlements] = useState<MonthlySettlement[]>([]);
  const [selected, setSelected]     = useState<MonthlySettlement | null>(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [calculating, setCalculating] = useState(false);

  const load = useCallback(async () => {
    try {
      const [b, s, m] = await Promise.all([
        mealBooksApi.get(mealBookId),
        settlementsApi.list(mealBookId),
        mealMembersApi.list(mealBookId),
      ]);
      setBook(b);
      setMembers(Array.isArray(m) ? m : []);
      const arr = Array.isArray(s) ? s : [];
      setSettlements(arr);
      if (arr.length > 0) {
        setSelected(prev => prev ? arr.find(x => x.id === prev.id) ?? arr[0] : arr[0]);
      }
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [mealBookId]);

  useEffect(() => { load(); }, [load]);

  const isManager = members.find(m => m.user_id === user?.id)?.role === 'manager';
  const sym = toSym(book?.currency);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;

  async function handleCalculate() {
    if (!selected) return;
    setCalculating(true);
    try {
      const updated = await settlementsApi.calculate(mealBookId, selected.id);
      setSelected(updated); load();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Calculation failed.');
    } finally { setCalculating(false); }
  }

  async function handleClose() {
    if (!selected) return;
    Alert.alert('Close Month', 'Permanently lock this settlement?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Close', style: 'destructive',
        onPress: async () => {
          try {
            const updated = await settlementsApi.close(mealBookId, selected.id);
            setSelected(updated); load();
          } catch (e: unknown) { Alert.alert('Error', e instanceof Error ? e.message : 'Failed.'); }
        },
      },
    ]);
  }

  async function handleOpenMonth() {
    try {
      const s = await settlementsApi.create(mealBookId, currentMonth);
      setSelected(s); load();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to open settlement.');
    }
  }

  async function toggleMeal(memberId: number, active: boolean) {
    if (!selected) return;
    try {
      await mealMembersApi.toggleMealActive(mealBookId, memberId, {
        month_year: selected.month_year,
        is_meal_active: active,
      });
      load();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed.');
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top', 'bottom']}>

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color={textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textPrimary }]}>Settlement</Text>
        {isManager && !settlements.find(s => s.month_year === currentMonth) && (
          <TouchableOpacity onPress={handleOpenMonth} style={styles.openBtn}>
            <Ionicons name="add" size={16} color="#FFF" />
            <Text style={styles.openBtnText}>Open Month</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#6C63FF" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor="#6C63FF" colors={['#6C63FF']} />
          }>

          {/* Month selector */}
          {settlements.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}>
              {settlements.map(s => (
                <TouchableOpacity key={s.id} onPress={() => setSelected(s)}
                  style={[styles.monthChip,
                    { borderColor: selected?.id === s.id ? '#6C63FF' : borderColor },
                    selected?.id === s.id && { backgroundColor: '#6C63FF' }]}>
                  <Text style={[styles.monthChipText, { color: selected?.id === s.id ? '#FFF' : textPrimary }]}>
                    {s.month_year}
                  </Text>
                  <View style={[styles.statusDot, { backgroundColor: statusColor(s.status) }]} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {settlements.length === 0 && (
            <View style={[styles.emptyCard, { backgroundColor: cardBg }]}>
              <Ionicons name="calculator-outline" size={44} color={textSec} />
              <Text style={[{ fontSize: 16, fontWeight: '700', color: textPrimary }]}>No settlements yet</Text>
              {isManager && (
                <TouchableOpacity onPress={handleOpenMonth} style={styles.openBtn2}>
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>Open This Month</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {selected && (
            <>
              {/* Overview card */}
              <View style={[styles.overviewCard, { backgroundColor: cardBg }]}>
                <View style={styles.overviewHeader}>
                  <Text style={[styles.overviewTitle, { color: textPrimary }]}>{selected.month_year}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor(selected.status) + '22' }]}>
                    <Text style={[styles.statusText, { color: statusColor(selected.status) }]}>
                      {selected.status}
                    </Text>
                  </View>
                </View>

                {/* Two-column summary */}
                <View style={styles.overviewGrid}>
                  <View style={[styles.overviewItem, { backgroundColor: '#F59E0B18' }]}>
                    <Ionicons name="bulb-outline" size={16} color="#F59E0B" />
                    <Text style={[styles.overviewLabel, { color: textSec }]}>Utility Expense</Text>
                    <Text style={[styles.overviewValue, { color: '#F59E0B' }]}>
                      {fmt(Number(selected.total_utility_expense), sym)}
                    </Text>
                    {(selected.member_settlements?.length ?? 0) > 0 && (
                      <Text style={[styles.overviewSub, { color: textSec }]}>
                        ÷ {selected.member_settlements!.length} members
                      </Text>
                    )}
                  </View>
                  <View style={[styles.overviewItem, { backgroundColor: '#6C63FF18' }]}>
                    <Ionicons name="restaurant-outline" size={16} color="#6C63FF" />
                    <Text style={[styles.overviewLabel, { color: textSec }]}>Food Expense</Text>
                    <Text style={[styles.overviewValue, { color: '#6C63FF' }]}>
                      {fmt(Number(selected.total_food_expense), sym)}
                    </Text>
                    {selected.meal_rate > 0 && (
                      <Text style={[styles.overviewSub, { color: textSec }]}>
                        Rate: {sym}{Number(selected.meal_rate).toFixed(2)}/meal
                      </Text>
                    )}
                  </View>
                </View>
              </View>

              {/* Meal participation toggle (manager only, open/finalized status) */}
              {isManager && selected.status !== 'closed' && (
                <View style={[styles.card, { backgroundColor: cardBg }]}>
                  <Text style={[styles.cardTitle, { color: textPrimary }]}>Meal Participation</Text>
                  <Text style={[styles.cardSubtitle, { color: textSec }]}>
                    Toggle to exclude a member from meal billing this month.
                    They still pay utility.
                  </Text>
                  {members.filter(m => m.user_id != null).map((m, idx) => (
                    <View key={m.id} style={[styles.toggleRow,
                      idx < members.filter(x => x.user_id).length - 1 && { borderBottomColor: borderColor, borderBottomWidth: 1 }]}>
                      <Text style={[styles.toggleName, { color: textPrimary }]}>
                        {m.display_name ?? m.user?.name ?? `#${m.user_id}`}
                      </Text>
                      <Switch
                        value={m.is_meal_active !== false}
                        onValueChange={val => m.user_id && toggleMeal(m.user_id, val)}
                        trackColor={{ false: '#E2E8F0', true: '#6C63FF44' }}
                        thumbColor={m.is_meal_active !== false ? '#6C63FF' : '#94A3B8'}
                      />
                    </View>
                  ))}
                </View>
              )}

              {/* Per-member bill cards */}
              {(selected.member_settlements?.length ?? 0) > 0 && (
                <>
                  <Text style={[styles.sectionLabel, { color: textSec }]}>MEMBER BREAKDOWN</Text>
                  {selected.member_settlements!.map(ms => (
                    <MemberBillCard key={ms.member_id} ms={ms} sym={sym} isDark={isDark} />
                  ))}
                </>
              )}

              {/* Manager actions */}
              {isManager && selected.status !== 'closed' && (
                <View style={styles.actions}>
                  <TouchableOpacity onPress={handleCalculate} disabled={calculating}
                    style={[styles.calcBtn, calculating && { opacity: 0.5 }]}>
                    {calculating
                      ? <ActivityIndicator color="#FFF" />
                      : <><Ionicons name="calculator-outline" size={18} color="#FFF" />
                          <Text style={styles.calcBtnText}>Calculate Settlement</Text></>
                    }
                  </TouchableOpacity>

                  {selected.status === 'finalized' && (
                    <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                      <Ionicons name="lock-closed-outline" size={18} color="#FFF" />
                      <Text style={styles.closeBtnText}>Close Month</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
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
  openBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#6C63FF', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
  },
  openBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  scroll: { padding: 16, gap: 14, paddingBottom: 60 },

  monthChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5,
  },
  monthChipText: { fontSize: 13, fontWeight: '700' },
  statusDot:     { width: 8, height: 8, borderRadius: 4 },

  emptyCard:  { borderRadius: 20, padding: 40, alignItems: 'center', gap: 12 },
  openBtn2:   { backgroundColor: '#6C63FF', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 4 },

  overviewCard: {
    borderRadius: 18, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  overviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  overviewTitle:  { fontSize: 16, fontWeight: '700' },
  statusBadge:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText:     { fontSize: 11, fontWeight: '700' },
  overviewGrid:   { flexDirection: 'row', gap: 10 },
  overviewItem:   { flex: 1, borderRadius: 12, padding: 12, gap: 4, alignItems: 'center' },
  overviewLabel:  { fontSize: 11, fontWeight: '600' },
  overviewValue:  { fontSize: 16, fontWeight: '800' },
  overviewSub:    { fontSize: 10, textAlign: 'center' },

  card: {
    borderRadius: 18, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardTitle:    { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  cardSubtitle: { fontSize: 12, lineHeight: 17, marginBottom: 12 },
  toggleRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  toggleName:   { fontSize: 14, fontWeight: '600', flex: 1 },

  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4, marginLeft: 2 },

  actions:      { gap: 10 },
  calcBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 52, borderRadius: 14, backgroundColor: '#6C63FF',
  },
  calcBtnText:  { color: '#FFF', fontSize: 15, fontWeight: '700' },
  closeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 52, borderRadius: 14, backgroundColor: '#FF6584',
  },
  closeBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
