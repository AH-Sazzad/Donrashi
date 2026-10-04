/**
 * Manager Control Panel — entry point for all manager-only operations.
 * Shows 6 sections as tappable cards. Only visible to managers.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { mealBooksApi, mealRecordsApi, mealWalletApi } from '@/services/mealApi';
import { MealBookDashboard } from '@/types';

type Section = {
  id: string;
  label: string;
  desc: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  badge?: number;
  route: string;
};

export default function MealControlPanelScreen() {
  const { id }     = useLocalSearchParams<{ id: string }>();
  const mealBookId = Number(id);
  const isDark     = useColorScheme() === 'dark';

  const bg          = isDark ? '#0F0F1A' : '#F8F9FF';
  const cardBg      = isDark ? '#1E1E2E' : '#FFFFFF';
  const textPrimary = isDark ? '#F1F5F9' : '#1E293B';
  const textSec     = isDark ? '#94A3B8' : '#64748B';
  const borderColor = isDark ? '#2A2A3E' : '#F1F5F9';

  const [dash, setDash]           = useState<MealBookDashboard | null>(null);
  const [pendingMeals, setPendingMeals] = useState(0);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, meals] = await Promise.all([
        mealBooksApi.dashboard(mealBookId),
        mealRecordsApi.list(mealBookId, {}),
      ]);
      setDash(d);
      const pending = (Array.isArray(meals) ? meals : []).filter(m => m.status === 'pending').length;
      setPendingMeals(pending);
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [mealBookId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </SafeAreaView>
    );
  }

  const sections: Section[] = [
    {
      id: 'deposits',
      label: 'Deposits',
      desc: 'Record cash / bKash / bank payments from members into shared wallet',
      icon: 'wallet-outline',
      color: '#43C59E',
      badge: dash?.pending_deposits.length,
      route: '/meal-manager-deposits',
    },
    {
      id: 'bazar',
      label: 'Bazar Team',
      desc: `Next team: ${dash?.upcoming_bazar?.[0]?.team_members?.map(m => m.user?.name?.split(' ')[0]).join(' & ') ?? 'Not scheduled'}`,
      icon: 'cart-outline',
      color: '#6C63FF',
      route: '/meal-bazar',
    },
    {
      id: 'expenses',
      label: 'Expense List',
      desc: 'View and add bazar/utility purchases with team and amount',
      icon: 'receipt-outline',
      color: '#FF6584',
      route: '/meal-expenses',
    },
    {
      id: 'meals',
      label: 'Meal Calendar',
      desc: 'View all members meals, approve pending entries, edit past dates',
      icon: 'calendar-outline',
      color: '#4D96FF',
      badge: pendingMeals,
      route: '/meal-manager-meals',
    },
    {
      id: 'utilities',
      label: 'Utilities',
      desc: 'Rent, gas, electricity, WiFi — manage shared utility expenses',
      icon: 'bulb-outline',
      color: '#F59E0B',
      route: '/meal-utilities',
    },
    {
      id: 'report',
      label: 'Generate Report',
      desc: 'Monthly summary: meals per member, expenses, settlement preview',
      icon: 'bar-chart-outline',
      color: '#8B5CF6',
      route: '/meal-report',
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top', 'bottom']}>

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color={textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.headerTitle, { color: textPrimary }]}>Control Panel</Text>
          <Text style={[styles.headerSub, { color: textSec }]}>Manager access only</Text>
        </View>
        <View style={[styles.managerBadge]}>
          <Text style={styles.managerBadgeText}>👑 Manager</Text>
        </View>
      </View>

      {/* Shared wallet summary */}
      {dash && (
        <View style={[styles.walletStrip, { backgroundColor: '#6C63FF' }]}>
          <View style={styles.walletStripItem}>
            <Text style={styles.walletStripLabel}>Available</Text>
            <Text style={styles.walletStripValue}>
              ৳{Number(dash.wallet.available_balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={styles.walletStripDivider} />
          <View style={styles.walletStripItem}>
            <Text style={styles.walletStripLabel}>Pending</Text>
            <Text style={styles.walletStripValue}>
              ৳{Number(dash.wallet.pending_balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={styles.walletStripDivider} />
          <View style={styles.walletStripItem}>
            <Text style={styles.walletStripLabel}>Meal Rate</Text>
            <Text style={styles.walletStripValue}>
              {dash.meal_rate ? `৳${Number(dash.meal_rate).toFixed(2)}` : '—'}
            </Text>
          </View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor="#6C63FF" colors={['#6C63FF']} />
        }>

        {sections.map(s => (
          <TouchableOpacity
            key={s.id}
            onPress={() => router.push({ pathname: s.route as any, params: { id: String(mealBookId) } })}
            style={[styles.sectionCard, { backgroundColor: cardBg }]}
            activeOpacity={0.75}>

            {/* Icon */}
            <View style={[styles.sectionIcon, { backgroundColor: s.color + '18' }]}>
              <Ionicons name={s.icon} size={24} color={s.color} />
            </View>

            {/* Text */}
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionLabel, { color: textPrimary }]}>{s.label}</Text>
              <Text style={[styles.sectionDesc, { color: textSec }]} numberOfLines={2}>{s.desc}</Text>
            </View>

            {/* Badge */}
            {s.badge ? (
              <View style={[styles.badge, { backgroundColor: s.color }]}>
                <Text style={styles.badgeText}>{s.badge}</Text>
              </View>
            ) : (
              <Ionicons name="chevron-forward" size={18} color={textSec} />
            )}
          </TouchableOpacity>
        ))}
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
  headerSub:   { fontSize: 12, marginTop: 1 },
  managerBadge: {
    backgroundColor: '#6C63FF22', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
  },
  managerBadgeText: { color: '#6C63FF', fontSize: 12, fontWeight: '700' },

  walletStrip: {
    flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 20,
  },
  walletStripItem:    { flex: 1, alignItems: 'center' },
  walletStripLabel:   { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginBottom: 2 },
  walletStripValue:   { color: '#FFF', fontSize: 14, fontWeight: '700' },
  walletStripDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 8 },

  scroll: { padding: 16, gap: 12, paddingBottom: 40 },

  sectionCard: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderRadius: 18, gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  sectionIcon:  { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  sectionLabel: { fontSize: 15, fontWeight: '700', marginBottom: 3 },
  sectionDesc:  { fontSize: 12, lineHeight: 17 },

  badge:     { minWidth: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
});
