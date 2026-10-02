import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CURRENCY_SYMBOLS, SupportedCurrency } from '@/context/CurrencyContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { categoriesApi, transactionsApi, walletsApi } from '@/services/api';
import { Category, Transaction, Wallet } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseLocalDate(dateStr: string): Date {
  // Handles "2026-10-01" or ISO strings — always treat as local date
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDisplayDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

function humanDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = parseLocalDate(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (d.getTime() === today.getTime()) return 'Today';
  if (d.getTime() === yesterday.getTime()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Read-only field row ──────────────────────────────────────────────────────

function DetailRow({ icon, label, value, valueColor, isDark }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string; value: string;
  valueColor?: string; isDark: boolean;
}) {
  const textPrimary   = isDark ? '#F1F5F9' : '#1E293B';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const borderColor   = isDark ? '#2A2A3E' : '#F1F5F9';
  return (
    <View style={[styles.detailRow, { borderBottomColor: borderColor }]}>
      <View style={styles.detailLeft}>
        <Ionicons name={icon} size={17} color="#6C63FF" />
        <Text style={[styles.detailLabel, { color: textSecondary }]}>{label}</Text>
      </View>
      <Text style={[styles.detailValue, { color: valueColor ?? textPrimary }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TransactionDetailScreen() {
  const params    = useLocalSearchParams<{ id: string; mode?: string }>();
  const txId      = Number(params.id);
  const initMode  = params.mode === 'edit' ? 'edit' : 'view';

  const colorScheme   = useColorScheme();
  const isDark        = colorScheme === 'dark';

  const bg            = isDark ? '#0F0F1A' : '#F8F9FF';
  const cardBg        = isDark ? '#1E1E2E' : '#FFFFFF';
  const textPrimary   = isDark ? '#F1F5F9' : '#1E293B';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const inputBg       = isDark ? '#2A2A3E' : '#F1F5F9';
  const borderColor   = isDark ? '#2A2A3E' : '#E2E8F0';

  // ── Data ────────────────────────────────────────────────────────────────────
  const [mode, setMode]                 = useState<'view' | 'edit'>(initMode);
  const [tx, setTx]                     = useState<Transaction | null>(null);
  const [wallets, setWallets]           = useState<Wallet[]>([]);
  const [categories, setCategories]     = useState<Category[]>([]);
  const [loading, setLoading]           = useState(true);
  const [submitting, setSubmitting]     = useState(false);

  // ── Edit form state ──────────────────────────────────────────────────────────
  const [amount, setAmount]             = useState('');
  const [title, setTitle]               = useState('');
  const [note, setNote]                 = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedWallet, setSelectedWallet]     = useState<Wallet | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [txType, setTxType]             = useState<'income' | 'expense'>('expense');

  // ── Load transaction + supporting data ──────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [txRes, wRes, cRes] = await Promise.all([
          transactionsApi.get(txId),
          walletsApi.list(),
          categoriesApi.list(),
        ]);
        const loaded = txRes.data;
        const ws     = wRes.data ?? [];
        const cs     = cRes.data ?? [];

        setTx(loaded);
        setWallets(ws);
        setCategories(cs);

        // Pre-fill edit form
        setAmount(String(loaded.amount));
        setTitle(loaded.title);
        setNote(loaded.note ?? '');
        setTxType(loaded.type);
        setSelectedDate(parseLocalDate(loaded.transaction_date));
        setSelectedWallet(ws.find(w => w.id === loaded.wallet_id) ?? null);
        setSelectedCategory(cs.find(c => c.id === loaded.category_id) ?? null);
      } catch (e: unknown) {
        Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load transaction.');
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [txId]);

  function onDateChange(_: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) setSelectedDate(date);
  }

  // ── Save edits ───────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid amount greater than 0.'); return;
    }
    if (!title.trim()) { Alert.alert('Missing title', 'Please enter a title.'); return; }
    if (!selectedWallet)   { Alert.alert('No wallet',   'Please select a wallet.');   return; }
    if (!selectedCategory) { Alert.alert('No category', 'Please select a category.'); return; }

    setSubmitting(true);
    try {
      const res = await transactionsApi.update(txId, {
        wallet_id:        selectedWallet.id,
        category_id:      selectedCategory.id,
        type:             txType,
        amount:           Number(amount),
        title:            title.trim(),
        note:             note.trim() || undefined,
        transaction_date: toISO(selectedDate),
      });
      setTx(res.data);
      setMode('view');
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update transaction.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const filteredCategories = categories.filter(c => c.type === txType);
  const accentColor        = txType === 'expense' ? '#FF6584' : '#43C59E';
  const walletCurrencySym  = selectedWallet
    ? (CURRENCY_SYMBOLS[(selectedWallet.currency ?? 'BDT') as SupportedCurrency] ?? '৳')
    : '৳';

  if (loading || !tx) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </SafeAreaView>
    );
  }

  const isIncome   = tx.type === 'income';
  const txColor    = isIncome ? '#43C59E' : '#FF6584';
  const catColor   = tx.category?.color ?? '#6C63FF';
  const catIcon    = (tx.category?.icon ?? 'pricetag-outline') as React.ComponentProps<typeof Ionicons>['name'];
  const txSymbol   = CURRENCY_SYMBOLS[(tx.wallet?.currency ?? 'BDT') as SupportedCurrency] ?? '৳';

  // ============================================================================
  // VIEW MODE
  // ============================================================================
  if (mode === 'view') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: textPrimary }]}>Transaction</Text>
          <TouchableOpacity onPress={() => setMode('edit')} style={styles.editBtn}>
            <Ionicons name="pencil" size={16} color="#FFF" />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* Hero amount card */}
          <View style={[styles.heroCard, { backgroundColor: catColor + '18', borderColor: catColor + '30' }]}>
            <View style={[styles.heroIcon, { backgroundColor: catColor + '22' }]}>
              <Ionicons name={catIcon} size={32} color={catColor} />
            </View>
            <Text style={[styles.heroTitle, { color: textPrimary }]}>{tx.title}</Text>
            <Text style={[styles.heroAmount, { color: txColor }]}>
              {isIncome ? '+' : '-'}{txSymbol}{Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </Text>
            <View style={[styles.heroBadge, {
              backgroundColor: isIncome ? '#43C59E22' : '#FF658422',
            }]}>
              <Ionicons
                name={isIncome ? 'arrow-down-circle' : 'arrow-up-circle'}
                size={13} color={txColor} />
              <Text style={[styles.heroBadgeText, { color: txColor }]}>
                {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
              </Text>
            </View>
          </View>

          {/* Detail rows */}
          <View style={[styles.detailCard, { backgroundColor: cardBg }]}>
            <DetailRow
              icon="calendar-outline" label="Date"
              value={humanDate(tx.transaction_date)}
              isDark={isDark} />
            <DetailRow
              icon="wallet-outline" label="Wallet"
              value={tx.wallet?.name ?? `Wallet #${tx.wallet_id}`}
              isDark={isDark} />
            <DetailRow
              icon="pricetag-outline" label="Category"
              value={tx.category?.name ?? `Category #${tx.category_id}`}
              isDark={isDark} />
            {tx.note ? (
              <DetailRow
                icon="document-text-outline" label="Note"
                value={tx.note} isDark={isDark} />
            ) : null}
            <DetailRow
              icon="time-outline" label="Recorded"
              value={tx.created_at
                ? new Date(tx.created_at).toLocaleString('en-US', {
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })
                : '—'}
              isDark={isDark} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ============================================================================
  // EDIT MODE
  // ============================================================================
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          <TouchableOpacity onPress={() => setMode('view')} style={styles.closeBtn}>
            <Ionicons name="arrow-back" size={24} color={textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: textPrimary }]}>Edit Transaction</Text>
          <TouchableOpacity
            onPress={handleSave} disabled={submitting}
            style={[styles.saveBtn, submitting && { opacity: 0.5 }]}>
            {submitting
              ? <ActivityIndicator size="small" color="#FFF" />
              : <Text style={styles.saveBtnText}>Save</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled">

          {/* Type toggle */}
          <View style={[styles.typeToggle, { backgroundColor: inputBg }]}>
            {(['expense', 'income'] as const).map(t => (
              <Pressable
                key={t}
                onPress={() => { setTxType(t); setSelectedCategory(null); }}
                style={[styles.typeBtn, txType === t && {
                  backgroundColor: t === 'expense' ? '#FF6584' : '#43C59E',
                }]}>
                <Ionicons
                  name={t === 'expense' ? 'arrow-up-circle' : 'arrow-down-circle'}
                  size={16} color={txType === t ? '#FFF' : textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.typeBtnText, { color: txType === t ? '#FFF' : textSecondary }]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Amount */}
          <View style={[styles.amountCard, { backgroundColor: accentColor }]}>
            <Text style={styles.amountSymbol}>{walletCurrencySym}</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor="rgba(255,255,255,0.5)"
              keyboardType="decimal-pad"
              selectionColor="#FFF"
            />
          </View>

          {/* Form */}
          <View style={[styles.formCard, { backgroundColor: cardBg }]}>

            {/* Title */}
            <View style={[styles.field, { borderBottomColor: borderColor }]}>
              <Ionicons name="pencil-outline" size={18} color="#6C63FF" />
              <TextInput
                style={[styles.fieldInput, { color: textPrimary }]}
                value={title}
                onChangeText={setTitle}
                placeholder="Title"
                placeholderTextColor={textSecondary}
              />
            </View>

            {/* Date */}
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              style={[styles.field, { borderBottomColor: borderColor }]}>
              <Ionicons name="calendar-outline" size={18} color="#6C63FF" />
              <Text style={[styles.fieldInput, { color: textPrimary }]}>
                {formatDisplayDate(selectedDate)}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={textSecondary} />
            </TouchableOpacity>

            {showDatePicker && Platform.OS === 'android' && (
              <DateTimePicker
                value={selectedDate} mode="date" display="default"
                onChange={onDateChange} maximumDate={new Date()} />
            )}
            {showDatePicker && Platform.OS === 'ios' && (
              <View style={[styles.iosPickerWrap, { borderBottomColor: borderColor }]}>
                <DateTimePicker
                  value={selectedDate} mode="date" display="spinner"
                  onChange={onDateChange} maximumDate={new Date()} style={{ height: 150 }} />
                <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.iosPickerDone}>
                  <Text style={styles.iosPickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Wallet chips */}
            <View style={[styles.field, { borderBottomColor: borderColor, minHeight: 64, flexWrap: 'wrap' }]}>
              <Ionicons name="wallet-outline" size={18} color="#6C63FF" />
              <Text style={[styles.fieldLabel, { color: textSecondary }]}>Wallet</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {wallets.map(w => (
                  <Pressable
                    key={w.id}
                    onPress={() => setSelectedWallet(w)}
                    style={[
                      styles.chip,
                      { borderColor: w.color || '#6C63FF' },
                      selectedWallet?.id === w.id && { backgroundColor: w.color || '#6C63FF' },
                    ]}>
                    <Text style={[styles.chipText, {
                      color: selectedWallet?.id === w.id ? '#FFF' : (w.color || '#6C63FF'),
                    }]}>
                      {w.name} · {w.currency ?? 'BDT'}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Category chips */}
            <View style={[styles.field, { borderBottomColor: borderColor, minHeight: 64, flexWrap: 'wrap' }]}>
              <Ionicons name="pricetag-outline" size={18} color="#6C63FF" />
              <Text style={[styles.fieldLabel, { color: textSecondary }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {filteredCategories.length === 0
                  ? <Text style={[styles.noData, { color: textSecondary }]}>No {txType} categories</Text>
                  : filteredCategories.map(c => (
                    <Pressable
                      key={c.id}
                      onPress={() => setSelectedCategory(c)}
                      style={[
                        styles.chip,
                        { borderColor: c.color || '#6C63FF' },
                        selectedCategory?.id === c.id && { backgroundColor: c.color || '#6C63FF' },
                      ]}>
                      <Text style={[styles.chipText, {
                        color: selectedCategory?.id === c.id ? '#FFF' : (c.color || '#6C63FF'),
                      }]}>
                        {c.name}
                      </Text>
                    </Pressable>
                  ))}
              </ScrollView>
            </View>

            {/* Note */}
            <View style={[styles.field, { borderBottomColor: 'transparent' }]}>
              <Ionicons name="document-text-outline" size={18} color="#6C63FF" />
              <TextInput
                style={[styles.fieldInput, { color: textPrimary }]}
                value={note}
                onChangeText={setNote}
                placeholder="Note (optional)"
                placeholderTextColor={textSecondary}
                multiline
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  closeBtn:    { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#6C63FF', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  editBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  saveBtn: {
    backgroundColor: '#6C63FF', paddingHorizontal: 18, paddingVertical: 8,
    borderRadius: 20, minWidth: 64, alignItems: 'center',
  },
  saveBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },

  scroll: { padding: 20, gap: 16 },

  // View mode
  heroCard: {
    borderRadius: 24, padding: 28, alignItems: 'center', gap: 10, borderWidth: 1,
  },
  heroIcon: {
    width: 72, height: 72, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  heroTitle:  { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  heroAmount: { fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
  },
  heroBadgeText: { fontSize: 13, fontWeight: '700' },

  detailCard: {
    borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
  },
  detailLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailLabel: { fontSize: 13, fontWeight: '600' },
  detailValue: { fontSize: 14, fontWeight: '500', maxWidth: '55%', textAlign: 'right' },

  // Edit mode
  typeToggle: {
    flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4,
  },
  typeBtn: {
    flex: 1, flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', paddingVertical: 12, borderRadius: 10,
  },
  typeBtnText: { fontSize: 14, fontWeight: '700' },

  amountCard: {
    borderRadius: 20, padding: 24, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  amountSymbol: { color: '#FFF', fontSize: 28, fontWeight: '800' },
  amountInput:  {
    color: '#FFF', fontSize: 40, fontWeight: '800',
    minWidth: 120, textAlign: 'center', letterSpacing: -1,
  },

  formCard: {
    borderRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  field: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 4,
    borderBottomWidth: 1, minHeight: 54, gap: 12,
  },
  fieldLabel: { fontSize: 13, fontWeight: '600' },
  fieldInput: { flex: 1, fontSize: 15, paddingVertical: 12 },
  chipRow:    { gap: 8, paddingVertical: 8, paddingHorizontal: 2 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  noData:   { fontSize: 13 },

  iosPickerWrap:     { paddingBottom: 8 },
  iosPickerDone:     { alignItems: 'flex-end', paddingRight: 4, paddingBottom: 4 },
  iosPickerDoneText: { color: '#6C63FF', fontWeight: '700', fontSize: 15 },
});
