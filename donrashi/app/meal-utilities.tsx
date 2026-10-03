/**
 * Utilities screen — shows utility expenses (rent, gas, electricity, WiFi, etc.)
 * for the selected month. Manager can add/edit. Members see read-only.
 *
 * Shows estimate vs actual + per-member share.
 * Server calculates utility share at settlement — we only display here.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Modal, Platform, Pressable,
  RefreshControl, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { mealBooksApi, mealExpensesApi, mealMembersApi } from '@/services/mealApi';
import { MealBook, MealBookExpense, MealBookMember } from '@/types';

const UTILITY_SUBS = ['Rent', 'Gas', 'Electricity', 'WiFi', 'Water', 'Cleaning', 'Other'];

function toSymbol(currency?: string) {
  if (currency === 'USD') return '$';
  if (currency === 'EUR') return '€';
  return '৳';
}

export default function MealUtilitiesScreen() {
  const { id }      = useLocalSearchParams<{ id: string }>();
  const mealBookId  = Number(id);
  const isDark      = useColorScheme() === 'dark';
  const { user }    = useAuth();

  const bg          = isDark ? '#0F0F1A' : '#F8F9FF';
  const cardBg      = isDark ? '#1E1E2E' : '#FFFFFF';
  const textPrimary = isDark ? '#F1F5F9' : '#1E293B';
  const textSec     = isDark ? '#94A3B8' : '#64748B';
  const inputBg     = isDark ? '#2A2A3E' : '#F1F5F9';
  const borderColor = isDark ? '#2A2A3E' : '#E2E8F0';

  const monthYear = new Date().toISOString().slice(0, 7);

  const [book, setBook]             = useState<MealBook | null>(null);
  const [expenses, setExpenses]     = useState<MealBookExpense[]>([]);
  const [members, setMembers]       = useState<MealBookMember[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm]     = useState(false);
  const [saving, setSaving]         = useState(false);

  // Form
  const [subCat, setSubCat]         = useState('Rent');
  const [amount, setAmount]         = useState('');
  const [description, setDescription] = useState('');
  const [paidBy, setPaidBy]         = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [b, e, m] = await Promise.all([
        mealBooksApi.get(mealBookId),
        mealExpensesApi.list(mealBookId, { month_year: monthYear, category: 'utilities' }),
        mealMembersApi.list(mealBookId),
      ]);
      setBook(b);
      setExpenses(Array.isArray(e) ? e : []);
      const ms = Array.isArray(m) ? m : [];
      setMembers(ms);
      if (!paidBy && user?.id) setPaidBy(user.id);
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [mealBookId, monthYear, user?.id]);

  useEffect(() => { load(); }, [load]);

  const isManager = book?.meal_book_members?.find(m => m.user_id === user?.id)?.role === 'manager';
  const sym = toSymbol(book?.currency);
  const totalUtilities = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const memberCount    = members.length || 1;
  const sharePerMember = totalUtilities / memberCount;

  async function handleSave() {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('Invalid', 'Enter a valid amount.'); return;
    }
    if (!paidBy) { Alert.alert('Missing', 'Select who paid.'); return; }
    setSaving(true);
    try {
      await mealExpensesApi.create(mealBookId, {
        paid_by: paidBy,
        category: 'utilities',
        sub_category: subCat,
        amount: Number(amount),
        description: description.trim() || undefined,
        expense_date: new Date().toISOString().split('T')[0],
        month_year: monthYear,
      });
      setShowForm(false);
      setAmount(''); setDescription('');
      load();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save.');
    } finally { setSaving(false); }
  }

  async function handleDelete(expense: MealBookExpense) {
    Alert.alert('Delete', `Remove ${expense.sub_category ?? 'this utility'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await mealExpensesApi.delete(mealBookId, expense.id);
            setExpenses(prev => prev.filter(e => e.id !== expense.id));
          } catch { Alert.alert('Error', 'Failed to delete.'); }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color={textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textPrimary }]}>Utilities</Text>
        {isManager && (
          <TouchableOpacity onPress={() => setShowForm(true)} style={styles.addBtn}>
            <Ionicons name="add" size={20} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={e => String(e.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor="#6C63FF" colors={['#6C63FF']} />
          }
          ListHeaderComponent={
            <View style={[styles.summaryCard, { backgroundColor: '#F59E0B18' }]}>
              <Text style={[styles.summaryLabel, { color: textSec }]}>Total Utilities — {monthYear}</Text>
              <Text style={[styles.summaryAmount, { color: '#F59E0B' }]}>
                {sym}{totalUtilities.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
              <Text style={[styles.summaryShare, { color: textSec }]}>
                ≈ {sym}{sharePerMember.toLocaleString('en-US', { minimumFractionDigits: 2 })} per member ({memberCount} members)
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={[styles.emptyCard, { backgroundColor: cardBg }]}>
              <Ionicons name="bulb-outline" size={40} color={textSec} />
              <Text style={[{ color: textPrimary, fontSize: 16, fontWeight: '700' }]}>No utilities added</Text>
              {isManager && (
                <TouchableOpacity onPress={() => setShowForm(true)} style={styles.addBtn2}>
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>Add Utility</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.expCard, { backgroundColor: cardBg }]}>
              <View style={[styles.expIcon, { backgroundColor: '#F59E0B22' }]}>
                <Ionicons name="bulb-outline" size={18} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.expName, { color: textPrimary }]}>{item.sub_category ?? 'Utility'}</Text>
                <Text style={[styles.expMeta, { color: textSec }]}>
                  {item.expense_date}
                  {(item as any).paid_by_user?.name ? `  ·  ${(item as any).paid_by_user.name}` : ''}
                </Text>
              </View>
              <Text style={[styles.expAmount, { color: '#F59E0B' }]}>
                {sym}{Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
              {isManager && (
                <TouchableOpacity onPress={() => handleDelete(item)} style={{ padding: 4 }}>
                  <Ionicons name="trash-outline" size={16} color="#FF6584" />
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}

      {/* Add utility modal */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowForm(false)} />
        <View style={[styles.sheet, { backgroundColor: cardBg }]}>
          <View style={styles.sheetHandle} />
          <Text style={[styles.sheetTitle, { color: textPrimary }]}>Add Utility</Text>

          {/* Sub-category chips */}
          <Text style={[styles.formLabel, { color: textSec }]}>Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
            {UTILITY_SUBS.map(s => (
              <Pressable key={s} onPress={() => setSubCat(s)}
                style={[styles.chip, { borderColor: '#F59E0B' }, subCat === s && { backgroundColor: '#F59E0B' }]}>
                <Text style={[styles.chipText, { color: subCat === s ? '#FFF' : '#F59E0B' }]}>{s}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={[styles.formLabel, { color: textSec }]}>Amount</Text>
          <TextInput
            style={[styles.input, { backgroundColor: inputBg, color: textPrimary }]}
            value={amount} onChangeText={setAmount}
            keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={textSec}
          />

          <Text style={[styles.formLabel, { color: textSec }]}>Paid By</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
            {members.map(m => (
              <Pressable key={m.user_id} onPress={() => setPaidBy(m.user_id)}
                style={[styles.chip, { borderColor: '#6C63FF' }, paidBy === m.user_id && { backgroundColor: '#6C63FF' }]}>
                <Text style={[styles.chipText, { color: paidBy === m.user_id ? '#FFF' : '#6C63FF' }]}>
                  {m.user?.name?.split(' ')[0] ?? `#${m.user_id}`}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={[styles.formLabel, { color: textSec }]}>Note (optional)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: inputBg, color: textPrimary }]}
            value={description} onChangeText={setDescription}
            placeholder="e.g. April rent" placeholderTextColor={textSec}
          />

          <TouchableOpacity onPress={handleSave} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.5 }]}>
            {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Save Utility</Text>}
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
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#F59E0B',
    justifyContent: 'center', alignItems: 'center',
  },
  addBtn2: {
    backgroundColor: '#F59E0B', paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 12, marginTop: 8,
  },

  list: { padding: 16, gap: 10, paddingBottom: 40 },

  summaryCard: { borderRadius: 16, padding: 16, marginBottom: 4, alignItems: 'center' },
  summaryLabel:  { fontSize: 12 },
  summaryAmount: { fontSize: 28, fontWeight: '800', marginTop: 2 },
  summaryShare:  { fontSize: 12, marginTop: 4 },

  emptyCard: { borderRadius: 20, padding: 40, alignItems: 'center', gap: 10 },

  expCard: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderRadius: 16, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  expIcon:   { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  expName:   { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  expMeta:   { fontSize: 11 },
  expAmount: { fontSize: 14, fontWeight: '700' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 44 : 28, gap: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 16, elevation: 10,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 8 },
  sheetTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  formLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  input: { borderRadius: 12, padding: 12, fontSize: 15, marginBottom: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  chipText: { fontSize: 12, fontWeight: '600' },
  saveBtn: {
    backgroundColor: '#F59E0B', borderRadius: 14, height: 52,
    justifyContent: 'center', alignItems: 'center', marginTop: 8,
  },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
