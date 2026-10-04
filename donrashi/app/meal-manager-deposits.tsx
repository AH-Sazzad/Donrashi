import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Modal, Platform,
  Pressable, RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { mealBooksApi, mealMembersApi, mealWalletApi } from '@/services/mealApi';
import { MealBook, MealBookDeposit, MealBookMember, MealBookWallet } from '@/types';

const WALLET_TYPES = ['Cash', 'bKash', 'Nagad', 'Rocket', 'Bank', 'Other'];
const STATUS_COLOR: Record<string, string> = {
  pending: '#F59E0B', approved: '#43C59E', rejected: '#FF6584',
};

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function humanDate(s: string): string {
  if (!s) return '';
  const [y, m, d] = s.split('T')[0].split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((today.getTime() - date.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff <= 6) return `${diff} days ago`;
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MealManagerDepositsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const mealBookId = Number(id);
  const isDark = useColorScheme() === 'dark';

  const bg          = isDark ? '#0F0F1A' : '#F8F9FF';
  const cardBg      = isDark ? '#1E1E2E' : '#FFFFFF';
  const textPrimary = isDark ? '#F1F5F9' : '#1E293B';
  const textSec     = isDark ? '#94A3B8' : '#64748B';
  const inputBg     = isDark ? '#2A2A3E' : '#F1F5F9';
  const borderColor = isDark ? '#2A2A3E' : '#E2E8F0';

  const [book, setBook]           = useState<MealBook | null>(null);
  const [wallet, setWallet]       = useState<MealBookWallet | null>(null);
  const [members, setMembers]     = useState<MealBookMember[]>([]);
  const [deposits, setDeposits]   = useState<MealBookDeposit[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm]   = useState(false);
  const [saving, setSaving]       = useState(false);

  // Form state
  const [selectedMember, setSelectedMember] = useState<MealBookMember | null>(null);
  const [amount, setAmount]         = useState('');
  const [walletType, setWalletType] = useState('bKash');
  const [note, setNote]             = useState('');
  const [depDate, setDepDate]       = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const load = useCallback(async () => {
    try {
      const [b, m, d, w] = await Promise.all([
        mealBooksApi.get(mealBookId),
        mealMembersApi.list(mealBookId),
        mealWalletApi.deposits(mealBookId),
        mealWalletApi.get(mealBookId),  // load wallet separately — not included in book.get
      ]);
      setBook(b);
      setMembers(Array.isArray(m) ? m : []);
      setDeposits(Array.isArray(d) ? d : []);
      setWallet(w);
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [mealBookId]);

  useEffect(() => { load(); }, [load]);

  const sym = book?.currency === 'USD' ? '$' : book?.currency === 'EUR' ? '€' : '৳';

  function onDateChange(_: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) setDepDate(date);
  }

  async function handleApprove(deposit: MealBookDeposit) {
    try {
      await mealWalletApi.approveDeposit(mealBookId, deposit.id);
      load();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed.');
    }
  }

  async function handleReject(deposit: MealBookDeposit) {
    Alert.alert('Reject', 'Reject this deposit?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject', style: 'destructive',
        onPress: async () => {
          try {
            await mealWalletApi.rejectDeposit(mealBookId, deposit.id);
            load();
          } catch (e: unknown) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Failed.');
          }
        },
      },
    ]);
  }

  async function handleSave() {
    if (!selectedMember) { Alert.alert('Select', 'Choose a member.'); return; }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('Invalid', 'Enter a valid amount.'); return;
    }
    setSaving(true);
    try {
      const dateStr  = toISO(depDate);
      const monthYear = `${depDate.getFullYear()}-${String(depDate.getMonth() + 1).padStart(2, '0')}`;
      await mealWalletApi.managerDeposit(mealBookId, {
        member_id:      selectedMember.id,
        amount:         Number(amount),
        payment_method: walletType,
        note:           note.trim() || undefined,
        month_year:     monthYear,
      });
      setShowForm(false);
      setAmount(''); setNote(''); setSelectedMember(null); setDepDate(new Date());
      load();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to record deposit.');
    } finally { setSaving(false); }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top', 'bottom']}>

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color={textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textPrimary }]}>Deposits</Text>
        <TouchableOpacity onPress={() => setShowForm(true)} style={styles.addBtn}>
          <Ionicons name="add" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Wallet summary — loaded separately so no NaN */}
      <View style={[styles.summaryRow, { backgroundColor: '#43C59E18' }]}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: textSec }]}>Available</Text>
          <Text style={[styles.summaryValue, { color: '#43C59E' }]}>
            {sym}{wallet ? Number(wallet.available_balance).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: textSec }]}>Pending</Text>
          <Text style={[styles.summaryValue, { color: '#F59E0B' }]}>
            {sym}{wallet ? Number(wallet.pending_balance).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: textSec }]}>Expected</Text>
          <Text style={[styles.summaryValue, { color: textPrimary }]}>
            {sym}{wallet
              ? (Number(wallet.available_balance) + Number(wallet.pending_balance))
                  .toLocaleString('en-US', { minimumFractionDigits: 2 })
              : '—'}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#43C59E" /></View>
      ) : (
        <FlatList
          data={deposits}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor="#43C59E" colors={['#43C59E']} />
          }
          ListEmptyComponent={
            <View style={[styles.emptyCard, { backgroundColor: cardBg }]}>
              <Ionicons name="wallet-outline" size={40} color={textSec} />
              <Text style={[{ color: textPrimary, fontSize: 16, fontWeight: '700' }]}>No deposits yet</Text>
              <TouchableOpacity onPress={() => setShowForm(true)}
                style={[styles.addBtn2, { backgroundColor: '#43C59E' }]}>
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Record Deposit</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.depCard, { backgroundColor: cardBg }]}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <Text style={[styles.depName, { color: textPrimary }]}>
                    {item.member?.name ?? `Member #${item.member_id}`}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[item.status] + '22' }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLOR[item.status] }]}>{item.status}</Text>
                  </View>
                </View>
                <Text style={[styles.depMeta, { color: textSec }]}>
                  {item.note ?? 'No note'}
                  {'  ·  '}
                  {item.created_at ? humanDate(item.created_at) : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Text style={[styles.depAmount, { color: '#43C59E' }]}>
                  +{sym}{Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
                {item.status === 'pending' && (
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity onPress={() => handleApprove(item)}
                      style={[styles.actionBtn, { backgroundColor: '#43C59E' }]}>
                      <Ionicons name="checkmark" size={14} color="#FFF" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleReject(item)}
                      style={[styles.actionBtn, { backgroundColor: '#FF6584' }]}>
                      <Ionicons name="close" size={14} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          )}
        />
      )}

      {/* Add deposit modal */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowForm(false)} />
        <View style={[styles.sheet, { backgroundColor: cardBg }]}>
          <View style={styles.sheetHandle} />
          <Text style={[styles.sheetTitle, { color: textPrimary }]}>Record Deposit</Text>
          <Text style={[styles.sheetSub, { color: textSec }]}>
            Record a payment received from a member into the shared wallet.
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* Member */}
            <Text style={[styles.formLabel, { color: textSec }]}>Member</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, marginBottom: 14 }}>
              {members.map(m => (
                <Pressable key={m.id} onPress={() => setSelectedMember(m)}
                  style={[styles.chip, { borderColor: '#43C59E' },
                    selectedMember?.id === m.id && { backgroundColor: '#43C59E' }]}>
                  <Text style={[styles.chipText, {
                    color: selectedMember?.id === m.id ? '#FFF' : '#43C59E',
                  }]}>
                    {m.display_name ?? m.user?.name ?? `#${m.id}`}
                    {m.is_ghost ? ' 👤' : ''}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Payment method */}
            <Text style={[styles.formLabel, { color: textSec }]}>Payment Method</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, marginBottom: 14 }}>
              {WALLET_TYPES.map(w => (
                <Pressable key={w} onPress={() => setWalletType(w)}
                  style={[styles.chip, { borderColor: '#6C63FF' },
                    walletType === w && { backgroundColor: '#6C63FF' }]}>
                  <Text style={[styles.chipText, { color: walletType === w ? '#FFF' : '#6C63FF' }]}>{w}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Amount */}
            <Text style={[styles.formLabel, { color: textSec }]}>Amount ({sym})</Text>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, color: textPrimary }]}
              value={amount} onChangeText={setAmount}
              keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={textSec}
            />

            {/* Date */}
            <Text style={[styles.formLabel, { color: textSec }]}>Date of Payment</Text>
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              style={[styles.input, styles.dateRow, { backgroundColor: inputBg }]}>
              <Text style={[{ fontSize: 15, color: textPrimary }]}>{humanDate(toISO(depDate))}</Text>
              <Ionicons name="calendar-outline" size={18} color="#6C63FF" />
            </TouchableOpacity>

            {showDatePicker && Platform.OS === 'android' && (
              <DateTimePicker value={depDate} mode="date" display="default"
                onChange={onDateChange} maximumDate={new Date()} />
            )}
            {showDatePicker && Platform.OS === 'ios' && (
              <View style={{ marginBottom: 12 }}>
                <DateTimePicker value={depDate} mode="date" display="spinner"
                  onChange={onDateChange} maximumDate={new Date()} style={{ height: 140 }} />
                <TouchableOpacity onPress={() => setShowDatePicker(false)} style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: '#6C63FF', fontWeight: '700', fontSize: 15 }}>Done</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Note */}
            <Text style={[styles.formLabel, { color: textSec }]}>Note (optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, color: textPrimary }]}
              value={note} onChangeText={setNote}
              placeholder="e.g. October contribution" placeholderTextColor={textSec}
            />

            <TouchableOpacity onPress={handleSave} disabled={saving}
              style={[styles.saveBtn, { backgroundColor: '#43C59E' }, saving && { opacity: 0.5 }]}>
              {saving
                ? <ActivityIndicator color="#FFF" />
                : <Text style={styles.saveBtnText}>Record Deposit</Text>}
            </TouchableOpacity>

            <View style={{ height: 20 }} />
          </ScrollView>
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
  addBtn:  { width: 36, height: 36, borderRadius: 18, backgroundColor: '#43C59E', justifyContent: 'center', alignItems: 'center' },
  addBtn2: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, marginTop: 8 },

  summaryRow:   { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 20 },
  summaryItem:  { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 11, marginBottom: 2 },
  summaryValue: { fontSize: 15, fontWeight: '800' },

  list: { padding: 16, gap: 10, paddingBottom: 40 },

  depCard: {
    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  depName:     { fontSize: 14, fontWeight: '600' },
  depMeta:     { fontSize: 11 },
  depAmount:   { fontSize: 14, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusText:  { fontSize: 10, fontWeight: '700' },
  actionBtn:   { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },

  emptyCard: { borderRadius: 20, padding: 40, alignItems: 'center', gap: 10, margin: 16 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 44 : 28,
    maxHeight: '92%',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 16, elevation: 10,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 10 },
  sheetTitle:  { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  sheetSub:    { fontSize: 12, lineHeight: 18, marginBottom: 14 },

  formLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input:     { borderRadius: 12, padding: 13, fontSize: 15, marginBottom: 14 },
  dateRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  chipText:  { fontSize: 12, fontWeight: '600' },

  saveBtn:     { borderRadius: 14, height: 52, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
