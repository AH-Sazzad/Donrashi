import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

import {
  CURRENCY_SYMBOLS,
  SupportedCurrency,
  useCurrency,
} from '@/context/CurrencyContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { transfersApi, walletsApi } from '@/services/api';
import { Wallet } from '@/types';

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDisplayDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

function sym(currency: string): string {
  return CURRENCY_SYMBOLS[(currency ?? 'BDT') as SupportedCurrency] ?? '৳';
}

// ─── Wallet Selector ──────────────────────────────────────────────────────────

function WalletSelector({
  label, wallets, selected, exclude, isDark, onSelect,
}: {
  label: string;
  wallets: Wallet[];
  selected: Wallet | null;
  exclude?: number;
  isDark: boolean;
  onSelect: (w: Wallet) => void;
}) {
  const textPrimary  = isDark ? '#F1F5F9' : '#1E293B';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const borderColor  = isDark ? '#2A2A3E' : '#E2E8F0';

  const available = wallets.filter(w => w.id !== exclude);

  return (
    <View style={styles.selectorWrap}>
      <Text style={[styles.selectorLabel, { color: textSecondary }]}>{label}</Text>
      {available.length === 0 ? (
        <Text style={[styles.noWallet, { color: textSecondary }]}>No other wallets available</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}>
          {available.map(w => {
            const isSelected = selected?.id === w.id;
            return (
              <Pressable
                key={w.id}
                onPress={() => onSelect(w)}
                style={[
                  styles.walletChip,
                  { borderColor: w.color || '#6C63FF' },
                  isSelected && { backgroundColor: w.color || '#6C63FF' },
                ]}>
                <View style={[
                  styles.walletChipDot,
                  { backgroundColor: isSelected ? 'rgba(255,255,255,0.4)' : (w.color || '#6C63FF') + '33' },
                ]}>
                  <Ionicons name="wallet" size={13} color={isSelected ? '#FFF' : (w.color || '#6C63FF')} />
                </View>
                <View>
                  <Text style={[
                    styles.walletChipName,
                    { color: isSelected ? '#FFF' : textPrimary },
                  ]}>
                    {w.name}
                  </Text>
                  <Text style={[
                    styles.walletChipSub,
                    { color: isSelected ? 'rgba(255,255,255,0.75)' : textSecondary },
                  ]}>
                    {sym(w.currency)}{Number(w.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })} · {w.currency}
                  </Text>
                </View>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={16} color="#FFF" style={{ marginLeft: 4 }} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      {selected && (
        <View style={[styles.selectedBadge, { borderColor }]}>
          <View style={[styles.selectedDot, { backgroundColor: selected.color || '#6C63FF' }]} />
          <Text style={[styles.selectedBadgeText, { color: textPrimary }]}>
            {selected.name} · {selected.currency}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TransferScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { rates } = useCurrency();

  // Optional pre-selected wallet from navigation params
  const params = useLocalSearchParams<{ fromWalletId?: string }>();

  const bg            = isDark ? '#0F0F1A' : '#F8F9FF';
  const cardBg        = isDark ? '#1E1E2E' : '#FFFFFF';
  const textPrimary   = isDark ? '#F1F5F9' : '#1E293B';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const inputBg       = isDark ? '#2A2A3E' : '#F1F5F9';
  const borderColor   = isDark ? '#2A2A3E' : '#E2E8F0';

  const [wallets, setWallets]           = useState<Wallet[]>([]);
  const [loadingData, setLoadingData]   = useState(true);
  const [submitting, setSubmitting]     = useState(false);

  const [fromWallet, setFromWallet]     = useState<Wallet | null>(null);
  const [toWallet, setToWallet]         = useState<Wallet | null>(null);

  // Amount to send (in fromWallet currency)
  const [sendAmount, setSendAmount]     = useState('');
  // Amount to receive (in toWallet currency) — editable so user can set custom vendor rate
  const [receiveAmount, setReceiveAmount] = useState('');
  const [receiveEdited, setReceiveEdited] = useState(false); // tracks if user manually changed receive

  // Transfer fee (in fromWallet currency)
  const [fee, setFee]                   = useState('');
  const [note, setNote]                 = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Load wallets
  useEffect(() => {
    (async () => {
      try {
        const res = await walletsApi.list();
        const ws  = res.data ?? [];
        setWallets(ws);

        // Pre-select from wallet if param provided, else default wallet
        if (params.fromWalletId) {
          const preSelected = ws.find(w => w.id === Number(params.fromWalletId));
          setFromWallet(preSelected ?? ws.find(w => w.is_default) ?? ws[0] ?? null);
        } else {
          setFromWallet(ws.find(w => w.is_default) ?? ws[0] ?? null);
        }
      } catch (e: unknown) {
        Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load wallets.');
      } finally {
        setLoadingData(false);
      }
    })();
  }, [params.fromWalletId]);

  // ── Auto-convert: when sendAmount or wallets change, auto-fill receiveAmount
  //    unless user has manually edited it
  const autoConvertedReceive = useMemo(() => {
    if (!fromWallet || !toWallet || !sendAmount || isNaN(Number(sendAmount))) return '';
    const amount = Number(sendAmount);
    if (fromWallet.currency === toWallet.currency) return amount.toFixed(2);

    const fromCur = (fromWallet.currency ?? 'BDT') as SupportedCurrency;
    const toCur   = (toWallet.currency   ?? 'BDT') as SupportedCurrency;

    // Convert: amount → BDT → toCurrency
    const fromRate = fromCur === 'BDT' ? 1 : (rates[fromCur] ?? 1);
    const toRate   = toCur   === 'BDT' ? 1 : (rates[toCur]   ?? 1);

    // fromRate: 1 BDT = x fromCur  → 1 fromCur = 1/fromRate BDT
    const inBDT = fromCur === 'BDT' ? amount : amount / fromRate;
    const result = toCur === 'BDT' ? inBDT : inBDT * toRate;
    return result.toFixed(2);
  }, [fromWallet, toWallet, sendAmount, rates]);

  useEffect(() => {
    if (!receiveEdited) {
      setReceiveAmount(autoConvertedReceive);
    }
  }, [autoConvertedReceive, receiveEdited]);

  // Reset receive edit flag when wallets or amount change significantly
  const handleSendAmountChange = useCallback((v: string) => {
    setSendAmount(v);
    setReceiveEdited(false); // reset — let auto-convert take over again
  }, []);

  const handleReceiveAmountChange = useCallback((v: string) => {
    setReceiveAmount(v);
    setReceiveEdited(true); // user is now controlling this manually
  }, []);

  // Reset to auto rate
  const resetToAutoRate = useCallback(() => {
    setReceiveEdited(false);
    setReceiveAmount(autoConvertedReceive);
  }, [autoConvertedReceive]);

  function onDateChange(_: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) setSelectedDate(date);
  }

  // ── Exchange rate display
  const exchangeRateLabel = useMemo(() => {
    if (!fromWallet || !toWallet || !sendAmount || !receiveAmount) return null;
    const s = Number(sendAmount);
    const r = Number(receiveAmount);
    if (!s || !r) return null;
    if (fromWallet.currency === toWallet.currency) return null;
    const rate = r / s;
    return `1 ${fromWallet.currency} = ${rate.toFixed(4)} ${toWallet.currency}`;
  }, [fromWallet, toWallet, sendAmount, receiveAmount]);

  // ── Summary numbers
  const totalDeducted = useMemo(() => {
    const s = Number(sendAmount) || 0;
    const f = Number(fee) || 0;
    return s + f;
  }, [sendAmount, fee]);

  async function handleSubmit() {
    if (!fromWallet) { Alert.alert('Missing', 'Select source wallet.'); return; }
    if (!toWallet)   { Alert.alert('Missing', 'Select destination wallet.'); return; }
    if (!sendAmount || isNaN(Number(sendAmount)) || Number(sendAmount) <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid send amount.'); return;
    }
    if (!receiveAmount || isNaN(Number(receiveAmount)) || Number(receiveAmount) <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid receive amount.'); return;
    }
    const feeVal = Number(fee) || 0;
    if (feeVal < 0) { Alert.alert('Invalid fee', 'Fee cannot be negative.'); return; }

    setSubmitting(true);
    try {
      await transfersApi.create({
        from_wallet_id: fromWallet.id,
        to_wallet_id:   toWallet.id,
        from_amount:    Number(sendAmount),
        to_amount:      Number(receiveAmount),
        fee:            feeVal,
        note:           note.trim() || undefined,
        transfer_date:  toISO(selectedDate),
      });
      router.back();
    } catch (e: unknown) {
      Alert.alert('Transfer Failed', e instanceof Error ? e.message : 'Something went wrong.');
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
          <View style={styles.headerCenter}>
            <Ionicons name="swap-horizontal" size={18} color="#6C63FF" style={{ marginRight: 6 }} />
            <Text style={[styles.headerTitle, { color: textPrimary }]}>Transfer</Text>
          </View>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            style={[styles.saveBtn, submitting && { opacity: 0.5 }]}>
            {submitting
              ? <ActivityIndicator size="small" color="#FFF" />
              : <Text style={styles.saveBtnText}>Send</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled">

          {/* From → To visual */}
          <View style={[styles.flowCard, { backgroundColor: cardBg }]}>
            <View style={styles.flowSide}>
              <Text style={[styles.flowLabel, { color: textSecondary }]}>From</Text>
              <Text style={[styles.flowWallet, { color: textPrimary }]} numberOfLines={1}>
                {fromWallet?.name ?? '—'}
              </Text>
              <Text style={[styles.flowCurrency, { color: textSecondary }]}>
                {fromWallet?.currency ?? ''}
              </Text>
            </View>
            <View style={[styles.flowArrow, { backgroundColor: '#6C63FF' + '18' }]}>
              <Ionicons name="arrow-forward" size={20} color="#6C63FF" />
            </View>
            <View style={styles.flowSide}>
              <Text style={[styles.flowLabel, { color: textSecondary }]}>To</Text>
              <Text style={[styles.flowWallet, { color: textPrimary }]} numberOfLines={1}>
                {toWallet?.name ?? '—'}
              </Text>
              <Text style={[styles.flowCurrency, { color: textSecondary }]}>
                {toWallet?.currency ?? ''}
              </Text>
            </View>
          </View>

          {/* From Wallet selector */}
          <View style={[styles.formCard, { backgroundColor: cardBg }]}>
            <WalletSelector
              label="From Wallet"
              wallets={wallets}
              selected={fromWallet}
              exclude={toWallet?.id}
              isDark={isDark}
              onSelect={w => { setFromWallet(w); setReceiveEdited(false); }}
            />
          </View>

          {/* To Wallet selector */}
          <View style={[styles.formCard, { backgroundColor: cardBg }]}>
            <WalletSelector
              label="To Wallet"
              wallets={wallets}
              selected={toWallet}
              exclude={fromWallet?.id}
              isDark={isDark}
              onSelect={w => { setToWallet(w); setReceiveEdited(false); }}
            />
          </View>

          {/* Amounts */}
          <View style={[styles.formCard, { backgroundColor: cardBg }]}>

            {/* Send amount */}
            <View style={[styles.field, { borderBottomColor: borderColor }]}>
              <View style={styles.fieldLeft}>
                <Ionicons name="arrow-up-circle-outline" size={18} color="#FF6584" />
                <Text style={[styles.fieldLabel, { color: textSecondary }]}>You Send</Text>
              </View>
              <View style={styles.amountRow}>
                <Text style={[styles.currencySym, { color: '#FF6584' }]}>
                  {fromWallet ? sym(fromWallet.currency) : '৳'}
                </Text>
                <TextInput
                  style={[styles.amountInput, { color: textPrimary }]}
                  value={sendAmount}
                  onChangeText={handleSendAmountChange}
                  placeholder="0.00"
                  placeholderTextColor={textSecondary}
                  keyboardType="decimal-pad"
                />
                <Text style={[styles.currencyCode, { color: textSecondary }]}>
                  {fromWallet?.currency ?? ''}
                </Text>
              </View>
            </View>

            {/* Receive amount */}
            <View style={[styles.field, { borderBottomColor: borderColor }]}>
              <View style={styles.fieldLeft}>
                <Ionicons name="arrow-down-circle-outline" size={18} color="#43C59E" />
                <Text style={[styles.fieldLabel, { color: textSecondary }]}>They Receive</Text>
              </View>
              <View style={styles.amountRow}>
                <Text style={[styles.currencySym, { color: '#43C59E' }]}>
                  {toWallet ? sym(toWallet.currency) : '৳'}
                </Text>
                <TextInput
                  style={[styles.amountInput, { color: textPrimary }]}
                  value={receiveAmount}
                  onChangeText={handleReceiveAmountChange}
                  placeholder="0.00"
                  placeholderTextColor={textSecondary}
                  keyboardType="decimal-pad"
                />
                <Text style={[styles.currencyCode, { color: textSecondary }]}>
                  {toWallet?.currency ?? ''}
                </Text>
              </View>
            </View>

            {/* Exchange rate display + reset button */}
            {exchangeRateLabel && (
              <View style={[styles.rateRow, { borderBottomColor: borderColor }]}>
                <Ionicons name="swap-horizontal-outline" size={14} color="#6C63FF" />
                <Text style={[styles.rateText, { color: '#6C63FF' }]}>{exchangeRateLabel}</Text>
                {receiveEdited && (
                  <TouchableOpacity onPress={resetToAutoRate} style={styles.resetBtn}>
                    <Ionicons name="refresh-outline" size={13} color={textSecondary} />
                    <Text style={[styles.resetBtnText, { color: textSecondary }]}>Auto</Text>
                  </TouchableOpacity>
                )}
                {receiveEdited && (
                  <View style={styles.customRateBadge}>
                    <Text style={styles.customRateBadgeText}>Custom rate</Text>
                  </View>
                )}
              </View>
            )}

            {/* Fee */}
            <View style={[styles.field, { borderBottomColor: borderColor }]}>
              <View style={styles.fieldLeft}>
                <Ionicons name="receipt-outline" size={18} color="#F59E0B" />
                <Text style={[styles.fieldLabel, { color: textSecondary }]}>Transfer Fee</Text>
              </View>
              <View style={styles.amountRow}>
                <Text style={[styles.currencySym, { color: '#F59E0B' }]}>
                  {fromWallet ? sym(fromWallet.currency) : '৳'}
                </Text>
                <TextInput
                  style={[styles.amountInput, { color: textPrimary }]}
                  value={fee}
                  onChangeText={setFee}
                  placeholder="0.00"
                  placeholderTextColor={textSecondary}
                  keyboardType="decimal-pad"
                />
                <Text style={[styles.currencyCode, { color: textSecondary }]}>
                  {fromWallet?.currency ?? ''}
                </Text>
              </View>
            </View>
            {Number(fee) > 0 && (
              <View style={styles.feeNote}>
                <Ionicons name="information-circle-outline" size={13} color={textSecondary} />
                <Text style={[styles.feeNoteText, { color: textSecondary }]}>
                  Fee will be recorded as an "MFS Charge" expense on {fromWallet?.name ?? 'source wallet'}
                </Text>
              </View>
            )}

            {/* Date */}
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              style={[styles.field, { borderBottomColor: borderColor }]}>
              <View style={styles.fieldLeft}>
                <Ionicons name="calendar-outline" size={18} color="#6C63FF" />
                <Text style={[styles.fieldLabel, { color: textSecondary }]}>Date</Text>
              </View>
              <View style={styles.amountRow}>
                <Text style={[styles.dateText, { color: textPrimary }]}>
                  {formatDisplayDate(selectedDate)}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={textSecondary} />
              </View>
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

            {/* Note */}
            <View style={[styles.field, { borderBottomColor: 'transparent' }]}>
              <View style={styles.fieldLeft}>
                <Ionicons name="document-text-outline" size={18} color="#6C63FF" />
                <Text style={[styles.fieldLabel, { color: textSecondary }]}>Note</Text>
              </View>
              <TextInput
                style={[styles.noteInput, { color: textPrimary }]}
                value={note}
                onChangeText={setNote}
                placeholder="Optional note"
                placeholderTextColor={textSecondary}
                multiline
              />
            </View>
          </View>

          {/* Summary */}
          {fromWallet && toWallet && sendAmount && receiveAmount && (
            <View style={[styles.summaryCard, { backgroundColor: '#6C63FF' + '12', borderColor: '#6C63FF' + '30' }]}>
              <Text style={[styles.summaryTitle, { color: textPrimary }]}>Transfer Summary</Text>

              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: textSecondary }]}>Deducted from {fromWallet.name}</Text>
                <Text style={[styles.summaryValue, { color: '#FF6584' }]}>
                  -{sym(fromWallet.currency)}{totalDeducted.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
              </View>

              {Number(fee) > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: textSecondary }]}>  · Transfer ({sym(fromWallet.currency)}{Number(sendAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })})</Text>
                  <Text style={[styles.summaryLabel, { color: textSecondary }]}></Text>
                </View>
              )}
              {Number(fee) > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: textSecondary }]}>  · MFS Charge</Text>
                  <Text style={[styles.summaryValue, { color: '#F59E0B' }]}>
                    -{sym(fromWallet.currency)}{Number(fee).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              )}

              <View style={[styles.summaryDivider, { backgroundColor: '#6C63FF' + '25' }]} />

              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: textSecondary }]}>Credited to {toWallet.name}</Text>
                <Text style={[styles.summaryValue, { color: '#43C59E' }]}>
                  +{sym(toWallet.currency)}{Number(receiveAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
              </View>

              {fromWallet.currency !== toWallet.currency && (
                <View style={styles.summaryRow}>
                  <Ionicons name="swap-horizontal-outline" size={12} color={textSecondary} />
                  <Text style={[styles.summaryLabel, { color: textSecondary, marginLeft: 4 }]}>
                    {exchangeRateLabel}
                    {receiveEdited ? '  (custom)' : '  (live rate)'}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Bottom padding for keyboard */}
          <View style={{ height: 24 }} />
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
  closeBtn:     { padding: 4 },
  headerCenter: { flexDirection: 'row', alignItems: 'center' },
  headerTitle:  { fontSize: 17, fontWeight: '700' },
  saveBtn: {
    backgroundColor: '#6C63FF', paddingHorizontal: 18, paddingVertical: 8,
    borderRadius: 20, minWidth: 64, alignItems: 'center',
  },
  saveBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },

  scroll: { padding: 20, gap: 12 },

  // From→To flow card
  flowCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 20,
    padding: 20, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  flowSide:     { flex: 1, alignItems: 'center' },
  flowLabel:    { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  flowWallet:   { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  flowCurrency: { fontSize: 12, marginTop: 2 },
  flowArrow: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },

  // Wallet selector
  selectorWrap: { gap: 10 },
  selectorLabel: { fontSize: 13, fontWeight: '600' },
  noWallet:      { fontSize: 13 },
  chipRow:       { gap: 10, paddingVertical: 4 },
  walletChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5,
  },
  walletChipDot: {
    width: 26, height: 26, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  walletChipName: { fontSize: 13, fontWeight: '700' },
  walletChipSub:  { fontSize: 11, marginTop: 1 },
  selectedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, borderRadius: 10, borderWidth: 1,
  },
  selectedDot:       { width: 10, height: 10, borderRadius: 5 },
  selectedBadgeText: { fontSize: 13, fontWeight: '600' },

  // Form card
  formCard: {
    borderRadius: 20, padding: 20, gap: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  field: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 14,
    borderBottomWidth: 1,
  },
  fieldLeft:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fieldLabel:  { fontSize: 13, fontWeight: '600' },
  amountRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  currencySym: { fontSize: 16, fontWeight: '700', minWidth: 16 },
  amountInput: { fontSize: 18, fontWeight: '700', minWidth: 80, textAlign: 'right' },
  currencyCode:{ fontSize: 12, fontWeight: '600', marginLeft: 2 },
  dateText:    { fontSize: 14, fontWeight: '500', marginRight: 6 },
  noteInput:   { flex: 1, fontSize: 14, textAlign: 'right' },

  // Rate row
  rateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, borderBottomWidth: 1,
  },
  rateText:        { fontSize: 12, fontWeight: '600', flex: 1 },
  resetBtn:        { flexDirection: 'row', alignItems: 'center', gap: 3, padding: 4 },
  resetBtnText:    { fontSize: 11 },
  customRateBadge: {
    backgroundColor: '#F59E0B22', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  customRateBadgeText: { color: '#F59E0B', fontSize: 10, fontWeight: '700' },

  // Fee note
  feeNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    paddingVertical: 8, paddingHorizontal: 4,
  },
  feeNoteText: { fontSize: 11, flex: 1, lineHeight: 16 },

  // iOS date picker
  iosPickerWrap:    { paddingBottom: 8 },
  iosPickerDone:    { alignItems: 'flex-end', paddingRight: 4, paddingBottom: 4 },
  iosPickerDoneText:{ color: '#6C63FF', fontWeight: '700', fontSize: 15 },

  // Summary card
  summaryCard: {
    borderRadius: 16, padding: 18, gap: 10, borderWidth: 1,
  },
  summaryTitle:   { fontSize: 14, fontWeight: '700' },
  summaryRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel:   { fontSize: 12 },
  summaryValue:   { fontSize: 13, fontWeight: '700' },
  summaryDivider: { height: 1, marginVertical: 4 },
});
