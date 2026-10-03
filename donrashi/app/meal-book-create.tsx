import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, Pressable, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { mealBooksApi } from '@/services/mealApi';

const CURRENCIES = ['BDT', 'USD', 'EUR'];

export default function MealBookCreateScreen() {
  const isDark        = useColorScheme() === 'dark';
  const bg            = isDark ? '#0F0F1A' : '#F8F9FF';
  const cardBg        = isDark ? '#1E1E2E' : '#FFFFFF';
  const textPrimary   = isDark ? '#F1F5F9' : '#1E293B';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const inputBg       = isDark ? '#2A2A3E' : '#F1F5F9';
  const borderColor   = isDark ? '#2A2A3E' : '#E2E8F0';

  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency]       = useState('BDT');
  const [minBillable, setMinBillable] = useState('30');
  const [teamSize, setTeamSize]       = useState<2 | 3>(2);
  const [saving, setSaving]           = useState(false);

  async function handleCreate() {
    if (!name.trim()) { Alert.alert('Missing', 'Please enter a name.'); return; }
    setSaving(true);
    try {
      const book = await mealBooksApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
        currency,
        min_billable_meals: Number(minBillable) || 30,
        bazar_team_size: teamSize,
      });
      router.replace({ pathname: '/meal-book-detail', params: { id: String(book.id) } });
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create meal book.');
    } finally { setSaving(false); }
  }

  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: bg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <Ionicons name="close" size={24} color={textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: textPrimary }]}>New Meal Book</Text>
          <TouchableOpacity onPress={handleCreate} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.5 }]}>
            {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.saveBtnText}>Create</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
          <View style={[styles.formCard, { backgroundColor: cardBg }]}>

            {/* Name */}
            <View style={[styles.field, { borderBottomColor: borderColor }]}>
              <Ionicons name="restaurant-outline" size={18} color="#6C63FF" />
              <TextInput
                style={[styles.input, { color: textPrimary }]}
                value={name} onChangeText={setName}
                placeholder="Mess name (e.g. Mirpur Bachelor Mess)"
                placeholderTextColor={textSecondary}
                autoCapitalize="words"
              />
            </View>

            {/* Description */}
            <View style={[styles.field, { borderBottomColor: borderColor }]}>
              <Ionicons name="document-text-outline" size={18} color="#6C63FF" />
              <TextInput
                style={[styles.input, { color: textPrimary }]}
                value={description} onChangeText={setDescription}
                placeholder="Description (optional)"
                placeholderTextColor={textSecondary}
                multiline
              />
            </View>

            {/* Currency */}
            <View style={[styles.field, { borderBottomColor: borderColor, minHeight: 60, flexWrap: 'wrap' }]}>
              <Ionicons name="cash-outline" size={18} color="#6C63FF" />
              <Text style={[styles.fieldLabel, { color: textSecondary }]}>Currency</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                {CURRENCIES.map(c => (
                  <Pressable key={c} onPress={() => setCurrency(c)}
                    style={[styles.chip, { borderColor: '#6C63FF' }, currency === c && { backgroundColor: '#6C63FF' }]}>
                    <Text style={[styles.chipText, { color: currency === c ? '#FFF' : '#6C63FF' }]}>{c}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Min billable */}
            <View style={[styles.field, { borderBottomColor: borderColor }]}>
              <Ionicons name="calculator-outline" size={18} color="#6C63FF" />
              <Text style={[styles.fieldLabel, { color: textSecondary }]}>Min Billable Meals</Text>
              <TextInput
                style={[styles.input, { color: textPrimary, textAlign: 'right' }]}
                value={minBillable} onChangeText={setMinBillable}
                keyboardType="number-pad" placeholder="30" placeholderTextColor={textSecondary}
              />
            </View>

            {/* Bazar team size */}
            <View style={[styles.field, { borderBottomColor: 'transparent', flexWrap: 'wrap' }]}>
              <Ionicons name="people-outline" size={18} color="#6C63FF" />
              <Text style={[styles.fieldLabel, { color: textSecondary }]}>Bazar Team Size</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                {([2, 3] as const).map(n => (
                  <Pressable key={n} onPress={() => setTeamSize(n)}
                    style={[styles.chip, { borderColor: '#6C63FF' }, teamSize === n && { backgroundColor: '#6C63FF' }]}>
                    <Text style={[styles.chipText, { color: teamSize === n ? '#FFF' : '#6C63FF' }]}>{n} members</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          <Text style={[{ fontSize: 12, color: textSecondary, textAlign: 'center' }]}>
            You will become the first manager. Meal types (Breakfast, Lunch, Dinner) are added automatically.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  saveBtn: {
    backgroundColor: '#6C63FF', paddingHorizontal: 18, paddingVertical: 8,
    borderRadius: 20, minWidth: 64, alignItems: 'center',
  },
  saveBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },

  formCard: {
    borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  field: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
    paddingHorizontal: 18, paddingVertical: 10,
    borderBottomWidth: 1, minHeight: 54, gap: 12,
  },
  fieldLabel: { fontSize: 13, fontWeight: '600' },
  input:      { flex: 1, fontSize: 15, paddingVertical: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  chipText: { fontSize: 13, fontWeight: '600' },
});
