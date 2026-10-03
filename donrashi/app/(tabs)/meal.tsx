import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { mealBooksApi } from '@/services/mealApi';
import { MealBook } from '@/types';

function MealBookCard({ item, isDark, onPress }: {
  item: MealBook; isDark: boolean; onPress: () => void;
}) {
  const textPrimary   = isDark ? '#F1F5F9' : '#1E293B';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const cardBg        = isDark ? '#1E1E2E' : '#FFFFFF';

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.card, { backgroundColor: cardBg }]}
      activeOpacity={0.8}>
      <View style={[styles.cardIcon, { backgroundColor: '#6C63FF22' }]}>
        <Ionicons name="restaurant-outline" size={24} color="#6C63FF" />
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardName, { color: textPrimary }]}>{item.name}</Text>
        <Text style={[styles.cardSub, { color: textSecondary }]}>
          {item.member_count ?? 0} member{(item.member_count ?? 0) !== 1 ? 's' : ''}
          {'  ·  '}{item.currency}
          {item.status === 'archived' ? '  ·  Archived' : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={textSecondary} />
    </TouchableOpacity>
  );
}

export default function MealTab() {
  const colorScheme   = useColorScheme();
  const isDark        = colorScheme === 'dark';
  const bg            = isDark ? '#0F0F1A' : '#F8F9FF';
  const textPrimary   = isDark ? '#F1F5F9' : '#1E293B';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const cardBg        = isDark ? '#1E1E2E' : '#FFFFFF';

  const [books, setBooks]       = useState<MealBook[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await mealBooksApi.list();
      setBooks(Array.isArray(res) ? res : []);
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

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
        <View>
          <Text style={[styles.headerTitle, { color: textPrimary }]}>Mess</Text>
          <Text style={[styles.headerSub, { color: textSecondary }]}>Your meal books</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity
            onPress={() => router.push('/meal-accept-invite')}
            style={[styles.joinBtn]}>
            <Ionicons name="key-outline" size={18} color="#6C63FF" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/meal-book-create')}
            style={styles.addBtn}>
            <Ionicons name="add" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={books}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor="#6C63FF" colors={['#6C63FF']} />
        }
        ListEmptyComponent={
          <View style={[styles.empty, { backgroundColor: cardBg }]}>
            <Ionicons name="restaurant-outline" size={48} color={textSecondary} />
            <Text style={[styles.emptyTitle, { color: textPrimary }]}>No meal books yet</Text>
            <Text style={[styles.emptyText, { color: textSecondary }]}>
              Create one to manage your mess
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/meal-book-create')}
              style={styles.emptyBtn}>
              <Text style={styles.emptyBtnText}>Create Meal Book</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <MealBookCard
            item={item} isDark={isDark}
            onPress={() => router.push({ pathname: '/meal-book-detail', params: { id: String(item.id) } })}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  headerTitle: { fontSize: 28, fontWeight: '800' },
  headerSub:   { fontSize: 13, marginTop: 2 },
  addBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#6C63FF',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },
  joinBtn: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#6C63FF',
  },

  list: { paddingHorizontal: 20, paddingBottom: 100, gap: 12 },

  card: {
    flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 18, gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  cardBody: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  cardSub:  { fontSize: 12 },

  empty: { margin: 20, borderRadius: 20, padding: 32, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText:  { fontSize: 14 },
  emptyBtn: {
    marginTop: 8, backgroundColor: '#6C63FF',
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12,
  },
  emptyBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
});
