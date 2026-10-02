import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
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
import { Category, Wallet } from '@/types';

type TxType = 'expense' | 'income';

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDisplayDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AddTransactionScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const bg = isDark ? '#0F0F1A' : '#F8F9FF';
  const cardBg = isDark ? '#1E1E2E' : '#FFFFFF';
  const textPrimary = isDark ? '#F1F5F9' : '#1E293B';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const inputBg = isDark ? '#2A2A3E' : '#F1F5F9';
  const borderColor = isDark ? '#2A2A3E' : '#E2E8F0';

  const [type, setType] = useState<TxType>('expense');
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [wRes, cRes] = await Promise.all([walletsApi.list(), categoriesApi.list()]);
        const ws = wRes.data ?? [];
        const cs = cRes.data ?? [];
        setWallets(ws);
        setCategories(cs);
        setSelectedWallet(ws.find(w => w.is_default) ?? ws[0] ?? null);
      } catch (e: unknown) {
        Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load data.');
      } finally {
        setLoadingData(false);
      }
    })();
  }, []);

  useEffect(() => { setSelectedCategory(null); }, [type]);

  const filteredCategories = categories.filter(c => c.type === type);
  const accentColor = type === 'expense' ? '#FF6584' : '#43C59E';
  const walletCurrencySymbol = selectedWallet
    ? (CURRENCY_SYMBOLS[(selectedWallet.currency ?? 'BDT') as SupportedCurrency] ?? '৳')
    : '৳';

  function onDateChange(_: DateTimePickerEvent, date?: Date) {
    // On Android the picker closes itself; on iOS keep it open
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) setSelectedDate(date);
  }

  async function handleSubmit() {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount greater than 0.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Missing title', 'Please enter a title.');
      return;
    }
    if (!selectedWallet) {
      Alert.alert('No wallet', 'Please select a wallet.');
      return;
    }
    if (!selectedCategory) {
      Alert.alert('No category', 'Please select a category.');
      return;
    }

    setSubmitting(true);
    try {
      await transactionsApi.create({
        wallet_id: selectedWallet.id,
        category_id: selectedCategory.id,
        type,
        amount: Number(amount),
        title: title.trim(),
        note: note.trim() || undefined,
        transaction_date: toISO(selectedDate),
      });
      router.back();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingData) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: textPrimary }]}>New Transaction</Text>
          <TouchableOpacity
            onPress={handleSubmit} disabled={submitting}
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
            {(['expense', 'income'] as TxType[]).map(t => (
              <Pressable
                key={t}
                onPress={() => setType(t)}
                style={[styles.typeBtn, type === t && { backgroundColor: t === 'expense' ? '#FF6584' : '#43C59E' }]}>
                <Ionicons
                  name={t === 'expense' ? 'arrow-up-circle' : 'arrow-down-circle'}
                  size={16} color={type === t ? '#FFF' : textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.typeBtnText, { color: type === t ? '#FFF' : textSecondary }]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Amount */}
          <View style={[styles.amountCard, { backgroundColor: accentColor }]}>
            <Text style={styles.amountSymbol}>{walletCurrencySymbol}</Text>
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
                placeholder="Title (e.g. Lunch, Salary)"
                placeholderTextColor={textSecondary}
              />
            </View>

            {/* Date picker row */}
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              style={[styles.field, { borderBottomColor: borderColor }]}>
              <Ionicons name="calendar-outline" size={18} color="#6C63FF" />
              <Text style={[styles.fieldInput, { color: textPrimary }]}>
                {formatDisplayDate(selectedDate)}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={textSecondary} />
            </TouchableOpacity>

            {/* Android date picker shown inline when triggered */}
            {showDatePicker && Platform.OS === 'android' && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="default"
                onChange={onDateChange}
                maximumDate={new Date()}
              />
            )}

            {/* iOS date picker shown inline */}
            {showDatePicker && Platform.OS === 'ios' && (
              <View style={[styles.iosPickerWrap, { borderBottomColor: borderColor }]}>
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="spinner"
                  onChange={onDateChange}
                  maximumDate={new Date()}
                  style={{ height: 150 }}
                />
                <TouchableOpacity
                  onPress={() => setShowDatePicker(false)}
                  style={styles.iosPickerDone}>
                  <Text style={styles.iosPickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Wallet */}
            <View style={[styles.field, { borderBottomColor: borderColor, minHeight: 64, flexWrap: 'wrap' }]}>
              <Ionicons name="wallet-outline" size={18} color="#6C63FF" />
              <Text style={[styles.fieldLabel, { color: textSecondary }]}>Wallet</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {wallets.length === 0
                  ? <Text style={[styles.noData, { color: textSecondary }]}>No wallets — create one first</Text>
                  : wallets.map(w => (
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

            {/* Category */}
            <View style={[styles.field, { borderBottomColor: borderColor, minHeight: 64, flexWrap: 'wrap' }]}>
              <Ionicons name="pricetag-outline" size={18} color="#6C63FF" />
              <Text style={[styles.fieldLabel, { color: textSecondary }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {filteredCategories.length === 0
                  ? <Text style={[styles.noData, { color: textSecondary }]}>No {type} categories</Text>
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

          {/* Summary preview */}
          {amount && title && selectedWallet && selectedCategory && (
            <View style={[styles.summary, { backgroundColor: accentColor + '15', borderColor: accentColor + '40' }]}>
              <Ionicons name="checkmark-circle" size={18} color={accentColor} />
              <Text style={[styles.summaryText, { color: textPrimary }]}>
                <Text style={{ fontWeight: '700' }}>
                  {walletCurrencySymbol}{Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
                {'  ·  '}{selectedCategory.name}{'  ·  '}{selectedWallet.name}
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1,
  },
  closeBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  saveBtn: {
    backgroundColor: '#6C63FF', paddingHorizontal: 18, paddingVertical: 8,
    borderRadius: 20, minWidth: 64, alignItems: 'center',
  },
  saveBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },

  scroll: { padding: 20, gap: 16 },

  typeToggle: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  typeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  typeBtnText: { fontSize: 15, fontWeight: '600' },

  amountCard: {
    borderRadius: 20, padding: 28,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  amountSymbol: { color: 'rgba(255,255,255,0.8)', fontSize: 30, fontWeight: '700' },
  amountInput: {
    color: '#FFF', fontSize: 42, fontWeight: '800', minWidth: 100, textAlign: 'center',
  },

  formCard: {
    borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  field: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, gap: 12, minHeight: 56,
  },
  fieldLabel: { fontSize: 14, fontWeight: '500' },
  fieldInput: { flex: 1, fontSize: 15 },
  iosPickerWrap: { borderBottomWidth: 1, paddingBottom: 8 },
  iosPickerDone: { alignItems: 'flex-end', paddingHorizontal: 16, paddingBottom: 8 },
  iosPickerDoneText: { color: '#6C63FF', fontWeight: '700', fontSize: 15 },

  chipRow: { flexDirection: 'row', gap: 8, paddingRight: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5 },
  chipText: { fontSize: 13, fontWeight: '600' },
  noData: { fontSize: 13, fontStyle: 'italic' },

  summary: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 14, borderWidth: 1,
  },
  summaryText: { flex: 1, fontSize: 13 },
});
