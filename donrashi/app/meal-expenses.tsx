import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, FlatList, KeyboardAvoidingView,
  Modal, Platform, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { bazarApi, mealBooksApi, mealExpensesApi, mealMembersApi } from '@/services/mealApi';
import { BazarSchedule, MealBook, MealBookExpense, MealBookMember } from '@/types';

const CAT_COLORS: Record<string, string> = { food: '#43C59E', utilities: '#F59E0B', other: '#6C63FF' };
const CAT_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  food: 'fast-food-outline', utilities: 'bulb-outline', other: 'cube-outline',
};

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function humanDate(s: string) {
  if (!s) return '';
  const raw = s.split('T')[0];
  const [y, m, d] = raw.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((today.getTime() - date.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff <= 6) return `${diff} days ago`;
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Swipeable expense row ─────────────────────────────────────────────────

const ROW_H = 80;
const DEL_W = 80;
const ACT_W = 140;

function SwipeableExpenseRow({ item, sym, isDark, isManager, onDelete, onEdit, onView }: {
  item: MealBookExpense; sym: string; isDark: boolean; isManager: boolean;
  onDelete: () => void; onEdit: () => void; onView: () => void;
}) {
  const cardBg = isDark ? '#1E1E2E' : '#FFFFFF';
  const textPrimary = isDark ? '#F1F5F9' : '#1E293B';
  const textSec = isDark ? '#94A3B8' : '#64748B';

  const tx = useRef(new Animated.Value(0)).current;
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const delOp = tx.interpolate({ inputRange: [0, DEL_W], outputRange: [0, 1], extrapolate: 'clamp' });
  const actOp = tx.interpolate({ inputRange: [-ACT_W, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  function snapBack() {
    Animated.spring(tx, { toValue: 0, useNativeDriver: true, tension: 120, friction: 10 }).start();
  }

  function onGesture({ nativeEvent }: { nativeEvent: { translationX: number } }) {
    const clamped = Math.max(-(ACT_W + 10), Math.min(DEL_W + 10, nativeEvent.translationX));
    tx.setValue(clamped);
  }

  function onStateChange({ nativeEvent }: { nativeEvent: { state: number; translationX: number } }) {
    if (nativeEvent.state !== State.END && nativeEvent.state !== State.CANCELLED) return;
    const v = nativeEvent.translationX;
    if (v > 70) {
      Animated.spring(tx, { toValue: DEL_W, useNativeDriver: true, tension: 120, friction: 10 }).start(() => setShowDeleteModal(true));
    } else if (v < -60) {
      Animated.spring(tx, { toValue: -ACT_W, useNativeDriver: true, tension: 120, friction: 10 }).start();
    } else {
      snapBack();
    }
  }

  return (
    <>
      {/* Delete confirm modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={() => { setShowDeleteModal(false); snapBack(); }}>
        <View style={mdStyles.overlay}>
          <View style={[mdStyles.card, { backgroundColor: cardBg }]}>
            <View style={[mdStyles.iconWrap, { backgroundColor: '#FF658418' }]}>
              <Ionicons name="trash-outline" size={28} color="#FF6584" />
            </View>
            <Text style={[mdStyles.title, { color: textPrimary }]}>Delete Expense?</Text>
            <Text style={[mdStyles.body, { color: textSec }]}>
              <Text style={{ fontWeight: '700', color: textPrimary }}>
                "{item.sub_category ?? item.category}"
              </Text>
              {' '}(
              {sym}{Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              ) will be deleted and the amount{' '}
              <Text style={{ fontWeight: '700', color: '#43C59E' }}>refunded to the mess wallet</Text>.
            </Text>
            <View style={mdStyles.actions}>
              <TouchableOpacity onPress={() => { setShowDeleteModal(false); snapBack(); }}
                style={[mdStyles.btn, { backgroundColor: isDark ? '#2A2A3E' : '#F1F5F9' }]}>
                <Text style={[mdStyles.btnText, { color: textSec }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setShowDeleteModal(false); onDelete(); }}
                style={[mdStyles.btn, { backgroundColor: '#FF6584' }]}>
                <Ionicons name="trash" size={15} color="#FFF" style={{ marginRight: 4 }} />
                <Text style={[mdStyles.btnText, { color: '#FFF' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={[styles.swipeWrap, { height: ROW_H }]}>
        {/* Delete bg */}
        <Animated.View style={[styles.delBg, { opacity: delOp, width: DEL_W }]}>
          <Ionicons name="trash" size={22} color="#FF6584" />
        </Animated.View>

        {/* Action buttons */}
        <Animated.View style={[styles.actBg, { opacity: actOp, width: ACT_W }]}>
          <TouchableOpacity style={[styles.actBtn, { backgroundColor: '#6C63FF' }]}
            onPress={() => { snapBack(); onView(); }}>
            <Ionicons name="eye-outline" size={18} color="#FFF" />
            <Text style={styles.actLabel}>View</Text>
          </TouchableOpacity>
          {isManager && (
            <TouchableOpacity style={[styles.actBtn, { backgroundColor: '#43C59E' }]}
              onPress={() => { snapBack(); onEdit(); }}>
              <Ionicons name="pencil" size={18} color="#FFF" />
              <Text style={styles.actLabel}>Edit</Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Main card */}
        <PanGestureHandler onGestureEvent={onGesture} onHandlerStateChange={onStateChange}
          activeOffsetX={[-10, 10]} failOffsetY={[-20, 20]}>
          <Animated.View style={[styles.expCard, { backgroundColor: cardBg, transform: [{ translateX: tx }] }]}>
            <View style={[styles.expIcon, { backgroundColor: CAT_COLORS[item.category] + '22' }]}>
              <Ionicons name={CAT_ICONS[item.category]} size={18} color={CAT_COLORS[item.category]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.expName, { color: textPrimary }]} numberOfLines={1}>
                {item.sub_category ?? item.category}
              </Text>
              <Text style={[styles.expMeta, { color: textSec }]} numberOfLines={1}>
                {humanDate(item.expense_date)}
                {(item as any).paid_by_user?.name ? `  ·  ${(item as any).paid_by_user.name}` : ''}
                {item.description ? `  ·  ${item.description}` : ''}
              </Text>
            </View>
            <Text style={[styles.expAmt, { color: '#FF6584' }]}>
              -{sym}{Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </Text>
          </Animated.View>
        </PanGestureHandler>
      </View>
    </>
  );
}

const mdStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  card: { width: '100%', borderRadius: 24, padding: 28, alignItems: 'center', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.25, shadowRadius: 24, elevation: 16 },
  iconWrap: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  body: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8, width: '100%' },
  btn: { flex: 1, height: 50, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  btnText: { fontSize: 15, fontWeight: '700' },
});

// ─── Screen ────────────────────────────────────────────────────────────────

type FormMode = 'add' | 'edit' | 'view' | null;

export default function MealExpensesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const mealBookId = Number(id);
  const isDark = useColorScheme() === 'dark';
  const { user } = useAuth();

  const bg = isDark ? '#0F0F1A' : '#F8F9FF';
  const cardBg = isDark ? '#1E1E2E' : '#FFFFFF';
  const textPrimary = isDark ? '#F1F5F9' : '#1E293B';
  const textSec = isDark ? '#94A3B8' : '#64748B';
  const inputBg = isDark ? '#2A2A3E' : '#F1F5F9';
  const borderColor = isDark ? '#2A2A3E' : '#E2E8F0';

  const [book, setBook] = useState<MealBook | null>(null);
  const [expenses, setExpenses] = useState<MealBookExpense[]>([]);
  const [members, setMembers] = useState<MealBookMember[]>([]);
  const [nextBazar, setNextBazar] = useState<BazarSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editTarget, setEditTarget] = useState<MealBookExpense | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [category, setCategory] = useState<'food' | 'utilities' | 'other'>('food');
  const [subCat, setSubCat] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [expDate, setExpDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [paidBy, setPaidBy] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const today = toISO(new Date());
      const [b, e, m, bazar] = await Promise.all([
        mealBooksApi.get(mealBookId),
        mealExpensesApi.list(mealBookId),
        mealMembersApi.list(mealBookId),
        bazarApi.list(mealBookId, { from: today }),
      ]);
      setBook(b);
      setExpenses(Array.isArray(e) ? e : []);
      const ms = Array.isArray(m) ? m : [];
      setMembers(ms);
      if (!paidBy && user?.id) setPaidBy(user.id);
      const upcoming = Array.isArray(bazar) ? bazar[0] ?? null : null;
      setNextBazar(upcoming);
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [mealBookId, user?.id]);

  useEffect(() => { load(); }, [load]);

  const isManager = members.find(m => m.user_id === user?.id)?.role === 'manager';
  const sym = book?.currency === 'BDT' ? '৳' : book?.currency === 'USD' ? '$' : '€';
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  function openAdd() {
    setEditTarget(null);
    setCategory('food'); setSubCat(''); setAmount(''); setNote('');
    setExpDate(new Date());
    setFormMode('add');
  }

  function openEdit(item: MealBookExpense) {
    setEditTarget(item);
    setCategory(item.category);
    setSubCat(item.sub_category ?? '');
    setAmount(String(item.amount));
    setNote(item.description ?? '');
    const [y, m, d] = item.expense_date.split('T')[0].split('-').map(Number);
    setExpDate(new Date(y, m - 1, d));
    setPaidBy(item.paid_by);
    setFormMode('edit');
  }

  function openView(item: MealBookExpense) {
    setEditTarget(item);
    setFormMode('view');
  }

  async function handleDelete(item: MealBookExpense) {
    try {
      await mealExpensesApi.delete(mealBookId, item.id);
      setExpenses(prev => prev.filter(e => e.id !== item.id));
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to delete.');
    }
  }

  async function handleSave() {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('Invalid', 'Enter a valid amount.'); return;
    }
    if (!paidBy) { Alert.alert('Missing', 'Select who paid.'); return; }
    setSaving(true);
    try {
      const body = {
        paid_by: paidBy,
        category,
        sub_category: subCat.trim() || undefined,
        amount: Number(amount),
        description: note.trim() || undefined,
        expense_date: toISO(expDate),
        month_year: `${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, '0')}`,
      };

      if (formMode === 'edit' && editTarget) {
        const updated = await mealExpensesApi.update(mealBookId, editTarget.id, body);
        setExpenses(prev => prev.map(e => e.id === editTarget.id ? updated : e));
      } else {
        const created = await mealExpensesApi.create(mealBookId, body);
        setExpenses(prev => [created, ...prev]);
      }
      setFormMode(null);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed.');
    } finally { setSaving(false); }
  }

  function onDateChange(_: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) setExpDate(date);
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={[{ flex: 1, backgroundColor: bg }]} edges={['top', 'bottom']}>

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={24} color={textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: textPrimary }]}>Expenses</Text>
          {isManager && (
            <TouchableOpacity onPress={openAdd} style={styles.addBtn}>
              <Ionicons name="add" size={20} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Next bazar team banner */}
        {nextBazar && (
          <View style={[styles.bazarBanner, { backgroundColor: '#6C63FF18' }]}>
            <Ionicons name="cart-outline" size={16} color="#6C63FF" />
            <Text style={[styles.bazarText, { color: '#6C63FF' }]}>
              Next bazar:{' '}
              <Text style={{ fontWeight: '700' }}>
                {new Date(nextBazar.date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
              </Text>
              {'  ·  '}
              {nextBazar.team_members?.map(m => m.user?.name?.split(' ')[0]).join(', ')}
            </Text>
          </View>
        )}

        {/* Total */}
        <View style={[styles.totalCard, { backgroundColor: '#FF658412' }]}>
          <Text style={[styles.totalLabel, { color: textSec }]}>Total Expenses</Text>
          <Text style={[styles.totalAmt, { color: '#FF6584' }]}>
            -{sym}{total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </Text>
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#6C63FF" />
          </View>
        ) : (
          <FlatList
            data={expenses}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); load(); }}
                tintColor="#6C63FF" colors={['#6C63FF']} />
            }
            ListEmptyComponent={
              <View style={{ alignItems: 'center', padding: 40, gap: 10 }}>
                <Ionicons name="receipt-outline" size={44} color={textSec} />
                <Text style={[{ color: textPrimary, fontSize: 16, fontWeight: '700' }]}>No expenses yet</Text>
                {isManager && (
                  <TouchableOpacity onPress={openAdd}
                    style={{ backgroundColor: '#6C63FF', paddingHorizontal: 24, paddingVertical: 11, borderRadius: 12 }}>
                    <Text style={{ color: '#FFF', fontWeight: '700' }}>Add First Expense</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
            renderItem={({ item }) => (
              <SwipeableExpenseRow
                item={item} sym={sym} isDark={isDark} isManager={!!isManager}
                onDelete={() => handleDelete(item)}
                onEdit={() => openEdit(item)}
                onView={() => openView(item)}
              />
            )}
          />
        )}

        {/* Add / Edit bottom sheet */}
        <Modal visible={formMode === 'add' || formMode === 'edit'} transparent animationType="slide"
          onRequestClose={() => setFormMode(null)}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Pressable style={styles.overlay} onPress={() => setFormMode(null)} />
            <View style={[styles.sheet, { backgroundColor: cardBg }]}>
              <View style={styles.sheetHandle} />
              <Text style={[styles.sheetTitle, { color: textPrimary }]}>
                {formMode === 'edit' ? 'Edit Expense' : 'Add Expense'}
              </Text>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                {/* Category */}
                <Text style={[styles.lbl, { color: textSec }]}>Category</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                  {(['food', 'utilities', 'other'] as const).map(c => (
                    <Pressable key={c} onPress={() => setCategory(c)}
                      style={[styles.chip, { borderColor: CAT_COLORS[c] }, category === c && { backgroundColor: CAT_COLORS[c] }]}>
                      <Text style={[styles.chipTxt, { color: category === c ? '#FFF' : CAT_COLORS[c] }]}>{c}</Text>
                    </Pressable>
                  ))}
                </View>

                {/* Sub category */}
                <Text style={[styles.lbl, { color: textSec }]}>Item Name</Text>
                <TextInput style={[styles.inp, { backgroundColor: inputBg, color: textPrimary }]}
                  value={subCat} onChangeText={setSubCat}
                  placeholder="e.g. Rice 5kg, Egg 30pcs, Gas" placeholderTextColor={textSec} />

                {/* Amount */}
                <Text style={[styles.lbl, { color: textSec }]}>Amount ({sym})</Text>
                <TextInput style={[styles.inp, { backgroundColor: inputBg, color: textPrimary }]}
                  value={amount} onChangeText={setAmount}
                  keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={textSec} />

                {/* Date */}
                <Text style={[styles.lbl, { color: textSec }]}>Date</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(true)}
                  style={[styles.inp, { backgroundColor: inputBg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                  <Text style={[{ color: textPrimary, fontSize: 15 }]}>{humanDate(toISO(expDate))}</Text>
                  <Ionicons name="calendar-outline" size={18} color="#6C63FF" />
                </TouchableOpacity>
                {showDatePicker && Platform.OS === 'android' && (
                  <DateTimePicker value={expDate} mode="date" display="default" onChange={onDateChange} maximumDate={new Date()} />
                )}
                {showDatePicker && Platform.OS === 'ios' && (
                  <View style={{ marginBottom: 12 }}>
                    <DateTimePicker value={expDate} mode="date" display="spinner" onChange={onDateChange} maximumDate={new Date()} style={{ height: 140 }} />
                    <TouchableOpacity onPress={() => setShowDatePicker(false)} style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: '#6C63FF', fontWeight: '700', fontSize: 15 }}>Done</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Note */}
                <Text style={[styles.lbl, { color: textSec }]}>Note (optional)</Text>
                <TextInput style={[styles.inp, { backgroundColor: inputBg, color: textPrimary, height: 68, textAlignVertical: 'top' }]}
                  value={note} onChangeText={setNote}
                  placeholder="e.g. Team Nayeem &amp; Sazzad bought from market" placeholderTextColor={textSec}
                  multiline />

                {/* Paid by */}
                <Text style={[styles.lbl, { color: textSec }]}>Paid By</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {members.map(m => {
                    const id = m.user_id ?? m.id;
                    const name = m.display_name ?? m.user?.name ?? `#${m.id}`;
                    return (
                      <Pressable key={m.id} onPress={() => setPaidBy(id)}
                        style={[styles.chip, { borderColor: '#6C63FF' }, paidBy === id && { backgroundColor: '#6C63FF' }]}>
                        <Text style={[styles.chipTxt, { color: paidBy === id ? '#FFF' : '#6C63FF' }]}>
                          {name.split(' ')[0]}{m.is_ghost ? ' 👤' : ''}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Bazar team hint */}
                {nextBazar && (
                  <View style={[styles.bazarHint, { backgroundColor: '#6C63FF12' }]}>
                    <Ionicons name="information-circle-outline" size={14} color="#6C63FF" />
                    <Text style={[styles.bazarHintTxt, { color: '#6C63FF' }]}>
                      Today's bazar team:{' '}
                      {nextBazar.team_members?.map(m => m.user?.name?.split(' ')[0]).join(' & ')}
                    </Text>
                  </View>
                )}

                <TouchableOpacity onPress={handleSave} disabled={saving}
                  style={[styles.saveBtn, saving && { opacity: 0.5 }]}>
                  {saving ? <ActivityIndicator color="#FFF" />
                    : <Text style={styles.saveBtnTxt}>{formMode === 'edit' ? 'Update Expense' : 'Save Expense'}</Text>}
                </TouchableOpacity>

                <View style={{ height: 20 }} />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* View modal */}
        <Modal visible={formMode === 'view'} transparent animationType="fade" onRequestClose={() => setFormMode(null)}>
          <View style={[mdStyles.overlay, { justifyContent: 'center' }]}>
            <View style={[styles.viewCard, { backgroundColor: cardBg }]}>
              {editTarget && (
                <>
                  <View style={[styles.viewIcon, { backgroundColor: CAT_COLORS[editTarget.category] + '22' }]}>
                    <Ionicons name={CAT_ICONS[editTarget.category]} size={32} color={CAT_COLORS[editTarget.category]} />
                  </View>
                  <Text style={[styles.viewTitle, { color: textPrimary }]}>
                    {editTarget.sub_category ?? editTarget.category}
                  </Text>
                  <Text style={[styles.viewAmt, { color: '#FF6584' }]}>
                    -{sym}{Number(editTarget.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </Text>

                  {[
                    ['Date', humanDate(editTarget.expense_date)],
                    ['Category', editTarget.category],
                    ['Paid By', (editTarget as any).paid_by_user?.name ?? `#${editTarget.paid_by}`],
                    ...(editTarget.description ? [['Note', editTarget.description]] : []),
                  ].map(([label, value]) => (
                    <View key={label} style={[styles.viewRow, { borderBottomColor: borderColor }]}>
                      <Text style={[styles.viewLabel, { color: textSec }]}>{label}</Text>
                      <Text style={[styles.viewValue, { color: textPrimary }]}>{value}</Text>
                    </View>
                  ))}

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, width: '100%' }}>
                    <TouchableOpacity onPress={() => setFormMode(null)}
                      style={[styles.viewBtn, { backgroundColor: isDark ? '#2A2A3E' : '#F1F5F9', flex: 1 }]}>
                      <Text style={[{ fontWeight: '600', color: textSec }]}>Close</Text>
                    </TouchableOpacity>
                    {isManager && (
                      <TouchableOpacity onPress={() => openEdit(editTarget)}
                        style={[styles.viewBtn, { backgroundColor: '#43C59E', flex: 1 }]}>
                        <Ionicons name="pencil" size={15} color="#FFF" style={{ marginRight: 4 }} />
                        <Text style={{ fontWeight: '700', color: '#FFF' }}>Edit</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', flex: 1, marginLeft: 12 },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#6C63FF', justifyContent: 'center', alignItems: 'center' },

  bazarBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  bazarText: { fontSize: 12, flex: 1 },

  totalCard: { marginHorizontal: 16, marginTop: 12, borderRadius: 14, padding: 14, alignItems: 'center' },
  totalLabel: { fontSize: 12 },
  totalAmt: { fontSize: 24, fontWeight: '800', marginTop: 2 },

  // Swipe row
  swipeWrap: { borderRadius: 16, overflow: 'hidden', position: 'relative', marginBottom: 2 },
  delBg: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    backgroundColor: '#FF658415', alignItems: 'center', justifyContent: 'center',
    paddingLeft: 20, borderRadius: 16,
  },
  actBg: { position: 'absolute', right: 0, top: 0, bottom: 0, flexDirection: 'row', borderRadius: 16, overflow: 'hidden' },
  actBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  actLabel: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  expCard: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 12, borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  expIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  expName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  expMeta: { fontSize: 11 },
  expAmt: { fontSize: 14, fontWeight: '700' },

  // Form sheet
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 44 : 28, maxHeight: '92%',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 10,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '800', marginBottom: 14 },

  lbl: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  inp: { borderRadius: 12, padding: 13, fontSize: 15, marginBottom: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  chipTxt: { fontSize: 12, fontWeight: '600' },

  bazarHint: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    padding: 10, borderRadius: 10, marginBottom: 14,
  },
  bazarHintTxt: { fontSize: 12, fontWeight: '600', flex: 1 },

  saveBtn: { backgroundColor: '#6C63FF', borderRadius: 14, height: 52, justifyContent: 'center', alignItems: 'center' },
  saveBtnTxt: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  // View modal
  viewCard: {
    margin: 24, borderRadius: 24, padding: 24, alignItems: 'center', gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 12,
  },
  viewIcon: { width: 72, height: 72, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  viewTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  viewAmt: { fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  viewRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingVertical: 10, borderBottomWidth: 1 },
  viewLabel: { fontSize: 13 },
  viewValue: { fontSize: 13, fontWeight: '600', maxWidth: '55%', textAlign: 'right' },
  viewBtn: { height: 48, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
});
