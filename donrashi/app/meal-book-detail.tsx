import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { mealBooksApi, mealRecordsApi, mealTypesApi } from '@/services/mealApi';
import { MealBook, MealBookDashboard, MealType } from '@/types';

function StatCard({ label, value, icon, color, isDark, onPress }: {
  label: string; value: string; icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string; isDark: boolean; onPress?: () => void;
}) {
  const cardBg      = isDark ? '#1E1E2E' : '#FFFFFF';
  const textPrimary = isDark ? '#F1F5F9' : '#1E293B';
  const textSec     = isDark ? '#94A3B8' : '#64748B';
  return (
    <TouchableOpacity
      style={[styles.statCard, { backgroundColor: cardBg }]}
      onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.statValue, { color: textPrimary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: textSec }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function QuickMealButtons({ mealBookId, types, userId, isDark, onRecorded }: {
  mealBookId: number; types: MealType[]; userId: number;
  isDark: boolean; onRecorded: () => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const [loading, setLoading] = useState<number | null>(null);

  async function toggle(type: MealType) {
    setLoading(type.id);
    try {
      await mealRecordsApi.record(mealBookId, {
        meal_type_id: type.id,
        date: today,
        quantity: 1,
      });
      onRecorded();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to record meal.');
    } finally {
      setLoading(null);
    }
  }

  const textSec = isDark ? '#94A3B8' : '#64748B';

  return (
    <View style={styles.quickMealRow}>
      {types.filter(t => t.is_active && !t.is_special).map(t => (
        <TouchableOpacity
          key={t.id}
          onPress={() => toggle(t)}
          style={[styles.quickMealBtn, { borderColor: '#6C63FF' }]}
          activeOpacity={0.75}>
          {loading === t.id
            ? <ActivityIndicator size="small" color="#6C63FF" />
            : <>
                <Ionicons name="add-circle-outline" size={16} color="#6C63FF" />
                <Text style={[styles.quickMealText, { color: '#6C63FF' }]}>{t.name}</Text>
              </>
          }
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function MealBookDetailScreen() {
  const params    = useLocalSearchParams<{ id: string }>();
  const mealBookId = Number(params.id);
  const isDark    = useColorScheme() === 'dark';
  const { user }  = useAuth();

  const bg            = isDark ? '#0F0F1A' : '#F8F9FF';
  const cardBg        = isDark ? '#1E1E2E' : '#FFFFFF';
  const textPrimary   = isDark ? '#F1F5F9' : '#1E293B';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const borderColor   = isDark ? '#2A2A3E' : '#E2E8F0';

  const [book, setBook]           = useState<MealBook | null>(null);
  const [dash, setDash]           = useState<MealBookDashboard | null>(null);
  const [types, setTypes]         = useState<MealType[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [b, d, t] = await Promise.all([
        mealBooksApi.get(mealBookId),
        mealBooksApi.dashboard(mealBookId),
        mealTypesApi.list(mealBookId),
      ]);
      setBook(b); setDash(d); setTypes(t);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load.');
      router.back();
    } finally { setLoading(false); setRefreshing(false); }
  }, [mealBookId]);

  useEffect(() => { load(); }, [load]);

  if (loading || !book || !dash) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </SafeAreaView>
    );
  }

  const isManager = dash.my_role === 'manager';
  const sym = dash.meal_book.currency === 'BDT' ? '৳' : (dash.meal_book.currency === 'USD' ? '$' : '€');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color={textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.headerTitle, { color: textPrimary }]} numberOfLines={1}>{book.name}</Text>
          <Text style={[styles.headerSub, { color: textSecondary }]}>
            {dash.month_year}  ·  {isManager ? 'Manager' : 'Member'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/meal-activity', params: { id: String(mealBookId) } })}
          style={{ padding: 4 }}>
          <Ionicons name="time-outline" size={22} color={textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}
            tintColor="#6C63FF" colors={['#6C63FF']} />
        }>

        {/* Wallet card */}
        <View style={[styles.walletCard]}>
          <Text style={styles.walletLabel}>Shared Wallet</Text>
          <Text style={styles.walletBalance}>{sym}{Number(dash.wallet.available_balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
          <View style={styles.walletRow}>
            <Text style={styles.walletSub}>Pending: {sym}{Number(dash.wallet.pending_balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
            <Text style={styles.walletSub}>Expected: {sym}{Number(dash.wallet.expected_balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <StatCard label="My Meals" value={String(dash.my_meals)} icon="restaurant-outline" color="#6C63FF" isDark={isDark}
            onPress={() => router.push({ pathname: '/meal-calendar', params: { id: String(mealBookId) } })} />
          <StatCard label="Contribution" value={`${sym}${Number(dash.my_contribution).toLocaleString()}`} icon="wallet-outline" color="#43C59E" isDark={isDark}
            onPress={() => router.push({ pathname: '/meal-deposits', params: { id: String(mealBookId) } })} />
          <StatCard label="My Due" value={dash.my_due !== null ? `${sym}${Number(dash.my_due).toLocaleString()}` : '—'} icon="receipt-outline" color={dash.my_due !== null && Number(dash.my_due) < 0 ? '#43C59E' : '#FF6584'} isDark={isDark}
            onPress={() => router.push({ pathname: '/meal-settlement', params: { id: String(mealBookId) } })} />
          <StatCard label="Meal Rate" value={dash.meal_rate !== null ? `${sym}${Number(dash.meal_rate).toFixed(2)}` : '—'} icon="trending-up-outline" color="#F59E0B" isDark={isDark} />
        </View>

        {/* Quick meal record */}
        <View style={[styles.section, { backgroundColor: cardBg }]}>
          <Text style={[styles.sectionTitle, { color: textPrimary }]}>Record Today's Meal</Text>
          <Text style={[styles.sectionSub, { color: textSecondary }]}>Tap to add a meal for today</Text>
          <QuickMealButtons
            mealBookId={mealBookId} types={types}
            userId={user?.id ?? 0} isDark={isDark}
            onRecorded={load}
          />
        </View>

        {/* Upcoming bazar */}
        {dash.upcoming_bazar.length > 0 && (
          <View style={[styles.section, { backgroundColor: cardBg }]}>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: textPrimary }]}>Upcoming Bazar</Text>
              <TouchableOpacity onPress={() => router.push({ pathname: '/meal-bazar', params: { id: String(mealBookId) } })}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            {dash.upcoming_bazar.map(s => (
              <View key={s.id} style={[styles.bazarRow, { borderBottomColor: borderColor }]}>
                <Ionicons name="cart-outline" size={16} color="#6C63FF" />
                <Text style={[styles.bazarDate, { color: textSecondary }]}>
                  {new Date(s.date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
                </Text>
                <Text style={[styles.bazarTeam, { color: textPrimary }]}>
                  {s.team_members?.map(m => m.user?.name?.split(' ')[0]).join(', ')}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Recent expenses */}
        {dash.recent_expenses.length > 0 && (
          <View style={[styles.section, { backgroundColor: cardBg }]}>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: textPrimary }]}>Recent Expenses</Text>
              <TouchableOpacity onPress={() => router.push({ pathname: '/meal-expenses', params: { id: String(mealBookId) } })}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            {dash.recent_expenses.map(e => (
              <View key={e.id} style={[styles.expRow, { borderBottomColor: borderColor }]}>
                <View style={[styles.expIcon, {
                  backgroundColor: e.category === 'food' ? '#43C59E22' : e.category === 'utilities' ? '#F59E0B22' : '#6C63FF22',
                }]}>
                  <Ionicons
                    name={e.category === 'food' ? 'fast-food-outline' : e.category === 'utilities' ? 'bulb-outline' : 'cube-outline'}
                    size={16}
                    color={e.category === 'food' ? '#43C59E' : e.category === 'utilities' ? '#F59E0B' : '#6C63FF'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.expName, { color: textPrimary }]}>{e.sub_category ?? e.category}</Text>
                  <Text style={[styles.expDate, { color: textSecondary }]}>{e.expense_date}</Text>
                </View>
                <Text style={[styles.expAmount, { color: '#FF6584' }]}>-{sym}{Number(e.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Pending deposits (manager only) */}
        {isManager && dash.pending_deposits.length > 0 && (
          <View style={[styles.section, { backgroundColor: cardBg }]}>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: textPrimary }]}>Pending Deposits</Text>
              <View style={[styles.badge, { backgroundColor: '#FF658422' }]}>
                <Text style={{ color: '#FF6584', fontWeight: '700', fontSize: 11 }}>{dash.pending_deposits.length}</Text>
              </View>
              <TouchableOpacity onPress={() => router.push({ pathname: '/meal-deposits', params: { id: String(mealBookId) } })}>
                <Text style={styles.seeAll}>Manage</Text>
              </TouchableOpacity>
            </View>
            {dash.pending_deposits.slice(0, 3).map(d => (
              <View key={d.id} style={[styles.expRow, { borderBottomColor: borderColor }]}>
                <Ionicons name="time-outline" size={16} color="#F59E0B" />
                <Text style={[{ flex: 1, fontSize: 13, color: textPrimary }]}>{d.member?.name}</Text>
                <Text style={[{ fontSize: 13, fontWeight: '700', color: '#43C59E' }]}>+{sym}{Number(d.amount).toLocaleString()}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerSub:   { fontSize: 12, marginTop: 2 },

  scroll: { padding: 20, gap: 16, paddingBottom: 80 },

  walletCard: {
    borderRadius: 24, padding: 24, backgroundColor: '#6C63FF',
    shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  walletLabel:   { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginBottom: 4 },
  walletBalance: { color: '#FFF', fontSize: 34, fontWeight: '800', letterSpacing: -1, marginBottom: 10 },
  walletRow:     { flexDirection: 'row', justifyContent: 'space-between' },
  walletSub:     { color: 'rgba(255,255,255,0.7)', fontSize: 12 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    width: '47%', borderRadius: 16, padding: 14, alignItems: 'center', gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  statIcon:  { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 11, textAlign: 'center' },

  section: {
    borderRadius: 20, padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  sectionRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  sectionSub:   { fontSize: 12, marginBottom: 12 },
  seeAll:       { fontSize: 12, color: '#6C63FF', fontWeight: '700' },

  quickMealRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  quickMealBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5,
  },
  quickMealText: { fontSize: 13, fontWeight: '700' },

  bazarRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1,
  },
  bazarDate: { fontSize: 12, width: 90 },
  bazarTeam: { flex: 1, fontSize: 13, fontWeight: '600' },

  expRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1,
  },
  expIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  expName: { fontSize: 13, fontWeight: '600' },
  expDate: { fontSize: 11, marginTop: 2 },
  expAmount: { fontSize: 13, fontWeight: '700' },

  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
});
