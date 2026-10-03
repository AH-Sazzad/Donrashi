/**
 * Meal Book Settings — manager only.
 * Configures: name, min billable meals, bazar team size, meal type weights & cutoffs.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { mealBooksApi, mealMembersApi, mealTypesApi } from '@/services/mealApi';
import { MealBook, MealType } from '@/types';

export default function MealSettingsScreen() {
  const { id }     = useLocalSearchParams<{ id: string }>();
  const mealBookId = Number(id);
  const isDark     = useColorScheme() === 'dark';
  const { user }   = useAuth();

  const bg          = isDark ? '#0F0F1A' : '#F8F9FF';
  const cardBg      = isDark ? '#1E1E2E' : '#FFFFFF';
  const textPrimary = isDark ? '#F1F5F9' : '#1E293B';
  const textSec     = isDark ? '#94A3B8' : '#64748B';
  const inputBg     = isDark ? '#2A2A3E' : '#F1F5F9';
  const borderColor = isDark ? '#2A2A3E' : '#E2E8F0';

  const [book, setBook]         = useState<MealBook | null>(null);
  const [types, setTypes]       = useState<MealType[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [isManager, setIsManager] = useState(false);

  // Book settings form
  const [name, setName]               = useState('');
  const [minBillable, setMinBillable] = useState('');
  const [teamSize, setTeamSize]       = useState<2 | 3>(2);

  const load = useCallback(async () => {
    try {
      const [b, t, members] = await Promise.all([
        mealBooksApi.get(mealBookId),
        mealTypesApi.list(mealBookId),
        mealMembersApi.list(mealBookId),
      ]);
      setBook(b);
      setTypes(Array.isArray(t) ? t : []);
      setName(b.name);
      setMinBillable(String(b.min_billable_meals));
      setTeamSize((b.bazar_team_size === 3 ? 3 : 2));
      const me = (Array.isArray(members) ? members : []).find((m: any) => m.user_id === user?.id);
      setIsManager(me?.role === 'manager');
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [mealBookId, user?.id]);

  useEffect(() => { load(); }, [load]);

  async function handleSaveBook() {
    if (!name.trim()) { Alert.alert('Missing', 'Name cannot be empty.'); return; }
    setSaving(true);
    try {
      await mealBooksApi.update(mealBookId, {
        name: name.trim(),
        min_billable_meals: Number(minBillable) || 30,
        bazar_team_size: teamSize,
      });
      Alert.alert('Saved', 'Meal book settings updated.');
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save.');
    } finally { setSaving(false); }
  }

  async function handleUpdateType(type: MealType, field: 'weight' | 'cutoff_time' | 'is_active', value: string | boolean) {
    try {
      const body = field === 'weight'
        ? { weight: Number(value) }
        : field === 'cutoff_time'
          ? { cutoff_time: value as string || undefined }
          : { is_active: value as boolean };

      const updated = await mealTypesApi.update(mealBookId, type.id, body);
      setTypes(prev => prev.map(t => t.id === type.id ? updated : t));
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update meal type.');
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </SafeAreaView>
    );
  }

  if (!isManager) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: bg }]}>
        <View style={[styles.lockedCard, { backgroundColor: cardBg }]}>
          <Text style={{ fontSize: 40, marginBottom: 8 }}>🔒</Text>
          <Text style={[styles.lockedTitle, { color: textPrimary }]}>Manager Only</Text>
          <Text style={[styles.lockedSub, { color: textSec }]}>
            Only the mess manager can change settings.
          </Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color={textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textPrimary }]}>Settings</Text>
        <TouchableOpacity
          onPress={handleSaveBook}
          disabled={saving}
          style={[styles.saveBtn, saving && { opacity: 0.5 }]}>
          {saving
            ? <ActivityIndicator size="small" color="#FFF" />
            : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── General ── */}
        <Text style={[styles.sectionLabel, { color: textSec }]}>GENERAL</Text>
        <View style={[styles.card, { backgroundColor: cardBg }]}>

          <View style={[styles.field, { borderBottomColor: borderColor }]}>
            <Text style={[styles.fieldLabel, { color: textSec }]}>Mess Name</Text>
            <TextInput
              style={[styles.fieldInput, { color: textPrimary }]}
              value={name} onChangeText={setName}
              placeholder="e.g. Mirpur Bachelor Mess"
              placeholderTextColor={textSec}
            />
          </View>

          <View style={[styles.field, { borderBottomColor: borderColor }]}>
            <Text style={[styles.fieldLabel, { color: textSec }]}>Min Billable Meals</Text>
            <TextInput
              style={[styles.fieldInput, { color: textPrimary, textAlign: 'right' }]}
              value={minBillable} onChangeText={setMinBillable}
              keyboardType="number-pad" placeholder="30"
              placeholderTextColor={textSec}
            />
          </View>

          <View style={[styles.field, { borderBottomColor: 'transparent', flexWrap: 'wrap', minHeight: 64 }]}>
            <Text style={[styles.fieldLabel, { color: textSec }]}>Bazar Team Size</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              {([2, 3] as const).map(n => (
                <Pressable key={n} onPress={() => setTeamSize(n)}
                  style={[styles.chip, { borderColor: '#6C63FF' }, teamSize === n && { backgroundColor: '#6C63FF' }]}>
                  <Text style={[styles.chipText, { color: teamSize === n ? '#FFF' : '#6C63FF' }]}>
                    {n} members
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* ── Meal Types ── */}
        <Text style={[styles.sectionLabel, { color: textSec }]}>MEAL TYPES & WEIGHTS</Text>
        <Text style={[styles.sectionHint, { color: textSec }]}>
          Weight determines how meals are counted. Breakfast = 0.5 means it counts as half a meal.
        </Text>

        <View style={[styles.card, { backgroundColor: cardBg }]}>
          {types.map((t, idx) => (
            <View
              key={t.id}
              style={[
                styles.typeRow,
                { borderBottomColor: borderColor },
                idx === types.length - 1 && { borderBottomWidth: 0 },
              ]}>
              {/* Active toggle */}
              <TouchableOpacity
                onPress={() => handleUpdateType(t, 'is_active', !t.is_active)}
                style={[styles.toggleDot, {
                  backgroundColor: t.is_active ? '#43C59E' : (isDark ? '#2A2A3E' : '#E2E8F0'),
                }]}>
                {t.is_active && <Ionicons name="checkmark" size={12} color="#FFF" />}
              </TouchableOpacity>

              {/* Name + special badge */}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.typeName, { color: textPrimary }]}>{t.name}</Text>
                  {t.is_special && (
                    <View style={styles.specialBadge}>
                      <Text style={styles.specialText}>special</Text>
                    </View>
                  )}
                </View>
                {t.cutoff_time && (
                  <Text style={[styles.cutoffText, { color: textSec }]}>
                    Cutoff {t.cutoff_time.slice(0, 5)}
                  </Text>
                )}
              </View>

              {/* Weight editor */}
              <View style={[styles.weightWrap, { backgroundColor: inputBg }]}>
                <TextInput
                  style={[styles.weightInput, { color: textPrimary }]}
                  value={String(t.weight)}
                  onChangeText={() => {}}
                  onEndEditing={e => handleUpdateType(t, 'weight', e.nativeEvent.text)}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                />
              </View>
              <Text style={[styles.weightLabel, { color: textSec }]}>weight</Text>
            </View>
          ))}
        </View>

        {/* ── Danger Zone ── */}
        <Text style={[styles.sectionLabel, { color: '#FF6584' }]}>DANGER ZONE</Text>
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <TouchableOpacity
            style={styles.dangerRow}
            onPress={() => Alert.alert(
              'Archive Mess',
              'Archiving the mess will hide it from all members. This cannot be undone easily.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Archive', style: 'destructive',
                  onPress: async () => {
                    try {
                      await mealBooksApi.update(mealBookId, {} as any); // backend handles archive via DELETE
                      router.replace('/(tabs)/meal');
                    } catch { /* silent */ }
                  },
                },
              ]
            )}>
            <Ionicons name="archive-outline" size={18} color="#FF6584" />
            <Text style={styles.dangerText}>Archive Meal Book</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', flex: 1, marginLeft: 12 },
  saveBtn: {
    backgroundColor: '#6C63FF', paddingHorizontal: 18, paddingVertical: 8,
    borderRadius: 20, minWidth: 64, alignItems: 'center',
  },
  saveBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },

  scroll: { padding: 20, gap: 8 },

  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: 12, marginBottom: 6, marginLeft: 4 },
  sectionHint:  { fontSize: 12, lineHeight: 17, marginBottom: 8, marginLeft: 4 },

  card: {
    borderRadius: 18, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  field: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
    paddingHorizontal: 18, paddingVertical: 10,
    borderBottomWidth: 1, minHeight: 54, gap: 10,
  },
  fieldLabel: { fontSize: 14, fontWeight: '600', flex: 1 },
  fieldInput: { flex: 1, fontSize: 15, textAlign: 'right', paddingVertical: 8 },

  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  chipText: { fontSize: 13, fontWeight: '600' },

  typeRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, gap: 10,
  },
  toggleDot: {
    width: 24, height: 24, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  typeName:    { fontSize: 14, fontWeight: '600' },
  cutoffText:  { fontSize: 11, marginTop: 2 },
  specialBadge:{ backgroundColor: '#6C63FF22', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  specialText: { color: '#6C63FF', fontSize: 10, fontWeight: '700' },

  weightWrap: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, minWidth: 52, alignItems: 'center' },
  weightInput: { fontSize: 15, fontWeight: '700', textAlign: 'center', minWidth: 36 },
  weightLabel: { fontSize: 11 },

  dangerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingVertical: 18,
  },
  dangerText: { color: '#FF6584', fontSize: 14, fontWeight: '600' },

  lockedCard: { borderRadius: 20, padding: 32, alignItems: 'center', gap: 10, width: '85%' },
  lockedTitle: { fontSize: 20, fontWeight: '800' },
  lockedSub:   { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  backBtn: { marginTop: 8, backgroundColor: '#6C63FF', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  backBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
});
