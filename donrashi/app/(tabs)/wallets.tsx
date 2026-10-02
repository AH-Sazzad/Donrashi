import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
    CURRENCY_NAMES,
    CURRENCY_SYMBOLS,
    SupportedCurrency,
    useCurrency,
} from '@/context/CurrencyContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { walletsApi } from '@/services/api';
import { Wallet } from '@/types';

const PRESET_COLORS = [
  '#6C63FF', '#FF6584', '#43C59E', '#4D96FF', '#F59E0B',
  '#EF4444', '#10B981', '#8B5CF6', '#F97316', '#06B6D4',
];

const SUPPORTED_CURRENCIES: SupportedCurrency[] = ['BDT', 'USD', 'EUR'];

// ─── Wallet Form Modal ────────────────────────────────────────────────────────

function WalletFormModal({ visible, initial, isDark, onClose, onSaved }: {
  visible: boolean; initial?: Wallet | null;
  isDark: boolean; onClose: () => void; onSaved: (w: Wallet) => void;
}) {
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [currency, setCurrency] = useState<SupportedCurrency>('BDT');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; balance?: string }>({});

  const bg = isDark ? '#1E1E2E' : '#FFFFFF';
  const overlay = isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)';
  const textPrimary = isDark ? '#F1F5F9' : '#1E293B';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const inputBg = isDark ? '#2A2A3E' : '#F1F5F9';
  const borderColor = isDark ? '#3A3A5E' : '#E2E8F0';

  useEffect(() => {
    if (visible) {
      setName(initial?.name ?? '');
      setBalance(initial?.balance != null ? String(initial.balance) : '');
      setCurrency((initial?.currency as SupportedCurrency) ?? 'BDT');
      setColor(initial?.color ?? PRESET_COLORS[0]);
      setIsDefault(initial?.is_default ?? false);
      setErrors({});
    }
  }, [visible, initial]);

  function validate() {
    const e: typeof errors = {};
    if (!name.trim()) e.name = 'Name is required';
    if (!initial && (balance === '' || isNaN(Number(balance)) || Number(balance) < 0))
      e.balance = 'Enter a valid balance';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      let saved: Wallet;
      if (initial) {
        const res = await walletsApi.update(initial.id, { name: name.trim(), color, is_default: isDefault });
        saved = res.data;
      } else {
        const res = await walletsApi.create({
          name: name.trim(), currency, balance: Number(balance),
          icon: 'wallet', color, is_default: isDefault,
        });
        saved = res.data;
      }
      onSaved(saved);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save wallet.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={[styles.modalOverlay, { backgroundColor: overlay }]} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: bg }]}>
          <View style={styles.sheetHandle} />
          <Text style={[styles.sheetTitle, { color: textPrimary }]}>
            {initial ? 'Edit Wallet' : 'New Wallet'}
          </Text>

          {/* Name */}
          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, { color: textSecondary }]}>Wallet Name</Text>
            <View style={[styles.inputWrap, { backgroundColor: inputBg, borderColor: errors.name ? '#FF6584' : borderColor }]}>
              <Ionicons name="wallet-outline" size={17} color="#6C63FF" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: textPrimary }]}
                value={name}
                onChangeText={v => { setName(v); setErrors(e => ({ ...e, name: undefined })); }}
                placeholder="e.g. Cash, bKash, Bank"
                placeholderTextColor={textSecondary}
                autoCapitalize="words"
              />
            </View>
            {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
          </View>

          {/* Currency (create only) */}
          {!initial && (
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: textSecondary }]}>Currency</Text>
              <View style={[styles.toggleRow, { backgroundColor: inputBg }]}>
                {SUPPORTED_CURRENCIES.map(c => (
                  <Pressable
                    key={c}
                    onPress={() => setCurrency(c)}
                    style={[styles.toggleBtn, currency === c && { backgroundColor: '#6C63FF' }]}>
                    <Text style={[styles.toggleText, { color: currency === c ? '#FFF' : textSecondary }]}>
                      {CURRENCY_SYMBOLS[c]} {c}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.currencyHint, { color: textSecondary }]}>
                {CURRENCY_NAMES[currency]}
              </Text>
            </View>
          )}

          {/* Initial Balance (create only) */}
          {!initial && (
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: textSecondary }]}>
                Initial Balance ({currency})
              </Text>
              <View style={[styles.inputWrap, { backgroundColor: inputBg, borderColor: errors.balance ? '#FF6584' : borderColor }]}>
                <Text style={[styles.currencySymbol, { color: '#6C63FF' }]}>
                  {CURRENCY_SYMBOLS[currency]}
                </Text>
                <TextInput
                  style={[styles.input, { color: textPrimary }]}
                  value={balance}
                  onChangeText={v => { setBalance(v); setErrors(e => ({ ...e, balance: undefined })); }}
                  placeholder="0.00"
                  placeholderTextColor={textSecondary}
                  keyboardType="decimal-pad"
                />
              </View>
              {errors.balance ? <Text style={styles.errorText}>{errors.balance}</Text> : null}
            </View>
          )}

          {/* Color */}
          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, { color: textSecondary }]}>Color</Text>
            <View style={styles.colorGrid}>
              {PRESET_COLORS.map(c => (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  style={[styles.colorDot, { backgroundColor: c }, color === c && styles.colorDotSelected]}>
                  {color === c && <Ionicons name="checkmark" size={14} color="#FFF" />}
                </Pressable>
              ))}
            </View>
          </View>

          {/* Default toggle */}
          <Pressable onPress={() => setIsDefault(v => !v)} style={[styles.checkRow, { borderColor }]}>
            <View style={[styles.checkbox, {
              borderColor: isDefault ? '#6C63FF' : borderColor,
              backgroundColor: isDefault ? '#6C63FF' : 'transparent',
            }]}>
              {isDefault && <Ionicons name="checkmark" size={14} color="#FFF" />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.checkLabel, { color: textPrimary }]}>Set as default wallet</Text>
              <Text style={[styles.checkSub, { color: textSecondary }]}>Used when adding transactions</Text>
            </View>
          </Pressable>

          <TouchableOpacity onPress={handleSave} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.6 }]}>
            {saving
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.saveBtnText}>{initial ? 'Update' : 'Create'} Wallet</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Wallet Card ──────────────────────────────────────────────────────────────

function WalletCard({ item, isDark, onEdit, onDelete }: {
  item: Wallet; isDark: boolean;
  onEdit: (w: Wallet) => void; onDelete: (id: number) => void;
}) {
  const { toBase, formatBase, formatCurrency, baseCurrency } = useCurrency();
  const walletCurrency = (item.currency ?? 'BDT') as SupportedCurrency;
  const accentColor = item.color || '#6C63FF';
  const convertedBalance = toBase(item.balance, walletCurrency);
  const showConverted = walletCurrency !== baseCurrency;

  return (
    <View style={[styles.card, { backgroundColor: accentColor }]}>
      <View style={styles.cardTop}>
        <View style={[styles.walletIconWrap, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <Ionicons name="wallet" size={22} color="#FFF" />
        </View>
        <View style={styles.cardTopRight}>
          {item.is_default && (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultBadgeText}>Default</Text>
            </View>
          )}
          <TouchableOpacity onPress={() => onEdit(item)} style={styles.cardBtn}>
            <Ionicons name="pencil-outline" size={16} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Alert.alert('Delete Wallet', `Delete "${item.name}"?`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => onDelete(item.id) },
            ])}
            style={styles.cardBtn}>
            <Ionicons name="trash-outline" size={16} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Native balance */}
      <Text style={styles.balanceLabel}>Balance</Text>
      <Text style={styles.balanceAmount}>
        {formatCurrency(item.balance, walletCurrency)}
      </Text>

      {/* Converted amount */}
      {showConverted && (
        <Text style={styles.convertedAmount}>
          ≈ {formatBase(convertedBalance)} ({baseCurrency})
        </Text>
      )}

      <View style={styles.cardBottom}>
        <Text style={styles.walletName}>{item.name}</Text>
        <View style={styles.currencyTag}>
          <Text style={styles.currencyTagText}>{item.currency ?? 'BDT'}</Text>
        </View>
      </View>

      {/* Transfer button */}
      <TouchableOpacity
        onPress={() => router.push({ pathname: '/transfer', params: { fromWalletId: String(item.id) } })}
        style={styles.transferBtn}
        activeOpacity={0.8}>
        <Ionicons name="swap-horizontal-outline" size={15} color="#FFF" />
        <Text style={styles.transferBtnText}>Transfer</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WalletsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { toBase, formatBase, baseCurrency } = useCurrency();

  const bg = isDark ? '#0F0F1A' : '#F8F9FF';
  const cardBg = isDark ? '#1E1E2E' : '#FFFFFF';
  const textPrimary = isDark ? '#F1F5F9' : '#1E293B';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<Wallet | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await walletsApi.list();
      setWallets(res.data ?? []);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load wallets.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = useCallback(async (id: number) => {
    try {
      await walletsApi.delete(id);
      setWallets(prev => prev.filter(w => w.id !== id));
    } catch {
      Alert.alert('Error', 'Could not delete wallet.');
    }
  }, []);

  const handleSaved = useCallback((wallet: Wallet) => {
    setWallets(prev => {
      const idx = prev.findIndex(w => w.id === wallet.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = wallet; return next; }
      return [...prev, wallet];
    });
    setModalVisible(false);
    setEditTarget(null);
  }, []);

  const openCreate = () => { setEditTarget(null); setModalVisible(true); };
  const openEdit = (w: Wallet) => { setEditTarget(w); setModalVisible(true); };

  // Total in base currency
  const totalBalance = wallets.reduce((sum, w) => {
    return sum + toBase(w.balance, (w.currency ?? 'BDT') as SupportedCurrency);
  }, 0);

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: textPrimary }]}>Wallets</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => router.push('/transfer')}
            style={[styles.transferHeaderBtn]}>
            <Ionicons name="swap-horizontal-outline" size={18} color="#6C63FF" />
            <Text style={styles.transferHeaderBtnText}>Transfer</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={openCreate} style={styles.addBtn}>
            <Ionicons name="add" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Total card */}
      <View style={[styles.totalCard, { backgroundColor: cardBg }]}>
        <Text style={[styles.totalLabel, { color: textSecondary }]}>
          Total Balance ({baseCurrency})
        </Text>
        <Text style={[styles.totalAmount, { color: textPrimary }]}>{formatBase(totalBalance)}</Text>
        <Text style={[styles.totalCount, { color: textSecondary }]}>
          {wallets.length} wallet{wallets.length !== 1 ? 's' : ''} · auto-converted
        </Text>
      </View>

      <FlatList
        data={wallets}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor="#6C63FF" colors={['#6C63FF']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="wallet-outline" size={48} color={textSecondary} />
            <Text style={[styles.emptyTitle, { color: textPrimary }]}>No wallets yet</Text>
            <Text style={[styles.emptyText, { color: textSecondary }]}>Tap + to add your first wallet</Text>
            <TouchableOpacity onPress={openCreate} style={styles.emptyBtn}>
              <Text style={styles.emptyBtnText}>Create Wallet</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <WalletCard item={item} isDark={isDark} onEdit={openEdit} onDelete={handleDelete} />
        )}
      />

      <WalletFormModal
        visible={modalVisible} initial={editTarget} isDark={isDark}
        onClose={() => { setModalVisible(false); setEditTarget(null); }}
        onSaved={handleSaved}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  headerTitle: { fontSize: 28, fontWeight: '800' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  transferHeaderBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#6C63FF',
  },
  transferHeaderBtnText: { color: '#6C63FF', fontWeight: '700', fontSize: 13 },
  addBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#6C63FF',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },

  totalCard: {
    marginHorizontal: 20, marginBottom: 16, borderRadius: 16, padding: 20, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  totalLabel: { fontSize: 12, marginBottom: 4 },
  totalAmount: { fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  totalCount: { fontSize: 12, marginTop: 4 },

  list: { paddingHorizontal: 20, paddingBottom: 100, gap: 16 },

  card: {
    borderRadius: 24, padding: 22,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 6,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  walletIconWrap: { width: 42, height: 42, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  cardTopRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardBtn: { padding: 6 },
  defaultBadge: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  defaultBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  balanceLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 4 },
  balanceAmount: { color: '#FFF', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  convertedAmount: { color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 4, marginBottom: 8 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  walletName: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  currencyTag: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  currencyTagText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  transferBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 14, paddingVertical: 10, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  transferBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { fontSize: 14 },
  emptyBtn: { marginTop: 8, backgroundColor: '#6C63FF', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },

  // Modal
  modalOverlay: { ...StyleSheet.absoluteFillObject },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, gap: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 16, elevation: 10,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 4 },
  sheetTitle: { fontSize: 20, fontWeight: '800' },

  formGroup: { gap: 8 },
  formLabel: { fontSize: 13, fontWeight: '600', marginLeft: 2 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 12,
    borderWidth: 1.5, paddingHorizontal: 14, height: 50,
  },
  inputIcon: { marginRight: 10 },
  currencySymbol: { fontSize: 18, fontWeight: '700', marginRight: 8 },
  input: { flex: 1, fontSize: 15 },
  errorText: { color: '#FF6584', fontSize: 12 },
  currencyHint: { fontSize: 12, marginLeft: 2, marginTop: 2 },

  toggleRow: { flexDirection: 'row', borderRadius: 12, padding: 4, gap: 4 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  toggleText: { fontSize: 13, fontWeight: '600' },

  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorDot: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  colorDotSelected: { borderColor: '#FFF', transform: [{ scale: 1.15 }] },

  checkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 12, borderWidth: 1,
  },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  checkLabel: { fontSize: 15, fontWeight: '600' },
  checkSub: { fontSize: 12, marginTop: 1 },

  saveBtn: {
    backgroundColor: '#6C63FF', borderRadius: 14, height: 54,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
