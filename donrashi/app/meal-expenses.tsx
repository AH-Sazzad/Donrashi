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
import { mealBooksApi, mealExpensesApi, mealMembersApi } from '@/services/mealApi';
import { MealBook, MealBookExpense, MealBookMember } from '@/types';

const CAT_COLORS: Record<string, string> = { food: '#43C59E', utilities: '#F59E0B', other: '#6C63FF' };
const CAT_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  food: 'fast-food-outline', utilities: 'bulb-outline', other: 'cube-outline',
};

export default function MealExpensesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const mealBookId = Number(id);
  const isDark  = useColorScheme() === 'dark';
  const { user } = useAuth();

  const bg          = isDark ? '#0F0F1A' : '#F8F9FF';
  const cardBg      = isDark ? '#1E1E2E' : '#FFFFFF';
  const textPrimary = isDark ? '#F1F5F9' : '#1E293B';
  const textSec     = isDark ? '#94A3B8' : '#64748B';
  const inputBg     = isDark ? '#2A2A3E' : '#F1F5F9';
  const borderColor = isDark ? '#2A2A3E' : '#E2E8F0';

  const [book, setBook]             = useState<MealBook | null>(null);
  const [expenses, setExpenses]     = useState<MealBookExpense[]>([]);
  const [members, setMembers]       = useState<MealBookMember[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm]     = useState(false);
  const [saving, setSaving]         = useState(false);

  // Form state
  const monthYear = new Date().toISOString().slice(0, 7);
  const [category, setCategory]     = useState<'food' | 'utilities' | 'other'>('food');
  const [subCat, setSubCat]         = useState('');
  const [amount, setAmount]         = useState('');
  const [description, setDescription] = useState('');
  const [expDate, setExpDate]       = useState(new Date().toISOString().split('T')[0]);
  const [paidBy, setPaidBy]         = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [b, e, m] = await Promise.all([
        mealBooksApi.get(mealBookId),
        mealExpensesApi.list(mealBookId),
        mealMembersApi.list(mealBookId),
      ]);
      setBook(b);
      setExpenses(Array.isArray(e) ? e : []);
      setMembers(Array.isArray(m) ? m : []);
      if (!paidBy && user?.id) setPaidBy(user.id);
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [mealBookId, user?.id]);

  useEffect(() => { load(); }, [load]);

  const isManager = book?.meal_book_members?.find(m => m.user_id === user?.id)?.role === 'manager';
  const sym = book?.currency === 'BDT' ? '৳' : (book?.currency === 'USD' ? '$' : '€');

  async function handleSave() {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) { Alert.alert('Invalid', 'Enter a valid amount.'); return; }
    if (!paidBy) { Alert.alert('Missing', 'Select who paid.'); return; }
    setSaving(true);
    try {
      await mealExpensesApi.create(mealBookId, {
        paid_by: paidBy,
        category,
        sub_category: subCat.trim() || undefined,
        amount: Number(amount),
        description: description.trim() || undefined,
        expense_date: expDate,
        month_year: monthYear,
      });
      setShowForm(false);
      setAmount(''); setSubCat(''); setDescription('');
      load();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save.');
    } finally { setSaving(false); }
  }

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: bg }]} edges={['top','bottom']}>
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color={textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textPrimary }]}>Expenses</Text>
        {isManager && (
          <TouchableOpacity onPress={() => setShowForm(true)} style={styles.addBtn}>
            <Ionicons name="add" size={20} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Total */}
      <View style={[styles.totalCard, { backgroundColor: '#FF658415' }]}>
        <Text style={[styles.totalLabel, { color: textSec }]}>Total Expenses</Text>
        <Text style={[styles.totalAmount, { color: '#FF6584' }]}>-{sym}{total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
      </View>

      <FlatList
        data={expenses}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#6C63FF" colors={['#6C63FF']} />}
        ListEmptyComponent={loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
            <ActivityIndicator color="#6C63FF" />
          </View>
        ) : (
          <View style={{ alignItems: 'center', padding: 40, gap: 8 }}>
            <Ionicons name="receipt-outline" size={40} color={textSec} />
            <Text style={[{ color: textSec, fontSize: 14 }]}>No expenses yet</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={[styles.expCard, { backgroundColor: cardBg }]}>
            <View style={[styles.expIcon, { backgroundColor: CAT_COLORS[item.category] + '22' }]}>
              <Ionicons name={CAT_ICONS[item.category]} size={18} color={CAT_COLORS[item.category]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.expName, { color: textPrimary }]} numberOfLines={1}>
                {item.sub_category ?? item.category}
              </Text>
              <Text style={[styles.expMeta, { color: textSec }]}>
                {item.expense_date}  ·  Paid by {(item as any).paid_by_user?.name ?? `#${item.paid_by}`}
              </Text>
            </View>
            <Text style={[styles.expAmount, { color: '#FF6584' }]}>
              -{sym}{Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </Text>
          </View>
        )}
      />

      {/* Add expense modal */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowForm(false)} />
        <View style={[styles.sheet, { backgroundColor: cardBg }]}>
          <View style={styles.sheetHandle} />
          <Text style={[styles.sheetTitle, { color: textPrimary }]}>Add Expense</Text>

          {/* Category */}
          <Text style={[styles.formLabel, { color: textSec }]}>Category</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            {(['food', 'utilities', 'other'] as const).map(c => (
              <Pressable key={c} onPress={() => setCategory(c)}
                style={[styles.chip, { borderColor: CAT_COLORS[c] }, category === c && { backgroundColor: CAT_COLORS[c] }]}>
                <Text style={[styles.chipText, { color: category === c ? '#FFF' : CAT_COLORS[c] }]}>{c}</Text>
              </Pressable>
            ))}
          </View>

          {/* Sub category */}
          <Text style={[styles.formLabel, { color: textSec }]}>Sub Category</Text>
          <TextInput
            style={[styles.input, { backgroundColor: inputBg, color: textPrimary }]}
            value={subCat} onChangeText={setSubCat}
            placeholder="e.g. Rice, Gas, Electricity" placeholderTextColor={textSec}
          />

          {/* Amount */}
          <Text style={[styles.formLabel, { color: textSec }]}>Amount</Text>
          <TextInput
            style={[styles.input, { backgroundColor: inputBg, color: textPrimary }]}
            value={amount} onChangeText={setAmount}
            keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={textSec}
          />

          {/* Paid by */}
          <Text style={[styles.formLabel, { color: textSec }]}>Paid By</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {members.map(m => (
              <Pressable key={m.user_id} onPress={() => setPaidBy(m.user_id)}
                style={[styles.chip, { borderColor: '#6C63FF' }, paidBy === m.user_id && { backgroundColor: '#6C63FF' }]}>
                <Text style={[styles.chipText, { color: paidBy === m.user_id ? '#FFF' : '#6C63FF' }]}>
                  {m.user?.name?.split(' ')[0]}
                </Text>
              </Pressable>
            ))}
          </View>

          <TouchableOpacity onPress={handleSave} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.5 }]}>
            {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Save Expense</Text>}
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', flex: 1, marginLeft: 12 },
  addBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#6C63FF',
    justifyContent: 'center', alignItems: 'center',
  },
  totalCard: { margin: 16, borderRadius: 14, padding: 14, alignItems: 'center' },
  totalLabel: { fontSize: 12 },
  totalAmount: { fontSize: 22, fontWeight: '800', marginTop: 4 },

  expCard: {
    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  expIcon: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  expName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  expMeta: { fontSize: 11 },
  expAmount: { fontSize: 14, fontWeight: '700' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 16, elevation: 10,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 8 },
  sheetTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },

  formLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  input: {
    borderRadius: 12, padding: 12, fontSize: 15, marginBottom: 12,
  },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  chipText: { fontSize: 12, fontWeight: '600' },

  saveBtn: {
    backgroundColor: '#6C63FF', borderRadius: 14, height: 52,
    justifyContent: 'center', alignItems: 'center', marginTop: 8,
  },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
