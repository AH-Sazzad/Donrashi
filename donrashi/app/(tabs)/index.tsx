import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PieChart, PieSlice } from '@/components/ui/pie-chart';
import { useAuth } from '@/context/AuthContext';
import { SupportedCurrency, useCurrency } from '@/context/CurrencyContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { categoriesApi, transactionsApi, walletsApi } from '@/services/api';
import { Category, CategoryBreakdown, Transaction, Wallet } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const CATEGORY_COLORS = [
  '#6C63FF', '#FF6584', '#43C59E', '#F7C59F', '#4ECDC4',
  '#FF6B6B', '#A8E6CF', '#FFD93D', '#6BCB77', '#4D96FF',
];

type FilterPeriod = 'today' | 'month' | 'total';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDateRange(period: FilterPeriod, joinDate?: string): { from: string; to: string } {
  const now   = new Date();
  const today = toISO(now);

  if (period === 'today') {
    return { from: today, to: today };
  }
  if (period === 'month') {
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { from, to };
  }
  // total — from join date to today
  const from = joinDate ? joinDate.split('T')[0] : '2000-01-01';
  return { from, to: today };
}

function periodLabel(period: FilterPeriod, joinDate?: string): string {
  const now = new Date();
  if (period === 'today') {
    return now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  if (period === 'month') {
    return `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
  }
  // total
  if (joinDate) {
    const d = new Date(joinDate);
    return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()} – Now`;
  }
  return 'All Time';
}

function humanDate(rawDate: string): string {
  if (!rawDate) return '';
  const [y, m, d] = rawDate.split('T')[0].split('-').map(Number);
  const date  = new Date(y, m - 1, d);
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff  = Math.round((today.getTime() - date.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff <= 6)  return `${diff} days ago`;
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Filter Tab Bar ───────────────────────────────────────────────────────────

function FilterTabs({ active, isDark, onChange }: {
  active: FilterPeriod;
  isDark: boolean;
  onChange: (p: FilterPeriod) => void;
}) {
  const tabs: { key: FilterPeriod; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
    { key: 'today', label: 'Today',      icon: 'sunny-outline' },
    { key: 'month', label: 'This Month', icon: 'calendar-outline' },
    { key: 'total', label: 'All Time',   icon: 'infinite-outline' },
  ];

  const bg       = isDark ? '#1E1E2E' : '#FFFFFF';
  const textSec  = isDark ? '#94A3B8' : '#64748B';

  return (
    <View style={[filterStyles.wrap, { backgroundColor: bg }]}>
      {tabs.map(t => {
        const isActive = active === t.key;
        return (
          <TouchableOpacity
            key={t.key}
            onPress={() => onChange(t.key)}
            style={[
              filterStyles.tab,
              isActive && filterStyles.tabActive,
            ]}
            activeOpacity={0.7}>
            <Ionicons
              name={t.icon}
              size={14}
              color={isActive ? '#FFF' : textSec}
              style={{ marginRight: 4 }}
            />
            <Text style={[
              filterStyles.tabText,
              { color: isActive ? '#FFF' : textSec },
            ]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const filterStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    gap: 4,
    marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 9, borderRadius: 10,
  },
  tabActive: { backgroundColor: '#6C63FF' },
  tabText:   { fontSize: 12, fontWeight: '700' },
});

// ─── Summary Strip (income / expense text) ───────────────────────────────────

function SummaryStrip({ income, expense, formatBase, isDark }: {
  income: number; expense: number;
  formatBase: (n: number) => string; isDark: boolean;
}) {
  const cardBg = isDark ? '#1E1E2E' : '#FFFFFF';
  const textPrimary = isDark ? '#F1F5F9' : '#1E293B';
  const textSec     = isDark ? '#94A3B8' : '#64748B';
  const net = income - expense;

  return (
    <View style={[sumStyles.wrap, { backgroundColor: cardBg }]}>
      {/* Income */}
      <View style={sumStyles.item}>
        <View style={[sumStyles.iconWrap, { backgroundColor: '#43C59E18' }]}>
          <Ionicons name="arrow-down-circle" size={20} color="#43C59E" />
        </View>
        <View>
          <Text style={[sumStyles.label, { color: textSec }]}>Income</Text>
          <Text style={[sumStyles.amount, { color: '#43C59E' }]}>+{formatBase(income)}</Text>
        </View>
      </View>

      <View style={[sumStyles.divider, { backgroundColor: isDark ? '#2A2A3E' : '#F1F5F9' }]} />

      {/* Expense */}
      <View style={sumStyles.item}>
        <View style={[sumStyles.iconWrap, { backgroundColor: '#FF658418' }]}>
          <Ionicons name="arrow-up-circle" size={20} color="#FF6584" />
        </View>
        <View>
          <Text style={[sumStyles.label, { color: textSec }]}>Expense</Text>
          <Text style={[sumStyles.amount, { color: '#FF6584' }]}>-{formatBase(expense)}</Text>
        </View>
      </View>

      <View style={[sumStyles.divider, { backgroundColor: isDark ? '#2A2A3E' : '#F1F5F9' }]} />

      {/* Net */}
      <View style={sumStyles.item}>
        <View style={[sumStyles.iconWrap, {
          backgroundColor: net >= 0 ? '#43C59E18' : '#FF658418',
        }]}>
          <Ionicons
            name={net >= 0 ? 'trending-up' : 'trending-down'}
            size={20}
            color={net >= 0 ? '#43C59E' : '#FF6584'}
          />
        </View>
        <View>
          <Text style={[sumStyles.label, { color: textSec }]}>Net</Text>
          <Text style={[sumStyles.amount, { color: net >= 0 ? '#43C59E' : '#FF6584' }]}>
            {net >= 0 ? '+' : ''}{formatBase(net)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const sumStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', borderRadius: 20, padding: 16,
    marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  item:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconWrap:{ width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  label:   { fontSize: 10, fontWeight: '600', marginBottom: 2 },
  amount:  { fontSize: 12, fontWeight: '800' },
  divider: { width: 1, marginHorizontal: 4 },
});

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteConfirmModal({ visible, title, walletName, isDark, onCancel, onConfirm }: {
  visible: boolean; title: string; walletName: string;
  isDark: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  const bg          = isDark ? '#1E1E2E' : '#FFFFFF';
  const textPrimary = isDark ? '#F1F5F9' : '#1E293B';
  const textSec     = isDark ? '#94A3B8' : '#64748B';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={dlStyles.overlay}>
        <View style={[dlStyles.card, { backgroundColor: bg }]}>
          <View style={dlStyles.iconWrap}>
            <Ionicons name="trash-outline" size={28} color="#FF6584" />
          </View>
          <Text style={[dlStyles.heading, { color: textPrimary }]}>Delete Transaction?</Text>
          <Text style={[dlStyles.body, { color: textSec }]}>
            <Text style={{ fontWeight: '700', color: textPrimary }}>"{title}"</Text>
            {' '}will be permanently removed and the full amount will be refunded back to{' '}
            <Text style={{ fontWeight: '700', color: textPrimary }}>{walletName}</Text>.
          </Text>
          <View style={dlStyles.actions}>
            <TouchableOpacity onPress={onCancel} style={[dlStyles.btn, dlStyles.cancelBtn]}>
              <Text style={[dlStyles.btnText, { color: textSec }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onConfirm} style={[dlStyles.btn, dlStyles.deleteBtn]}>
              <Ionicons name="trash" size={15} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={[dlStyles.btnText, { color: '#FFF' }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const dlStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  card: {
    width: '100%', borderRadius: 24, padding: 28,
    alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25, shadowRadius: 24, elevation: 16,
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#FF658418',
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  heading:  { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  body:     { fontSize: 14, lineHeight: 22, textAlign: 'center' },
  actions:  { flexDirection: 'row', gap: 12, marginTop: 8, width: '100%' },
  btn: {
    flex: 1, height: 50, borderRadius: 14,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
  },
  cancelBtn: { backgroundColor: '#F1F5F9' },
  deleteBtn: { backgroundColor: '#FF6584' },
  btnText:   { fontSize: 15, fontWeight: '700' },
});

// ─── Swipeable Transaction Row ────────────────────────────────────────────────

const ROW_HEIGHT      = 76;
const ACTION_WIDTH    = 140;
const DELETE_WIDTH    = 80;
const LEFT_THRESHOLD  = 80;
const RIGHT_THRESHOLD = 60;

function SwipeableTransactionRow({
  item, isDark, formatBase, toBase, onDelete,
}: {
  item: Transaction; isDark: boolean;
  formatBase: (n: number) => string;
  toBase: (n: number, c: SupportedCurrency) => number;
  onDelete: (id: number) => void;
}) {
  const isIncome   = item.type === 'income';
  const isTransfer = item.type === 'transfer';
  const catColor   = isTransfer ? '#6C63FF' : (item.category?.color ?? '#6C63FF');
  const catIcon    = isTransfer
    ? ('swap-horizontal-outline' as React.ComponentProps<typeof Ionicons>['name'])
    : ((item.category?.icon ?? 'pricetag-outline') as React.ComponentProps<typeof Ionicons>['name']);
  const walletCurrency  = (item.wallet?.currency ?? 'BDT') as SupportedCurrency;
  const convertedAmount = toBase(item.amount, walletCurrency);

  const translateX  = useRef(new Animated.Value(0)).current;
  const [showDelete, setShowDelete] = useState(false);

  const cardBg        = isDark ? '#1E1E2E' : '#FFFFFF';
  const textPrimary   = isDark ? '#F1F5F9' : '#1E293B';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';

  function snapBack() {
    Animated.spring(translateX, {
      toValue: 0, useNativeDriver: true, tension: 120, friction: 10,
    }).start();
  }

  function handleGestureEvent({ nativeEvent }: { nativeEvent: { translationX: number } }) {
    const tx = nativeEvent.translationX;
    const clamped = Math.max(-(ACTION_WIDTH + 10), Math.min(DELETE_WIDTH + 10, tx));
    translateX.setValue(clamped);
  }

  function handleStateChange({ nativeEvent }: { nativeEvent: { state: number; translationX: number } }) {
    if (nativeEvent.state !== State.END && nativeEvent.state !== State.CANCELLED) return;
    const tx = nativeEvent.translationX;
    if (tx > LEFT_THRESHOLD) {
      Animated.spring(translateX, {
        toValue: DELETE_WIDTH, useNativeDriver: true, tension: 120, friction: 10,
      }).start(() => setShowDelete(true));
    } else if (tx < -RIGHT_THRESHOLD) {
      Animated.spring(translateX, {
        toValue: -ACTION_WIDTH, useNativeDriver: true, tension: 120, friction: 10,
      }).start();
    } else {
      snapBack();
    }
  }

  function handleConfirmDelete() {
    setShowDelete(false);
    Animated.timing(translateX, {
      toValue: 400, duration: 240, useNativeDriver: true,
    }).start(() => onDelete(item.id));
  }

  const deleteOpacity = translateX.interpolate({
    inputRange: [0, DELETE_WIDTH], outputRange: [0, 1], extrapolate: 'clamp',
  });
  const actionOpacity = translateX.interpolate({
    inputRange: [-ACTION_WIDTH, 0], outputRange: [1, 0], extrapolate: 'clamp',
  });

  return (
    <>
      <DeleteConfirmModal
        visible={showDelete} title={item.title}
        walletName={item.wallet?.name ?? 'wallet'}
        isDark={isDark}
        onCancel={() => { setShowDelete(false); snapBack(); }}
        onConfirm={handleConfirmDelete}
      />
      <View style={[swipeStyles.container, { height: ROW_HEIGHT }]}>
        {/* Delete zone */}
        <Animated.View style={[swipeStyles.deleteBg, { opacity: deleteOpacity, width: DELETE_WIDTH }]}>
          <Ionicons name="trash" size={22} color="#FF6584" />
        </Animated.View>

        {/* Action buttons */}
        <Animated.View style={[swipeStyles.actionBg, { opacity: actionOpacity, width: ACTION_WIDTH }]}>
          <TouchableOpacity
            style={[swipeStyles.actionBtn, { backgroundColor: '#6C63FF' }]}
            onPress={() => { snapBack(); router.push({ pathname: '/transaction-detail', params: { id: String(item.id), mode: 'view' } }); }}>
            <Ionicons name="eye-outline" size={19} color="#FFF" />
            <Text style={swipeStyles.actionLabel}>View</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[swipeStyles.actionBtn, { backgroundColor: '#43C59E' }]}
            onPress={() => { snapBack(); router.push({ pathname: '/transaction-detail', params: { id: String(item.id), mode: 'edit' } }); }}>
            <Ionicons name="pencil" size={19} color="#FFF" />
            <Text style={swipeStyles.actionLabel}>Edit</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Main card */}
        <PanGestureHandler
          onGestureEvent={handleGestureEvent}
          onHandlerStateChange={handleStateChange}
          activeOffsetX={[-10, 10]}
          failOffsetY={[-20, 20]}>
          <Animated.View style={[swipeStyles.card, { backgroundColor: cardBg, transform: [{ translateX }] }]}>
            <View style={[swipeStyles.txIcon, { backgroundColor: catColor + '22' }]}>
              <Ionicons name={catIcon} size={20} color={catColor} />
            </View>
            <View style={swipeStyles.txMeta}>
              <Text style={[swipeStyles.txTitle, { color: textPrimary }]} numberOfLines={1}>{item.title}</Text>
              <Text style={[swipeStyles.txSub, { color: textSecondary }]} numberOfLines={1}>
                {item.category?.name ?? 'Uncategorized'}
                {item.wallet?.name ? `  ·  ${item.wallet.name}` : ''}
              </Text>
              <Text style={[swipeStyles.txDate, { color: textSecondary }]}>
                {humanDate(item.transaction_date)}
              </Text>
            </View>
            <Text style={[swipeStyles.txAmount, {
              color: isTransfer ? '#6C63FF' : (isIncome ? '#43C59E' : '#FF6584'),
            }]}>
              {isTransfer ? '⇄ ' : (isIncome ? '+' : '-')}{formatBase(convertedAmount)}
            </Text>
          </Animated.View>
        </PanGestureHandler>
      </View>
    </>
  );
}

const swipeStyles = StyleSheet.create({
  container: { borderRadius: 16, overflow: 'hidden', position: 'relative' },
  deleteBg: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    backgroundColor: '#FF658415',
    alignItems: 'center', justifyContent: 'center',
    paddingLeft: 20, borderRadius: 16,
  },
  actionBg: {
    position: 'absolute', right: 0, top: 0, bottom: 0,
    flexDirection: 'row', borderRadius: 16, overflow: 'hidden',
  },
  actionBtn:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  actionLabel: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  card: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, gap: 12, borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  txIcon:   { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  txMeta:   { flex: 1 },
  txTitle:  { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  txSub:    { fontSize: 12, marginBottom: 1 },
  txDate:   { fontSize: 11 },
  txAmount: { fontSize: 15, fontWeight: '700' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark      = colorScheme === 'dark';
  const { toBase, formatBase, baseCurrency } = useCurrency();
  const { user } = useAuth();

  const [wallets, setWallets]         = useState<Wallet[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories]   = useState<Category[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [filter, setFilter]           = useState<FilterPeriod>('month');
  const [filterLoading, setFilterLoading] = useState(false);

  // All transactions cache — keyed by period so switching tabs is instant
  const txCache = useRef<Partial<Record<FilterPeriod, Transaction[]>>>({});

  const bg            = isDark ? '#0F0F1A' : '#F8F9FF';
  const cardBg        = isDark ? '#1E1E2E' : '#FFFFFF';
  const textPrimary   = isDark ? '#F1F5F9' : '#1E293B';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';

  // ── Load transactions for a given period ─────────────────────────────────────
  const loadTransactions = useCallback(async (period: FilterPeriod, forceRefresh = false) => {
    if (!forceRefresh && txCache.current[period]) {
      setAllTransactions(txCache.current[period]!);
      return;
    }
    setFilterLoading(true);
    try {
      const range = getDateRange(period, user?.created_at);
      const res = await transactionsApi.list(range);
      const data = res.data ?? [];
      txCache.current[period] = data;
      setAllTransactions(data);
    } catch {
      // silent
    } finally {
      setFilterLoading(false);
    }
  }, [user?.created_at]);

  // ── Initial load ─────────────────────────────────────────────────────────────
  const loadAll = useCallback(async (forceRefresh = false) => {
    try {
      const [walletsRes, catsRes] = await Promise.all([
        walletsApi.list(),
        categoriesApi.list(),
      ]);
      setWallets(walletsRes.data ?? []);
      setCategories(catsRes.data ?? []);

      // Clear cache on force refresh
      if (forceRefresh) txCache.current = {};
      await loadTransactions(filter, forceRefresh);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, loadTransactions]);

  useEffect(() => { loadAll(); }, []);

  // When filter changes, load that period (from cache if available)
  useEffect(() => {
    loadTransactions(filter);
  }, [filter, loadTransactions]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAll(true);
  }, [loadAll]);

  // ── Delete handler ────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (id: number) => {
    try {
      await transactionsApi.delete(id);
      // Remove from all cached periods
      Object.keys(txCache.current).forEach(k => {
        const key = k as FilterPeriod;
        txCache.current[key] = txCache.current[key]?.filter(t => t.id !== id);
      });
      setAllTransactions(prev => prev.filter(t => t.id !== id));
    } catch {
      // silent
    }
  }, []);

  // ── Computed values ───────────────────────────────────────────────────────────
  const totalBalance = wallets.reduce((sum, w) => {
    return sum + toBase(w.balance, (w.currency ?? 'BDT') as SupportedCurrency);
  }, 0);

  const income = useMemo(() =>
    allTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + toBase(t.amount, (t.wallet?.currency ?? 'BDT') as SupportedCurrency), 0),
    [allTransactions, toBase]);

  const expense = useMemo(() =>
    allTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + toBase(t.amount, (t.wallet?.currency ?? 'BDT') as SupportedCurrency), 0),
    [allTransactions, toBase]);

  const expenseByCategory = useMemo(() => {
    const map: Record<number, number> = {};
    allTransactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const c = toBase(t.amount, (t.wallet?.currency ?? 'BDT') as SupportedCurrency);
        map[t.category_id] = (map[t.category_id] ?? 0) + c;
      });
    return map;
  }, [allTransactions, toBase]);

  const breakdown: CategoryBreakdown[] = useMemo(() =>
    Object.entries(expenseByCategory)
      .map(([catId, total], i) => {
        const category = categories.find(c => c.id === Number(catId));
        return {
          category: category ?? {
            id: Number(catId), name: 'Other',
            type: 'expense' as const, icon: 'pricetag-outline',
            color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
          },
          total,
          percentage: expense > 0 ? (total / expense) * 100 : 0,
          count: allTransactions.filter(t => t.category_id === Number(catId) && t.type === 'expense').length,
        };
      })
      .sort((a, b) => b.total - a.total),
    [expenseByCategory, categories, expense, allTransactions]);

  const pieData: PieSlice[] = breakdown.map((b, i) => ({
    value: b.total,
    color: b.category.color || CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    label: b.category.name,
  }));

  const label = periodLabel(filter, user?.created_at);

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
              tintColor="#6C63FF" colors={['#6C63FF']} />
          }>

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.greeting, { color: textSecondary }]}>Good day 👋</Text>
              <Text style={[styles.headerTitle, { color: textPrimary }]}>My Overview</Text>
            </View>
            <TouchableOpacity style={[styles.notifBtn, { backgroundColor: cardBg }]} activeOpacity={0.7}>
              <Ionicons name="notifications-outline" size={22} color={textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Balance Card */}
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Total Balance ({baseCurrency})</Text>
            <Text style={styles.balanceAmount}>{formatBase(totalBalance)}</Text>
            <Text style={styles.balanceSub}>
              {wallets.length} wallet{wallets.length !== 1 ? 's' : ''}
              {wallets.some(w => (w.currency ?? 'BDT') !== baseCurrency) ? '  ·  auto-converted' : ''}
            </Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <View style={[styles.summaryIconWrap, { backgroundColor: 'rgba(67,197,158,0.2)' }]}>
                  <Ionicons name="arrow-down" size={16} color="#43C59E" />
                </View>
                <View>
                  <Text style={styles.summaryItemLabel}>Income</Text>
                  <Text style={[styles.summaryItemAmount, { color: '#43C59E' }]}>{formatBase(income)}</Text>
                </View>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <View style={[styles.summaryIconWrap, { backgroundColor: 'rgba(255,101,132,0.2)' }]}>
                  <Ionicons name="arrow-up" size={16} color="#FF6584" />
                </View>
                <View>
                  <Text style={styles.summaryItemLabel}>Expenses</Text>
                  <Text style={[styles.summaryItemAmount, { color: '#FF6584' }]}>{formatBase(expense)}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Filter Tabs */}
          <FilterTabs active={filter} isDark={isDark} onChange={setFilter} />

          {/* Period label */}
          <View style={styles.periodHeader}>
            <Text style={[styles.periodLabel, { color: textPrimary }]}>{label}</Text>
            {filterLoading && <ActivityIndicator size="small" color="#6C63FF" />}
          </View>

          {/* Summary Strip */}
          <SummaryStrip income={income} expense={expense} formatBase={formatBase} isDark={isDark} />

          {/* Expense Breakdown */}
          <View style={[styles.section, { backgroundColor: cardBg }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: textPrimary }]}>Expense Breakdown</Text>
              <Text style={[styles.sectionSub, { color: textSecondary }]}>{label}</Text>
            </View>

            {breakdown.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="pie-chart-outline" size={40} color={textSecondary} />
                <Text style={[styles.emptyText, { color: textSecondary }]}>No expenses for this period</Text>
              </View>
            ) : (
              <View style={styles.chartArea}>
                <View style={styles.pieWrap}>
                  <PieChart data={pieData} size={180} strokeWidth={30} />
                  <View style={styles.pieCenter} pointerEvents="none">
                    <Text style={[styles.pieCenterLabel, { color: textSecondary }]}>Total</Text>
                    <Text style={[styles.pieCenterAmount, { color: textPrimary }]}>{formatBase(expense)}</Text>
                  </View>
                </View>
                <View style={styles.legend}>
                  {breakdown.map((b, i) => (
                    <View key={b.category.id} style={styles.legendRow}>
                      <View style={[styles.legendDot, {
                        backgroundColor: b.category.color || CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                      }]} />
                      <Text style={[styles.legendName, { color: textPrimary }]} numberOfLines={1}>
                        {b.category.name}
                      </Text>
                      <View style={styles.legendRight}>
                        <Text style={[styles.legendAmount, { color: textPrimary }]}>{formatBase(b.total)}</Text>
                        <Text style={[styles.legendPct, { color: textSecondary }]}>{b.percentage.toFixed(1)}%</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Transactions */}
          <View style={styles.sectionHeader2}>
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>Transactions</Text>
            <Text style={[styles.sectionSub, { color: textSecondary }]}>{label}</Text>
          </View>

          {allTransactions.length === 0 ? (
            <View style={[styles.section, { backgroundColor: cardBg }]}>
              <View style={styles.emptyState}>
                <Ionicons name="receipt-outline" size={40} color={textSecondary} />
                <Text style={[styles.emptyText, { color: textSecondary }]}>No transactions for this period</Text>
              </View>
            </View>
          ) : (
            <View style={{ gap: 8, paddingBottom: 100 }}>
              {allTransactions.map(tx => (
                <SwipeableTransactionRow
                  key={tx.id} item={tx} isDark={isDark}
                  formatBase={formatBase} toBase={toBase}
                  onDelete={handleDelete}
                />
              ))}
            </View>
          )}
        </ScrollView>

        {/* FAB */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/add-transaction')}
          activeOpacity={0.85}>
          <Ionicons name="add" size={30} color="#FFF" />
        </TouchableOpacity>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll:    { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting:    { fontSize: 13, marginBottom: 2 },
  headerTitle: { fontSize: 22, fontWeight: '700' },
  notifBtn: {
    width: 42, height: 42, borderRadius: 21,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },

  balanceCard: {
    borderRadius: 24, padding: 24, marginBottom: 20, backgroundColor: '#6C63FF',
    shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
  },
  balanceLabel:  { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginBottom: 4 },
  balanceAmount: { color: '#FFF', fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  balanceSub:    { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2, marginBottom: 20 },
  summaryRow: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16, padding: 16,
  },
  summaryItem:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryDivider:   { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  summaryIconWrap:  { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  summaryItemLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginBottom: 2 },
  summaryItemAmount:{ fontSize: 14, fontWeight: '700' },

  // Period header
  periodHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16,
  },
  periodLabel: { fontSize: 16, fontWeight: '700' },

  section: {
    borderRadius: 20, padding: 20, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  sectionHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sectionHeader2: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle:   { fontSize: 17, fontWeight: '700' },
  sectionSub:     { fontSize: 12 },

  chartArea: { alignItems: 'center' },
  pieWrap:   { position: 'relative', marginBottom: 24 },
  pieCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  pieCenterLabel:  { fontSize: 11, marginBottom: 2 },
  pieCenterAmount: { fontSize: 15, fontWeight: '700' },

  legend:       { width: '100%', gap: 12 },
  legendRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  legendDot:    { width: 10, height: 10, borderRadius: 5 },
  legendName:   { flex: 1, fontSize: 14, fontWeight: '500' },
  legendRight:  { alignItems: 'flex-end' },
  legendAmount: { fontSize: 14, fontWeight: '600' },
  legendPct:    { fontSize: 11 },

  emptyState: { alignItems: 'center', paddingVertical: 28, gap: 10 },
  emptyText:  { fontSize: 14 },

  fab: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 104 : 80,
    right: 24, width: 58, height: 58, borderRadius: 29,
    backgroundColor: '#6C63FF', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45, shadowRadius: 12, elevation: 10,
  },
});
