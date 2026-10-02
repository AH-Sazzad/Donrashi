import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
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
import { SupportedCurrency, useCurrency } from '@/context/CurrencyContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { categoriesApi, transactionsApi, walletsApi } from '@/services/api';
import { Category, CategoryBreakdown, Transaction, Wallet } from '@/types';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const CATEGORY_COLORS = [
  '#6C63FF', '#FF6584', '#43C59E', '#F7C59F', '#4ECDC4',
  '#FF6B6B', '#A8E6CF', '#FFD93D', '#6BCB77', '#4D96FF',
];

function getMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

// ─── Human-readable date ─────────────────────────────────────────────────────

function humanDate(rawDate: string): string {
  if (!rawDate) return '';
  // Strip time portion — treat as local date to avoid UTC shift
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

// ─── Swipeable Transaction Row ────────────────────────────────────────────────

const SWIPE_THRESHOLD   = 60;   // px to trigger action reveal
const DELETE_THRESHOLD  = 120;  // px to trigger delete zone

function SwipeableTransactionRow({
  item, isDark, formatBase, toBase, onDelete,
}: {
  item: Transaction;
  isDark: boolean;
  formatBase: (n: number) => string;
  toBase: (n: number, c: SupportedCurrency) => number;
  onDelete: (id: number) => void;
}) {
  const isIncome = item.type === 'income';
  const catColor = item.category?.color ?? '#6C63FF';
  const catIcon  = (item.category?.icon ?? 'pricetag-outline') as React.ComponentProps<typeof Ionicons>['name'];
  const walletCurrency   = (item.wallet?.currency ?? 'BDT') as SupportedCurrency;
  const convertedAmount  = toBase(item.amount, walletCurrency);

  const translateX   = useRef(new Animated.Value(0)).current;
  const rowBg        = useRef(new Animated.Value(0)).current;
  const [swiping, setSwiping] = useState(false);

  const cardBg    = isDark ? '#1E1E2E' : '#FFFFFF';
  const textPrimary   = isDark ? '#F1F5F9' : '#1E293B';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';

  function snapBack() {
    Animated.spring(translateX, {
      toValue: 0, useNativeDriver: true, bounciness: 6,
    }).start(() => setSwiping(false));
  }

  function handleGestureEvent({ nativeEvent }: { nativeEvent: { translationX: number } }) {
    const tx = nativeEvent.translationX;
    // Left swipe (negative) → show actions; clamp at -160
    // Right swipe (positive) → show delete; clamp at +DELETE_THRESHOLD+20
    const clamped = Math.max(-160, Math.min(DELETE_THRESHOLD + 20, tx));
    translateX.setValue(clamped);

    // Tint background red as user drags right toward delete
    if (tx > 0) {
      const progress = Math.min(1, tx / DELETE_THRESHOLD);
      rowBg.setValue(progress);
    } else {
      rowBg.setValue(0);
    }
  }

  function handleStateChange({ nativeEvent }: { nativeEvent: { state: number; translationX: number } }) {
    if (nativeEvent.state !== State.END && nativeEvent.state !== State.CANCELLED) return;

    const tx = nativeEvent.translationX;

    if (tx > DELETE_THRESHOLD) {
      // Confirm delete
      Alert.alert(
        'Delete Transaction',
        `Delete "${item.title}"?\n\nThe full amount will be refunded back to ${item.wallet?.name ?? 'the wallet'}.`,
        [
          {
            text: 'Cancel', style: 'cancel',
            onPress: () => { rowBg.setValue(0); snapBack(); },
          },
          {
            text: 'Delete', style: 'destructive',
            onPress: () => {
              // Slide off screen then delete
              Animated.timing(translateX, {
                toValue: 400, duration: 220, useNativeDriver: true,
              }).start(() => onDelete(item.id));
            },
          },
        ]
      );
    } else if (tx < -SWIPE_THRESHOLD) {
      // Snap to reveal action buttons
      Animated.spring(translateX, {
        toValue: -140, useNativeDriver: true, bounciness: 4,
      }).start();
      setSwiping(true);
    } else {
      rowBg.setValue(0);
      snapBack();
    }
  }

  const deleteBgColor = rowBg.interpolate({
    inputRange:  [0, 1],
    outputRange: ['transparent', '#FF658430'],
  });

  return (
    <View style={styles.swipeContainer}>
      {/* Delete background (right swipe) */}
      <Animated.View style={[styles.deleteBg, { backgroundColor: deleteBgColor }]}>
        <Ionicons name="trash" size={22} color="#FF6584" />
        <Text style={styles.deleteBgText}>Delete</Text>
      </Animated.View>

      {/* Action buttons (left swipe) */}
      <View style={styles.actionBg}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#6C63FF' }]}
          onPress={() => {
            snapBack();
            router.push({ pathname: '/transaction-detail', params: { id: String(item.id), mode: 'view' } });
          }}>
          <Ionicons name="eye-outline" size={18} color="#FFF" />
          <Text style={styles.actionBtnText}>View</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#43C59E' }]}
          onPress={() => {
            snapBack();
            router.push({ pathname: '/transaction-detail', params: { id: String(item.id), mode: 'edit' } });
          }}>
          <Ionicons name="pencil" size={18} color="#FFF" />
          <Text style={styles.actionBtnText}>Edit</Text>
        </TouchableOpacity>
      </View>

      {/* Main card */}
      <PanGestureHandler
        onGestureEvent={handleGestureEvent}
        onHandlerStateChange={handleStateChange}
        activeOffsetX={[-10, 10]}
        failOffsetY={[-15, 15]}>
        <Animated.View
          style={[
            styles.txRow,
            { backgroundColor: cardBg, transform: [{ translateX }] },
          ]}>
          {/* Category icon */}
          <View style={[styles.txIcon, { backgroundColor: catColor + '22' }]}>
            <Ionicons name={catIcon} size={20} color={catColor} />
          </View>

          {/* Title + sub */}
          <View style={styles.txMeta}>
            <Text style={[styles.txTitle, { color: textPrimary }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.txSub, { color: textSecondary }]} numberOfLines={1}>
              {item.category?.name ?? 'Uncategorized'}
              {item.wallet?.name ? `  ·  ${item.wallet.name}` : ''}
            </Text>
            <Text style={[styles.txDate, { color: textSecondary }]}>
              {humanDate(item.transaction_date)}
            </Text>
          </View>

          {/* Amount */}
          <Text style={[styles.txAmount, { color: isIncome ? '#43C59E' : '#FF6584' }]}>
            {isIncome ? '+' : '-'}{formatBase(convertedAmount)}
          </Text>
        </Animated.View>
      </PanGestureHandler>

      {/* Tap to close swipe */}
      {swiping && (
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={snapBack} />
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { toBase, formatBase, baseCurrency } = useCurrency();

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const handleDelete = useCallback(async (id: number) => {
    try {
      await transactionsApi.delete(id);
      setTransactions(prev => prev.filter(t => t.id !== id));
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not delete transaction.');
    }
  }, []);
  const now = new Date();
  const monthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  const loadData = useCallback(async () => {
    try {
      const { from, to } = getMonthRange();
      const [walletsRes, txRes, catsRes] = await Promise.all([
        walletsApi.list(),
        transactionsApi.list({ from, to }),
        categoriesApi.list(),
      ]);
      setWallets(walletsRes.data ?? []);
      setTransactions(txRes.data ?? []);
      setCategories(catsRes.data ?? []);
    } catch {
      // silent — UI shows empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(() => { setRefreshing(true); loadData(); }, [loadData]);

  // Convert all wallet balances to base currency and sum
  const totalBalance = wallets.reduce((sum, w) => {
    const wCurrency = (w.currency ?? 'BDT') as SupportedCurrency;
    return sum + toBase(w.balance, wCurrency);
  }, 0);

  // Convert transaction amounts to base currency
  const monthIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + toBase(t.amount, (t.wallet?.currency ?? 'BDT') as SupportedCurrency), 0);

  const monthExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + toBase(t.amount, (t.wallet?.currency ?? 'BDT') as SupportedCurrency), 0);

  // Category breakdown in base currency
  const expenseByCategory: Record<number, number> = {};
  transactions
    .filter(t => t.type === 'expense')
    .forEach(t => {
      const converted = toBase(t.amount, (t.wallet?.currency ?? 'BDT') as SupportedCurrency);
      expenseByCategory[t.category_id] = (expenseByCategory[t.category_id] ?? 0) + converted;
    });

  const breakdown: CategoryBreakdown[] = Object.entries(expenseByCategory)
    .map(([catId, total], i) => {
      const category = categories.find(c => c.id === Number(catId));
      return {
        category: category ?? {
          id: Number(catId), name: 'Other',
          type: 'expense' as const, icon: 'pricetag-outline',
          color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
        },
        total,
        percentage: monthExpense > 0 ? (total / monthExpense) * 100 : 0,
        count: transactions.filter(t => t.category_id === Number(catId) && t.type === 'expense').length,
      };
    })
    .sort((a, b) => b.total - a.total);

  const pieData: PieSlice[] = breakdown.map((b, i) => ({
    value: b.total,
    color: b.category.color || CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    label: b.category.name,
  }));

  const bg = isDark ? '#0F0F1A' : '#F8F9FF';
  const cardBg = isDark ? '#1E1E2E' : '#FFFFFF';
  const textPrimary = isDark ? '#F1F5F9' : '#1E293B';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';

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

        {/* Total Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Balance ({baseCurrency})</Text>
          <Text style={styles.balanceAmount}>{formatBase(totalBalance)}</Text>
          <Text style={styles.balanceSub}>
            {wallets.length} wallet{wallets.length !== 1 ? 's' : ''}
            {wallets.some(w => (w.currency ?? 'BDT') !== baseCurrency)
              ? '  ·  auto-converted' : ''}
          </Text>

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <View style={[styles.summaryIconWrap, { backgroundColor: 'rgba(67,197,158,0.2)' }]}>
                <Ionicons name="arrow-down" size={16} color="#43C59E" />
              </View>
              <View>
                <Text style={styles.summaryItemLabel}>Income</Text>
                <Text style={[styles.summaryItemAmount, { color: '#43C59E' }]}>
                  {formatBase(monthIncome)}
                </Text>
              </View>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <View style={[styles.summaryIconWrap, { backgroundColor: 'rgba(255,101,132,0.2)' }]}>
                <Ionicons name="arrow-up" size={16} color="#FF6584" />
              </View>
              <View>
                <Text style={styles.summaryItemLabel}>Expenses</Text>
                <Text style={[styles.summaryItemAmount, { color: '#FF6584' }]}>
                  {formatBase(monthExpense)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Expense Breakdown */}
        <View style={[styles.section, { backgroundColor: cardBg }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>Expense Breakdown</Text>
            <Text style={[styles.sectionSub, { color: textSecondary }]}>{monthLabel}</Text>
          </View>

          {breakdown.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="pie-chart-outline" size={40} color={textSecondary} />
              <Text style={[styles.emptyText, { color: textSecondary }]}>No expenses this month</Text>
            </View>
          ) : (
            <View style={styles.chartArea}>
              <View style={styles.pieWrap}>
                <PieChart data={pieData} size={180} strokeWidth={30} />
                <View style={styles.pieCenter} pointerEvents="none">
                  <Text style={[styles.pieCenterLabel, { color: textSecondary }]}>Total</Text>
                  <Text style={[styles.pieCenterAmount, { color: textPrimary }]}>
                    {formatBase(monthExpense)}
                  </Text>
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
                      <Text style={[styles.legendAmount, { color: textPrimary }]}>
                        {formatBase(b.total)}
                      </Text>
                      <Text style={[styles.legendPct, { color: textSecondary }]}>
                        {b.percentage.toFixed(1)}%
                      </Text>
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
          <Text style={[styles.sectionSub, { color: textSecondary }]}>{monthLabel}</Text>
        </View>

        {transactions.length === 0 ? (
          <View style={[styles.section, { backgroundColor: cardBg }]}>
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={40} color={textSecondary} />
              <Text style={[styles.emptyText, { color: textSecondary }]}>No transactions this month</Text>
            </View>
          </View>
        ) : (
          <View style={{ gap: 8, paddingBottom: 100 }}>
            {transactions.map(tx => (
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting: { fontSize: 13, marginBottom: 2 },
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
  balanceLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginBottom: 4 },
  balanceAmount: { color: '#FFF', fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  balanceSub: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2, marginBottom: 20 },
  summaryRow: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16, padding: 16,
  },
  summaryItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  summaryIconWrap: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  summaryItemLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginBottom: 2 },
  summaryItemAmount: { fontSize: 14, fontWeight: '700' },

  section: {
    borderRadius: 20, padding: 20, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sectionHeader2: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  sectionSub: { fontSize: 12 },

  chartArea: { alignItems: 'center' },
  pieWrap: { position: 'relative', marginBottom: 24 },
  pieCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  pieCenterLabel: { fontSize: 11, marginBottom: 2 },
  pieCenterAmount: { fontSize: 15, fontWeight: '700' },

  legend: { width: '100%', gap: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendName: { flex: 1, fontSize: 14, fontWeight: '500' },
  legendRight: { alignItems: 'flex-end' },
  legendAmount: { fontSize: 14, fontWeight: '600' },
  legendPct: { fontSize: 11 },

  emptyState: { alignItems: 'center', paddingVertical: 28, gap: 10 },
  emptyText: { fontSize: 14 },

  txRow: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderRadius: 16, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  txIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  txMeta: { flex: 1 },
  txTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  txSub: { fontSize: 12, marginBottom: 2 },
  txDate: { fontSize: 11 },
  txAmount: { fontSize: 15, fontWeight: '700' },

  // Swipe container
  swipeContainer: { position: 'relative', borderRadius: 16, overflow: 'hidden' },

  // Delete background (right swipe)
  deleteBg: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row', alignItems: 'center',
    paddingLeft: 20, gap: 8, borderRadius: 16,
  },
  deleteBgText: { color: '#FF6584', fontWeight: '700', fontSize: 14 },

  // Action buttons (left swipe) — positioned on the right
  actionBg: {
    position: 'absolute', right: 0, top: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'stretch',
    borderTopRightRadius: 16, borderBottomRightRadius: 16, overflow: 'hidden',
  },
  actionBtn: {
    width: 70, alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  actionBtnText: { color: '#FFF', fontSize: 11, fontWeight: '700' },

  fab: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 104 : 80,
    right: 24, width: 58, height: 58, borderRadius: 29,
    backgroundColor: '#6C63FF', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45, shadowRadius: 12, elevation: 10,
  },
});
