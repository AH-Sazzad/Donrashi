/**
 * Manager Meal Screen — GitHub-style heatmap calendar for ALL members.
 * Features:
 *  - All members in rows, days in columns
 *  - Pending entries shown in amber (need approval)
 *  - Manager can approve / reject pending entries
 *  - Manager can tap any cell to edit (past or present)
 *  - Shows per-person total + grand total
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { mealBooksApi, mealMembersApi, mealRecordsApi, mealTypesApi } from '@/services/mealApi';
import { MealBook, MealBookMember, MealRecord, MealType } from '@/types';

function pad(n: number) { return String(n).padStart(2, '0'); }
function toISO(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function MealManagerMealsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const mealBookId = Number(id);
  const isDark = useColorScheme() === 'dark';

  const bg = isDark ? '#0F0F1A' : '#F8F9FF';
  const cardBg = isDark ? '#1E1E2E' : '#FFFFFF';
  const textPrimary = isDark ? '#F1F5F9' : '#1E293B';
  const textSec = isDark ? '#94A3B8' : '#64748B';
  const inputBg = isDark ? '#2A2A3E' : '#F1F5F9';
  const borderColor = isDark ? '#2A2A3E' : '#E2E8F0';

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [book, setBook] = useState<MealBook | null>(null);
  const [members, setMembers] = useState<MealBookMember[]>([]);
  const [types, setTypes] = useState<MealType[]>([]);
  const [records, setRecords] = useState<MealRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Edit modal
  const [editCell, setEditCell] = useState<{ member: MealBookMember; date: string } | null>(null);
  const [editQty, setEditQty] = useState('1');
  const [editType, setEditType] = useState<MealType | null>(null);
  const [editReason, setEditReason] = useState('');
  const [saving, setSaving] = useState(false);

  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const from = `${year}-${pad(month)}-01`;
  const to   = `${year}-${pad(month)}-${pad(daysInMonth)}`;

  const load = useCallback(async () => {
    try {
      const [b, m, t, r] = await Promise.all([
        mealBooksApi.get(mealBookId),
        mealMembersApi.list(mealBookId),
        mealTypesApi.list(mealBookId),
        mealRecordsApi.list(mealBookId, { from, to }),
      ]);
      setBook(b);
      setMembers(Array.isArray(m) ? m : []);
      setTypes(Array.isArray(t) ? t.filter(x => x.is_active) : []);
      setRecords(Array.isArray(r) ? r : []);
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [mealBookId, from, to]);

  useEffect(() => { load(); }, [load]);

  function navMonth(dir: 1 | -1) {
    let m = month + dir, y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1)  { m = 12; y--; }
    setMonth(m); setYear(y);
  }

  // Records for a specific member on a specific date
  function getRecords(memberId: number | null, dateStr: string): MealRecord[] {
    return records.filter(r => r.member_id === memberId && r.date.startsWith(dateStr));
  }

  // Cell color by status
  function cellColor(recs: MealRecord[]): string {
    if (recs.length === 0) return isDark ? '#2A2A3E' : '#F1F5F9';
    if (recs.some(r => r.status === 'pending')) return '#F59E0B';
    if (recs.some(r => r.status === 'approved')) return '#43C59E';
    return '#FF6584'; // rejected
  }

  // Weighted meal total for a member
  function memberTotal(memberId: number | null): number {
    return records
      .filter(r => r.member_id === memberId && r.status === 'approved')
      .reduce((sum, r) => sum + r.quantity * (r.meal_type?.weight ?? 1), 0);
  }

  async function handleApproveRecord(record: MealRecord) {
    try {
      await mealRecordsApi.approve(mealBookId, record.id);
      setRecords(prev => prev.map(r => r.id === record.id ? { ...r, status: 'approved' } : r));
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed.');
    }
  }

  async function handleRejectRecord(record: MealRecord) {
    try {
      await mealRecordsApi.reject(mealBookId, record.id);
      setRecords(prev => prev.map(r => r.id === record.id ? { ...r, status: 'rejected' } : r));
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed.');
    }
  }

  async function handleSaveEdit() {
    if (!editCell || !editType) return;
    setSaving(true);
    try {
      await mealRecordsApi.record(mealBookId, {
        meal_type_id: editType.id,
        date: editCell.date,
        quantity: Number(editQty) || 1,
        member_id: editCell.member.user_id ?? undefined,
        edit_reason: editReason.trim() || 'Manager edit',
      });
      setEditCell(null);
      load();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed.');
    } finally { setSaving(false); }
  }

  const pendingCount = records.filter(r => r.status === 'pending').length;
  const grandTotal   = records.filter(r => r.status === 'approved')
    .reduce((sum, r) => sum + r.quantity * (r.meal_type?.weight ?? 1), 0);

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
          <Text style={[styles.monthTitle, { color: textPrimary }]}>{MONTH_NAMES[month-1]} {year}</Text>
          <TouchableOpacity onPress={() => navMonth(1)} style={{ padding: 8 }}>
            <Ionicons name="chevron-forward" size={20} color={textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.headerRight}>
          {pendingCount > 0 && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>{pendingCount} pending</Text>
            </View>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#6C63FF" /></View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#6C63FF" colors={['#6C63FF']} />}>

          {/* Summary row */}
          <View style={[styles.summaryRow, { backgroundColor: cardBg }]}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: textSec }]}>Total Meals</Text>
              <Text style={[styles.summaryValue, { color: textPrimary }]}>{grandTotal.toFixed(1)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: textSec }]}>Members</Text>
              <Text style={[styles.summaryValue, { color: textPrimary }]}>{members.length}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: textSec }]}>Pending</Text>
              <Text style={[styles.summaryValue, { color: pendingCount > 0 ? '#F59E0B' : textPrimary }]}>{pendingCount}</Text>
            </View>
          </View>

          {/* Legend */}
          <View style={[styles.legend, { backgroundColor: cardBg }]}>
            {[
              { color: '#43C59E', label: 'Approved' },
              { color: '#F59E0B', label: 'Pending' },
              { color: '#FF6584', label: 'Rejected' },
              { color: isDark ? '#2A2A3E' : '#F1F5F9', label: 'None' },
            ].map(l => (
              <View key={l.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: l.color }]} />
                <Text style={[styles.legendLabel, { color: textSec }]}>{l.label}</Text>
              </View>
            ))}
          </View>

          {/* Grid: member rows × day columns */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              {/* Day header */}
              <View style={styles.gridRow}>
                <View style={styles.memberNameCol} />
                {days.map(d => (
                  <View key={d} style={styles.dayCell}>
                    <Text style={[styles.dayNum, { color: textSec }]}>{d}</Text>
                  </View>
                ))}
                <View style={styles.totalCol}>
                  <Text style={[styles.dayNum, { color: textSec }]}>Total</Text>
                </View>
              </View>

              {/* Member rows */}
              {members.map(m => {
                const total = memberTotal(m.user_id);
                return (
                  <View key={m.id} style={[styles.gridRow, { borderTopColor: borderColor, borderTopWidth: 1 }]}>
                    {/* Member name */}
                    <View style={styles.memberNameCol}>
                      <Text style={[styles.memberNameText, { color: textPrimary }]} numberOfLines={1}>
                        {m.display_name ?? m.user?.name ?? `#${m.id}`}
                      </Text>
                      {m.is_ghost && <Text style={[styles.ghostTag, { color: '#F59E0B' }]}>offline</Text>}
                    </View>

                    {/* Day cells */}
                    {days.map(d => {
                      const dateStr = `${year}-${pad(month)}-${pad(d)}`;
                      const recs    = getRecords(m.user_id, dateStr);
                      const color   = cellColor(recs);
                      const hasPending = recs.some(r => r.status === 'pending');
                      return (
                        <TouchableOpacity
                          key={d}
                          onPress={() => {
                            if (hasPending) {
                              // Show approve/reject options
                              const pending = recs.filter(r => r.status === 'pending');
                              Alert.alert(
                                'Pending Meal',
                                `${m.display_name ?? m.user?.name} — ${dateStr}\n${pending.map(r => r.meal_type?.name ?? '').join(', ')}`,
                                [
                                  { text: 'Approve', onPress: () => pending.forEach(r => handleApproveRecord(r)) },
                                  { text: 'Reject', style: 'destructive', onPress: () => pending.forEach(r => handleRejectRecord(r)) },
                                  { text: 'Cancel', style: 'cancel' },
                                ]
                              );
                            } else {
                              setEditCell({ member: m, date: dateStr });
                              setEditType(types[0] ?? null);
                              setEditQty('1');
                              setEditReason('');
                            }
                          }}
                          style={[styles.mealCell, { backgroundColor: color }]}>
                          {recs.length > 0 && (
                            <Text style={styles.mealCellCount}>
                              {recs.reduce((s, r) => s + r.quantity, 0)}
                            </Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}

                    {/* Row total */}
                    <View style={styles.totalCol}>
                      <Text style={[styles.totalText, { color: textPrimary }]}>{total.toFixed(1)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </ScrollView>
      )}

      {/* Edit cell modal */}
      <Modal visible={!!editCell} transparent animationType="fade" onRequestClose={() => setEditCell(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.editModal, { backgroundColor: cardBg }]}>
            <Text style={[styles.editTitle, { color: textPrimary }]}>
              {editCell?.member.display_name ?? editCell?.member.user?.name}
            </Text>
            <Text style={[styles.editDate, { color: textSec }]}>{editCell?.date}</Text>

            <Text style={[styles.formLabel, { color: textSec }]}>Meal Type</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {types.map(t => (
                <Pressable key={t.id} onPress={() => setEditType(t)}
                  style={[styles.chip, { borderColor: '#6C63FF' }, editType?.id === t.id && { backgroundColor: '#6C63FF' }]}>
                  <Text style={[styles.chipText, { color: editType?.id === t.id ? '#FFF' : '#6C63FF' }]}>
                    {t.name} (×{t.weight})
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.formLabel, { color: textSec }]}>Quantity</Text>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, color: textPrimary }]}
              value={editQty} onChangeText={setEditQty}
              keyboardType="number-pad" placeholder="1" placeholderTextColor={textSec}
            />

            <Text style={[styles.formLabel, { color: textSec }]}>Reason for edit</Text>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, color: textPrimary }]}
              value={editReason} onChangeText={setEditReason}
              placeholder="e.g. Member forgot to mark" placeholderTextColor={textSec}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={() => setEditCell(null)}
                style={[styles.cancelBtn, { backgroundColor: inputBg, flex: 1 }]}>
                <Text style={[{ fontWeight: '600', fontSize: 14, color: textSec }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveEdit} disabled={saving}
                style={[styles.saveBtn2, saving && { opacity: 0.5 }]}>
                {saving ? <ActivityIndicator color="#FFF" size="small" />
                  : <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  monthNav: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  monthTitle: { fontSize: 16, fontWeight: '700', minWidth: 120, textAlign: 'center' },
  headerRight: { minWidth: 80, alignItems: 'flex-end' },
  pendingBadge: { backgroundColor: '#F59E0B22', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  pendingBadgeText: { color: '#F59E0B', fontSize: 11, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', paddingVertical: 12, marginHorizontal: 16, borderRadius: 14, paddingHorizontal: 8, marginTop: 8 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 11, marginBottom: 2 },
  summaryValue: { fontSize: 18, fontWeight: '800' },
  legend: { flexDirection: 'row', gap: 12, padding: 12, marginHorizontal: 16, borderRadius: 10, marginTop: 8, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendLabel: { fontSize: 11 },
  gridRow: { flexDirection: 'row', alignItems: 'center' },
  memberNameCol: { width: 80, paddingHorizontal: 8, paddingVertical: 6 },
  memberNameText: { fontSize: 11, fontWeight: '600' },
  ghostTag: { fontSize: 9, fontWeight: '700' },
  dayCell: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
  dayNum: { fontSize: 9, fontWeight: '600' },
  mealCell: { width: 28, height: 28, margin: 1, borderRadius: 4, justifyContent: 'center', alignItems: 'center' },
  mealCellCount: { fontSize: 9, fontWeight: '800', color: '#FFF' },
  totalCol: { width: 44, alignItems: 'center', paddingHorizontal: 4 },
  totalText: { fontSize: 11, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  editModal: { width: '100%', borderRadius: 24, padding: 24, gap: 8 },
  editTitle: { fontSize: 18, fontWeight: '800' },
  editDate: { fontSize: 13, marginBottom: 4 },
  formLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  input: { borderRadius: 12, padding: 12, fontSize: 15, marginBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  chipText: { fontSize: 12, fontWeight: '600' },
  cancelBtn: { height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  saveBtn2: { flex: 1, height: 48, borderRadius: 12, backgroundColor: '#6C63FF', justifyContent: 'center', alignItems: 'center' },
});
