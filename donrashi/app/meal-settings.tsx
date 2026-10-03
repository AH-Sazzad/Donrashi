/**
 * Meal Book Settings — manager only.
 * Features:
 *  - Edit name, min billable meals, bazar team size
 *  - Meal type weights / cutoffs / active toggle
 *  - Join Code display (system-generated, copyable)
 *  - Delete meal book (type name to confirm)
 */
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal,
  Platform, Pressable, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
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
  const [deleting, setDeleting] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [copied, setCopied]     = useState(false);

  // Form state
  const [name, setName]               = useState('');
  const [minBillable, setMinBillable] = useState('');
  const [teamSize, setTeamSize]       = useState<2 | 3>(2);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

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
      setTeamSize(b.bazar_team_size === 3 ? 3 : 2);
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
      const updated = await mealBooksApi.update(mealBookId, {
        name: name.trim(),
        min_billable_meals: Number(minBillable) || 30,
        bazar_team_size: teamSize,
      });
      setBook(updated);
      Alert.alert('Saved', 'Settings updated successfully.');
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save.');
    } finally { setSaving(false); }
  }

  async function handleUpdateType(type: MealType, field: 'weight' | 'cutoff_time' | 'is_active', value: string | boolean) {
    try {
      const body =
        field === 'weight'      ? { weight: Number(value) } :
        field === 'cutoff_time' ? { cutoff_time: value as string || undefined } :
                                  { is_active: value as boolean };
      const updated = await mealTypesApi.update(mealBookId, type.id, body);
      setTypes(prev => prev.map(t => t.id === type.id ? updated : t));
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update meal type.');
    }
  }

  async function handleCopyCode() {
    if (!book?.join_code) return;
    await Clipboard.setStringAsync(book.join_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDelete() {
    if (deleteConfirmText.trim().toLowerCase() !== (book?.name ?? '').trim().toLowerCase()) {
      Alert.alert('Name mismatch', `Type "${book?.name}" exactly to confirm deletion.`);
      return;
    }
    setDeleting(true);
    try {
      await mealBooksApi.delete(mealBookId);
      setShowDeleteModal(false);
      router.replace('/(tabs)/meal');
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to delete meal book.');
      setDeleting(false);
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </SafeAreaView>
    );
  }

  // ── Not manager ────────────────────────────────────────────────────────────
  if (!isManager) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: bg }]}>
        <View style={[styles.lockedCard, { backgroundColor: cardBg }]}>
          <Text style={{ fontSize: 40 }}>🔒</Text>
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

  // ── Main ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top', 'bottom']}>

      {/* Header */}
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

        {/* ── Join Code ── */}
        <Text style={[styles.sectionLabel, { color: textSec }]}>JOIN CODE</Text>
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <View style={styles.joinCodeRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.joinCodeLabel, { color: textSec }]}>
                Share this code so others can join your mess
              </Text>
              <Text style={[styles.joinCodeValue, { color: textPrimary }]}>
                {book?.join_code ?? '------'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleCopyCode}
              style={[styles.copyBtn, { backgroundColor: copied ? '#43C59E' : '#6C63FF' }]}>
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color="#FFF" />
              <Text style={styles.copyBtnText}>{copied ? 'Copied!' : 'Copy'}</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.joinCodeHint, { borderTopColor: borderColor }]}>
            <Ionicons name="information-circle-outline" size={14} color={textSec} />
            <Text style={[styles.joinCodeHintText, { color: textSec }]}>
              This code is permanent and unique to your mess. Anyone with it can join.
            </Text>
          </View>
        </View>

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

          <View style={[styles.field, { borderBottomColor: 'transparent', flexWrap: 'wrap', minHeight: 72 }]}>
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
          Weight determines how meals are counted. Breakfast 0.5 = half a meal.
        </Text>
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          {types.map((t, idx) => (
            <View key={t.id} style={[
              styles.typeRow, { borderBottomColor: borderColor },
              idx === types.length - 1 && { borderBottomWidth: 0 },
            ]}>
              <TouchableOpacity
                onPress={() => handleUpdateType(t, 'is_active', !t.is_active)}
                style={[styles.toggleDot, {
                  backgroundColor: t.is_active ? '#43C59E' : (isDark ? '#2A2A3E' : '#E2E8F0'),
                }]}>
                {t.is_active && <Ionicons name="checkmark" size={12} color="#FFF" />}
              </TouchableOpacity>

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

              <View style={[styles.weightWrap, { backgroundColor: inputBg }]}>
                <TextInput
                  style={[styles.weightInput, { color: textPrimary }]}
                  defaultValue={String(t.weight)}
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
            onPress={() => { setDeleteConfirmText(''); setShowDeleteModal(true); }}
            style={styles.dangerRow}>
            <View style={[styles.dangerIcon, { backgroundColor: '#FF658418' }]}>
              <Ionicons name="trash-outline" size={18} color="#FF6584" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.dangerText}>Delete Meal Book</Text>
              <Text style={[styles.dangerSub, { color: textSec }]}>
                Permanently removes all data. Cannot be undone.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#FF6584" />
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Delete confirmation modal ── */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalOverlay}>
            <View style={[styles.deleteModal, { backgroundColor: cardBg }]}>

              {/* Icon */}
              <View style={[styles.deleteIconWrap, { backgroundColor: '#FF658418' }]}>
                <Ionicons name="trash" size={32} color="#FF6584" />
              </View>

              <Text style={[styles.deleteTitle, { color: textPrimary }]}>
                Delete "{book?.name}"?
              </Text>

              <Text style={[styles.deleteSub, { color: textSec }]}>
                This will permanently delete the meal book and all its data — members, expenses, deposits, meal records, and settlements.{'\n\n'}
                This action <Text style={{ fontWeight: '800', color: '#FF6584' }}>cannot be undone</Text>.
              </Text>

              {/* Type-to-confirm */}
              <Text style={[styles.deleteConfirmLabel, { color: textSec }]}>
                Type <Text style={{ fontWeight: '700', color: textPrimary }}>{book?.name}</Text> to confirm:
              </Text>
              <TextInput
                style={[styles.deleteConfirmInput, {
                  backgroundColor: inputBg,
                  color: textPrimary,
                  borderColor: deleteConfirmText === book?.name ? '#FF6584' : borderColor,
                }]}
                value={deleteConfirmText}
                onChangeText={setDeleteConfirmText}
                placeholder={book?.name}
                placeholderTextColor={textSec}
                autoCorrect={false}
                autoCapitalize="none"
              />

              {/* Actions */}
              <View style={styles.deleteActions}>
                <TouchableOpacity
                  onPress={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }}
                  style={[styles.deleteCancelBtn, { backgroundColor: inputBg }]}>
                  <Text style={[styles.deleteCancelText, { color: textSec }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleDelete}
                  disabled={deleting || deleteConfirmText.trim().toLowerCase() !== (book?.name ?? '').trim().toLowerCase()}
                  style={[
                    styles.deleteConfirmBtn,
                    (deleting || deleteConfirmText.trim().toLowerCase() !== (book?.name ?? '').trim().toLowerCase())
                      && { opacity: 0.4 },
                  ]}>
                  {deleting
                    ? <ActivityIndicator size="small" color="#FFF" />
                    : <><Ionicons name="trash" size={15} color="#FFF" />
                        <Text style={styles.deleteConfirmText}>Delete Forever</Text></>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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

  // Join code
  joinCodeRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 18, gap: 12,
  },
  joinCodeLabel: { fontSize: 12, marginBottom: 6 },
  joinCodeValue: { fontSize: 28, fontWeight: '800', letterSpacing: 4, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
  },
  copyBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  joinCodeHint: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    paddingHorizontal: 18, paddingVertical: 12, borderTopWidth: 1,
  },
  joinCodeHintText: { fontSize: 12, flex: 1, lineHeight: 17 },

  // General fields
  field: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
    paddingHorizontal: 18, paddingVertical: 10,
    borderBottomWidth: 1, minHeight: 54, gap: 10,
  },
  fieldLabel: { fontSize: 14, fontWeight: '600', flex: 1 },
  fieldInput: { flex: 1, fontSize: 15, textAlign: 'right', paddingVertical: 8 },

  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  chipText: { fontSize: 13, fontWeight: '600' },

  // Meal types
  typeRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, gap: 10,
  },
  toggleDot: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  typeName:     { fontSize: 14, fontWeight: '600' },
  cutoffText:   { fontSize: 11, marginTop: 2 },
  specialBadge: { backgroundColor: '#6C63FF22', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  specialText:  { color: '#6C63FF', fontSize: 10, fontWeight: '700' },
  weightWrap:   { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, minWidth: 52, alignItems: 'center' },
  weightInput:  { fontSize: 15, fontWeight: '700', textAlign: 'center', minWidth: 36 },
  weightLabel:  { fontSize: 11 },

  // Danger zone
  dangerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingVertical: 16,
  },
  dangerIcon: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  dangerText: { color: '#FF6584', fontSize: 14, fontWeight: '700' },
  dangerSub:  { fontSize: 11, marginTop: 2 },

  // Delete modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  deleteModal: {
    width: '100%', borderRadius: 24, padding: 24,
    alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25, shadowRadius: 24, elevation: 16,
  },
  deleteIconWrap: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  deleteTitle:    { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  deleteSub:      { fontSize: 13, lineHeight: 20, textAlign: 'center' },
  deleteConfirmLabel: { fontSize: 13, alignSelf: 'flex-start' },
  deleteConfirmInput: {
    width: '100%', borderRadius: 12, padding: 14,
    fontSize: 15, borderWidth: 1.5,
  },
  deleteActions: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 4 },
  deleteCancelBtn: {
    flex: 1, height: 50, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  deleteCancelText: { fontSize: 15, fontWeight: '600' },
  deleteConfirmBtn: {
    flex: 2, height: 50, borderRadius: 14, backgroundColor: '#FF6584',
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
  },
  deleteConfirmText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  // Locked
  lockedCard:  { borderRadius: 20, padding: 32, alignItems: 'center', gap: 10, width: '85%' },
  lockedTitle: { fontSize: 20, fontWeight: '800' },
  lockedSub:   { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  backBtn:     { marginTop: 8, backgroundColor: '#6C63FF', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  backBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
});
