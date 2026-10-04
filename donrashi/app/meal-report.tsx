/**
 * Monthly Report — full summary for the selected month.
 * Shows: per-member meals, expenses breakdown, bazar trips, settlement preview.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { settlementsApi } from '@/services/mealApi';
import { MealReport } from '@/types';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function pad(n: number) { return String(n).padStart(2, '0'); }

export default function MealReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const mealBookId = Number(id);
  const isDark = useColorScheme() === 'dark';

  const bg = isDark ? '#0F0F1A' : '#F8F9FF';
  const cardBg = isDark ? '#1E1E2E' : '#FFFFFF';
  const textPrimary = isDark ? '#F1F5F9' : '#1E293B';
  const textSec = isDark ? '#94A3B8' : '#64748B';
  const borderColor = isDark ? '#2A2A3E' : '#E2E8F0';

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const monthYear = `${year}-${pad(month)}`;

  const [report, setReport] = useState<MealReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await settlementsApi.report(mealBookId, monthYear);
      setReport(r);
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [mealBookId, monthYear]);

  useEffect(() => { load(); }, [load]);

  function navMonth(dir: 1 | -1) {
    let m = month + dir, y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1)  { m = 12; y--; }
    setMonth(m); setYear(y);
  }

  const sym = report?.meal_book.currency === 'USD' ? '$' : report?.meal_book.currency === 'EUR' ? '€' : '৳';

  function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <View style={[styles.card, { backgroundColor: cardBg }]}>
        <Text style={[styles.cardTitle, { color: textPrimary }]}>{title}</Text>
        {children}
      </View>
    );
  }

  function Row({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
    return (
      <View style={[styles.row, { borderBottomColor: borderColor }]}>
        <Text style={[styles.rowLabel, { color: textSec }]}>{label}</Text>
        <Text style={[styles.rowValue, { color: color ?? textPrimary, fontWeight: bold ? '800' : '600' }]}>{value}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top', 'bottom']}>

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color={textPrimary} />
        </TouchableOpacity>
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => navMonth(-1)} style={{ padding: 8 }}>
            <Ionicons name="chevron-back" size={20} color={textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.monthTitle, { color: textPrimary }]}>
            {MONTH_NAMES[month - 1]} {year}
          </Text>
          <TouchableOpacity onPress={() => navMonth(1)} style={{ padding: 8 }}>
            <Ionicons name="chevron-forward" size={20} color={textPrimary} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.reportLabel, { color: textSec }]}>Report</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#8B5CF6" /></View>
      ) : !report ? (
        <View style={styles.center}>
          <Ionicons name="document-outline" size={48} color={textSec} />
          <Text style={[{ color: textSec, fontSize: 14, marginTop: 8 }]}>No data for this month</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#8B5CF6" colors={['#8B5CF6']} />}>

          {/* ── Expense Summary ── */}
          <SectionCard title="Expenses">
            <Row label="Food / Bazar" value={`${sym}${Number(report.totals.food_expense).toLocaleString('en-US', { minimumFractionDigits: 2 })}`} color="#FF6584" />
            <Row label="Utilities" value={`${sym}${Number(report.totals.utility_expense).toLocaleString('en-US', { minimumFractionDigits: 2 })}`} color="#F59E0B" />
            <Row label="Other" value={`${sym}${Number(report.totals.other_expense).toLocaleString('en-US', { minimumFractionDigits: 2 })}`} color="#6C63FF" />
            <Row label="Meal Rate" value={report.totals.meal_rate ? `${sym}${Number(report.totals.meal_rate).toFixed(4)} / meal` : 'Not calculated'} color="#43C59E" />
            <Row label="Total Meals (weighted)" value={Number(report.totals.total_meals).toFixed(2)} bold />
          </SectionCard>

          {/* ── Per-Member Meals ── */}
          <SectionCard title="Meals per Member">
            {report.meal_summary.length === 0 ? (
              <Text style={[styles.emptyText, { color: textSec }]}>No meal records this month</Text>
            ) : (
              report.meal_summary.map((ms, i) => (
                <View key={i} style={[styles.row, { borderBottomColor: borderColor }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowLabel, { color: textPrimary, fontWeight: '600' }]}>
                      {ms.name}{ms.is_ghost ? ' 👤' : ''}
                    </Text>
                    {Number(ms.actual_meals) < (report.meal_book.min_billable_meals ?? 30) && (
                      <Text style={styles.warningText}>
                        ⚠️ Short — billed for {report.meal_book.min_billable_meals}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.rowValue, { color: textPrimary }]}>
                    {Number(ms.actual_meals).toFixed(2)} meals
                  </Text>
                </View>
              ))
            )}
          </SectionCard>

          {/* ── Settlement ── */}
          {report.settlement ? (
            <SectionCard title={`Settlement — ${report.settlement.status.toUpperCase()}`}>
              {report.settlement.member_settlements?.map((ms, i) => (
                <View key={i} style={[styles.memberSettleRow, { borderBottomColor: borderColor }]}>
                  <Text style={[styles.rowLabel, { color: textPrimary, flex: 1 }]}>{ms.member?.name}</Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.rowValue, { color: Number(ms.due_amount) >= 0 ? '#FF6584' : '#43C59E' }]}>
                      {Number(ms.due_amount) >= 0 ? 'Owes ' : 'Refund '}
                      {sym}{Math.abs(Number(ms.due_amount)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Text>
                    <Text style={[styles.memberSettleSub, { color: textSec }]}>
                      {Number(ms.billable_meals).toFixed(1)} meals · {sym}{Number(ms.total_bill).toLocaleString()}
                    </Text>
                  </View>
                </View>
              ))}
            </SectionCard>
          ) : (
            <View style={[styles.card, { backgroundColor: cardBg }]}>
              <Text style={[styles.cardTitle, { color: textPrimary }]}>Settlement</Text>
              <Text style={[styles.emptyText, { color: textSec }]}>
                Not calculated yet. Go to Settlement tab to calculate.
              </Text>
            </View>
          )}

          {/* ── Expense List ── */}
          <SectionCard title="All Expenses">
            {report.expenses.length === 0 ? (
              <Text style={[styles.emptyText, { color: textSec }]}>No expenses recorded</Text>
            ) : (
              report.expenses.map(e => (
                <View key={e.id} style={[styles.row, { borderBottomColor: borderColor }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowLabel, { color: textPrimary }]}>
                      {e.sub_category ?? e.category}
                    </Text>
                    <Text style={[styles.rowSub, { color: textSec }]}>
                      {e.expense_date}
                      {(e as any).paid_by_user?.name ? ` · ${(e as any).paid_by_user.name}` : ''}
                    </Text>
                  </View>
                  <Text style={[styles.rowValue, { color: '#FF6584' }]}>
                    -{sym}{Number(e.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              ))
            )}
          </SectionCard>

          {/* ── Bazar Trips ── */}
          <SectionCard title="Bazar Trips">
            {report.bazar.length === 0 ? (
              <Text style={[styles.emptyText, { color: textSec }]}>No bazar scheduled this month</Text>
            ) : (
              report.bazar.map(b => (
                <View key={b.id} style={[styles.row, { borderBottomColor: borderColor }]}>
                  <Text style={[styles.rowLabel, { color: textSec }]}>{b.date}</Text>
                  <Text style={[styles.rowValue, { color: textPrimary }]}>
                    {b.team_members?.map(m => m.user?.name?.split(' ')[0]).join(', ') ?? '—'}
                  </Text>
                </View>
              ))
            )}
          </SectionCard>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  monthNav: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  monthTitle: { fontSize: 16, fontWeight: '700', minWidth: 120, textAlign: 'center' },
  reportLabel: { fontSize: 12, minWidth: 48, textAlign: 'right' },
  scroll: { padding: 16, gap: 12 },
  card: {
    borderRadius: 18, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  rowLabel: { fontSize: 13 },
  rowValue: { fontSize: 13, fontWeight: '600' },
  rowSub:   { fontSize: 11, marginTop: 1 },
  emptyText: { fontSize: 13, paddingVertical: 12, textAlign: 'center' },
  warningText: { fontSize: 10, color: '#F59E0B', fontWeight: '600', marginTop: 1 },
  memberSettleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  memberSettleSub: { fontSize: 10, marginTop: 2 },
});
