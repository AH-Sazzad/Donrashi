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
import { mealBooksApi, mealWalletApi } from '@/services/mealApi';
import { walletsApi } from '@/services/api';
import { MealBook, MealBookDeposit, Wallet } from '@/types';

const STATUS_COLOR: Record<string, string> = {
  pending: '#F59E0B', approved: '#43C59E', rejected: '#FF6584',
};

export default function MealDepositsScreen() {
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
  const [deposits, setDeposits]     = useState<MealBookDeposit[]>([]);
  const [wallets, setWallets]       = useState<Wallet[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm]     = useState(false);
  const [saving, setSaving]         = useState(false);
  const [amount, setAmount]         = useState('');
  const [note, setNote]             = useState('');
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);

  const load = useCallback(async () => {
    try {
      const [b, d, w] = await Promise.all([
        mealBooksApi.get(mealBookId),
        mealWalletApi.deposits(mealBookId),
        walletsApi.list(),
      ]);
      setBook(b);
      setDeposits(Array.isArray(d) ? d : []);
      const ws = w.data ?? [];
      setWallets(ws);
      if (!selectedWallet) setSelectedWallet(ws.find((x: Wallet) => x.is_default) ?? ws[0] ?? null);
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [mealBookId]);

  useEffect(() => { load(); }, [load]);

  const isManager = book?.meal_book_members?.find(m => m.user_id === user?.id)?.role === 'manager';
  const sym = book?.currency === 'BDT' ? '৳' : (book?.currency === 'USD' ? '$' : '€');

  async function handleDeposit() {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) { Alert.alert('Invalid', 'Enter a valid amount.'); return; }
    if (!selectedWallet) { Alert.alert('Missing', 'Select a wallet.'); return; }
    setSaving(true);
    try {
      await mealWalletApi.createDeposit(mealBookId, {
        from_personal_wallet_id: selectedWallet.id,
        amount: Number(amount),
        note: note.trim() || undefined,
      });
      setShowForm(false); setAmount(''); setNote('');
      load();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to submit deposit.');
    } finally { setSaving(false); }
  }

  async function handleApprove(deposit: MealBookDeposit) {
    try {
      await mealWalletApi.approveDeposit(mealBookId, deposit.id);
      load();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to approve.');
    }
  }

  async function handleReject(deposit: MealBookDeposit) {
    Alert.prompt('Reject Deposit', 'Reason (optional):', async (reason) => {
      try {
        await mealWalletApi.rejectDeposit(mealBookId, deposit.id, reason || undefined);
        load();
      } catch (e: unknown) {
        Alert.alert('Error', e instanceof Error ? e.message : 'Failed to reject.');
      }
    });
  }

  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: bg }]} edges={['top','bottom']}>
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color={textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textPrimary }]}>Deposits</Text>
        <TouchableOpacity onPress={() => setShowForm(true)} style={styles.addBtn}>
          <Ionicons name="add" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={deposits}
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
            <Ionicons name="wallet-outline" size={40} color={textSec} />
            <Text style={[{ color: textSec, fontSize: 14 }]}>No deposits yet</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={[styles.depCard, { backgroundColor: cardBg }]}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.depName, { color: textPrimary }]}>{item.member?.name ?? `User #${item.member_id}`}</Text>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[item.status] + '22' }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLOR[item.status] }]}>{item.status}</Text>
                </View>
              </View>
              <Text style={[styles.depMeta, { color: textSec }]}>
                {item.from_wallet?.name}  ·  {item.created_at?.split('T')[0]}
                {item.note ? `  ·  ${item.note}` : ''}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={[styles.depAmount, { color: '#43C59E' }]}>+{sym}{Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
              {isManager && item.status === 'pending' && (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity onPress={() => handleApprove(item)} style={[styles.actionBtn, { backgroundColor: '#43C59E' }]}>
                    <Ionicons name="checkmark" size={13} color="#FFF" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleReject(item)} style={[styles.actionBtn, { backgroundColor: '#FF6584' }]}>
                    <Ionicons name="close" size={13} color="#FFF" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}
      />

      {/* New deposit modal */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowForm(false)} />
        <View style={[styles.sheet, { backgroundColor: cardBg }]}>
          <View style={styles.sheetHandle} />
          <Text style={[styles.sheetTitle, { color: textPrimary }]}>Submit Deposit</Text>

          <Text style={[styles.formLabel, { color: textSec }]}>From Wallet</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {wallets.map(w => (
              <Pressable key={w.id} onPress={() => setSelectedWallet(w)}
                style={[styles.chip, { borderColor: w.color || '#6C63FF' },
                  selectedWallet?.id === w.id && { backgroundColor: w.color || '#6C63FF' }]}>
                <Text style={[styles.chipText, { color: selectedWallet?.id === w.id ? '#FFF' : (w.color || '#6C63FF') }]}>
                  {w.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.formLabel, { color: textSec }]}>Amount</Text>
          <TextInput
            style={[styles.input, { backgroundColor: inputBg, color: textPrimary }]}
            value={amount} onChangeText={setAmount}
            keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={textSec}
          />

          <Text style={[styles.formLabel, { color: textSec }]}>Note (optional)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: inputBg, color: textPrimary }]}
            value={note} onChangeText={setNote}
            placeholder="e.g. October contribution" placeholderTextColor={textSec}
          />

          <TouchableOpacity onPress={handleDeposit} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.5 }]}>
            {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Submit Deposit</Text>}
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
  depCard: {
    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  depName:   { fontSize: 14, fontWeight: '600' },
  depMeta:   { fontSize: 11, marginTop: 2 },
  depAmount: { fontSize: 14, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusText:  { fontSize: 10, fontWeight: '700' },
  actionBtn: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40, gap: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 16, elevation: 10,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 8 },
  sheetTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  formLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  input: { borderRadius: 12, padding: 12, fontSize: 15, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  chipText: { fontSize: 12, fontWeight: '600' },
  saveBtn: {
    backgroundColor: '#6C63FF', borderRadius: 14, height: 52,
    justifyContent: 'center', alignItems: 'center', marginTop: 8,
  },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
