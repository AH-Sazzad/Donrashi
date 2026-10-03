import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, RefreshControl,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { activityLogApi } from '@/services/mealApi';
import { MealBookActivityLog } from '@/types';

// Map event prefixes to icons and colors
function eventMeta(event: string): { icon: React.ComponentProps<typeof Ionicons>['name']; color: string } {
  if (event.startsWith('deposit'))      return { icon: 'wallet-outline',     color: '#43C59E' };
  if (event.startsWith('expense'))      return { icon: 'receipt-outline',     color: '#FF6584' };
  if (event.startsWith('meal'))         return { icon: 'restaurant-outline',  color: '#6C63FF' };
  if (event.startsWith('member'))       return { icon: 'people-outline',      color: '#4D96FF' };
  if (event.startsWith('bazar'))        return { icon: 'cart-outline',        color: '#F59E0B' };
  if (event.startsWith('settlement'))   return { icon: 'calculator-outline',  color: '#8B5CF6' };
  if (event.startsWith('manager'))      return { icon: 'swap-horizontal-outline', color: '#EC4899' };
  if (event.startsWith('invitation'))   return { icon: 'mail-outline',        color: '#06B6D4' };
  if (event.startsWith('meal_book'))    return { icon: 'book-outline',        color: '#6C63FF' };
  return { icon: 'ellipse-outline', color: '#94A3B8' };
}

function humanTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800)return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MealActivityScreen() {
  const { id }     = useLocalSearchParams<{ id: string }>();
  const mealBookId = Number(id);
  const isDark     = useColorScheme() === 'dark';

  const bg          = isDark ? '#0F0F1A' : '#F8F9FF';
  const cardBg      = isDark ? '#1E1E2E' : '#FFFFFF';
  const textPrimary = isDark ? '#F1F5F9' : '#1E293B';
  const textSec     = isDark ? '#94A3B8' : '#64748B';
  const borderColor = isDark ? '#2A2A3E' : '#E2E8F0';

  const [logs, setLogs]             = useState<MealBookActivityLog[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage]             = useState(1);
  const [hasMore, setHasMore]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (reset = false) => {
    try {
      const res = await activityLogApi.list(mealBookId);
      const data = res.data ?? [];
      setLogs(data);
      setHasMore(false); // paginate when API supports it
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); setLoadingMore(false); }
  }, [mealBookId]);

  useEffect(() => { load(true); }, [load]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color={textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textPrimary }]}>Activity Log</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor="#6C63FF" colors={['#6C63FF']} />
          }
          ListEmptyComponent={
            <View style={[styles.emptyCard, { backgroundColor: cardBg }]}>
              <Ionicons name="time-outline" size={48} color={textSec} />
              <Text style={[styles.emptyTitle, { color: textPrimary }]}>No activity yet</Text>
              <Text style={[{ color: textSec, fontSize: 13 }]}>
                Actions by members will appear here
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const { icon, color } = eventMeta(item.event);
            return (
              <View style={[styles.logCard, { backgroundColor: cardBg }]}>
                <View style={[styles.logIcon, { backgroundColor: color + '20' }]}>
                  <Ionicons name={icon} size={18} color={color} />
                </View>
                <View style={styles.logBody}>
                  <Text style={[styles.logDesc, { color: textPrimary }]} numberOfLines={2}>
                    {item.description}
                  </Text>
                  <View style={styles.logMeta}>
                    <Text style={[styles.logActor, { color: color }]}>
                      {item.actor?.name ?? `#${item.actor_id}`}
                    </Text>
                    <Text style={[styles.logTime, { color: textSec }]}>
                      {humanTime(item.created_at)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
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
  headerTitle: { fontSize: 17, fontWeight: '700', marginLeft: 12 },

  list: { padding: 16, gap: 10, paddingBottom: 60 },

  emptyCard: {
    borderRadius: 20, padding: 40, alignItems: 'center', gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700' },

  logCard: {
    flexDirection: 'row', alignItems: 'flex-start', padding: 14,
    borderRadius: 16, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  logIcon: {
    width: 38, height: 38, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    marginTop: 2,
  },
  logBody:  { flex: 1 },
  logDesc:  { fontSize: 14, fontWeight: '500', lineHeight: 20, marginBottom: 6 },
  logMeta:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logActor: { fontSize: 12, fontWeight: '700' },
  logTime:  { fontSize: 11 },
});
