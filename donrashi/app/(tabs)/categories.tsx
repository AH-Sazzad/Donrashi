import { Ionicons } from '@expo/vector-icons';
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
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { categoriesApi } from '@/services/api';
import { Category } from '@/types';

const PRESET_COLORS = [
  '#6C63FF', '#FF6584', '#43C59E', '#F7C59F', '#4ECDC4',
  '#FF6B6B', '#A78BFA', '#FFD93D', '#6BCB77', '#4D96FF',
  '#F59E0B', '#EF4444', '#10B981', '#3B82F6', '#8B5CF6',
];

// Ionicons names paired with a friendly label
const PRESET_ICONS: { name: React.ComponentProps<typeof Ionicons>['name']; label: string }[] = [
  { name: 'fast-food-outline',        label: 'Food'       },
  { name: 'car-outline',              label: 'Transport'  },
  { name: 'home-outline',             label: 'Home'       },
  { name: 'medkit-outline',           label: 'Health'     },
  { name: 'school-outline',           label: 'Education'  },
  { name: 'shirt-outline',            label: 'Clothing'   },
  { name: 'game-controller-outline',  label: 'Games'      },
  { name: 'film-outline',             label: 'Movies'     },
  { name: 'barbell-outline',          label: 'Fitness'    },
  { name: 'airplane-outline',         label: 'Travel'     },
  { name: 'gift-outline',             label: 'Gift'       },
  { name: 'wifi-outline',             label: 'Bills'      },
  { name: 'briefcase-outline',        label: 'Work'       },
  { name: 'wallet-outline',           label: 'Salary'     },
  { name: 'trending-up-outline',      label: 'Investment' },
  { name: 'cash-outline',             label: 'Cash'       },
  { name: 'cart-outline',             label: 'Shopping'   },
  { name: 'restaurant-outline',       label: 'Dining'     },
  { name: 'phone-portrait-outline',   label: 'Mobile'     },
  { name: 'pricetag-outline',         label: 'Other'      },
];

const TYPE_LABELS = { income: 'Income', expense: 'Expense' };

// ─── Category Form Modal ──────────────────────────────────────────────────────

interface CategoryFormProps {
  visible: boolean;
  initial?: Category | null;
  isDark: boolean;
  onClose: () => void;
  onSaved: (cat: Category) => void;
}

function CategoryFormModal({ visible, initial, isDark, onClose, onSaved }: CategoryFormProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [icon, setIcon] = useState<React.ComponentProps<typeof Ionicons>['name']>('pricetag-outline');
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');

  const bg = isDark ? '#1A1A2E' : '#FFFFFF';
  const overlay = isDark ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.45)';
  const textPrimary = isDark ? '#F1F5F9' : '#1E293B';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const inputBg = isDark ? '#2A2A3E' : '#F1F5F9';
  const borderColor = isDark ? '#3A3A5E' : '#E2E8F0';
  const sectionBg = isDark ? '#0F0F1A' : '#F8F9FF';

  useEffect(() => {
    if (visible) {
      setName(initial?.name ?? '');
      setType(initial?.type ?? 'expense');
      setColor(initial?.color ?? PRESET_COLORS[0]);
      const matchedIcon = PRESET_ICONS.find(i => i.name === initial?.icon);
      setIcon(matchedIcon?.name ?? 'pricetag-outline');
      setNameError('');
    }
  }, [visible, initial]);

  async function handleSave() {
    if (!name.trim()) { setNameError('Name is required'); return; }
    setSaving(true);
    try {
      let saved: Category;
      if (initial) {
        const res = await categoriesApi.update(initial.id, {
          name: name.trim(), type, color, icon: String(icon),
        });
        saved = res.data;
      } else {
        const res = await categoriesApi.create({
          name: name.trim(), type, icon: String(icon), color,
        });
        saved = res.data;
      }
      onSaved(saved);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save category.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={[styles.modalOverlay, { backgroundColor: overlay }]} onPress={onClose} />

        <View style={[styles.sheet, { backgroundColor: bg }]}>
          <View style={styles.sheetHandle} />

          {/* Title row */}
          <View style={styles.sheetHeaderRow}>
            <Text style={[styles.sheetTitle, { color: textPrimary }]}>
              {initial ? 'Edit Category' : 'New Category'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.sheetCloseBtn}>
              <Ionicons name="close" size={20} color={textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 18 }}>

            {/* Preview */}
            <View style={[styles.previewRow, { backgroundColor: color + '18', borderColor: color + '40' }]}>
              <View style={[styles.previewIcon, { backgroundColor: color + '28' }]}>
                <Ionicons name={icon} size={24} color={color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.previewName, { color: textPrimary }]} numberOfLines={1}>
                  {name || 'Category name'}
                </Text>
                <Text style={[styles.previewType, { color: type === 'income' ? '#43C59E' : '#FF6584' }]}>
                  {TYPE_LABELS[type]}
                </Text>
              </View>
              <View style={[styles.colorSwatch, { backgroundColor: color }]} />
            </View>

            {/* Name */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: textSecondary }]}>Name</Text>
              <View style={[
                styles.inputWrap,
                { backgroundColor: inputBg, borderColor: nameError ? '#FF6584' : borderColor },
              ]}>
                <TextInput
                  style={[styles.input, { color: textPrimary }]}
                  value={name}
                  onChangeText={v => { setName(v); setNameError(''); }}
                  placeholder="e.g. Food & Drinks"
                  placeholderTextColor={textSecondary}
                  autoCapitalize="words"
                />
              </View>
              {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
            </View>

            {/* Type */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: textSecondary }]}>Type</Text>
              <View style={[styles.toggleRow, { backgroundColor: inputBg }]}>
                {(['expense', 'income'] as const).map(t => (
                  <Pressable
                    key={t}
                    onPress={() => setType(t)}
                    style={[
                      styles.toggleBtn,
                      type === t && { backgroundColor: t === 'expense' ? '#FF6584' : '#43C59E' },
                    ]}>
                    <Ionicons
                      name={t === 'expense' ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'}
                      size={15}
                      color={type === t ? '#FFF' : textSecondary}
                      style={{ marginRight: 5 }}
                    />
                    <Text style={[styles.toggleText, { color: type === t ? '#FFF' : textSecondary }]}>
                      {TYPE_LABELS[t]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Icon picker */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: textSecondary }]}>Icon</Text>
              <View style={[styles.iconGrid, { backgroundColor: sectionBg }]}>
                {PRESET_ICONS.map(item => {
                  const selected = icon === item.name;
                  return (
                    <Pressable
                      key={item.name}
                      onPress={() => setIcon(item.name)}
                      style={[
                        styles.iconOption,
                        selected && { backgroundColor: color, borderColor: color },
                        !selected && { borderColor: borderColor },
                      ]}>
                      <Ionicons
                        name={item.name}
                        size={22}
                        color={selected ? '#FFF' : textSecondary}
                      />
                      <Text style={[styles.iconLabel, { color: selected ? '#FFF' : textSecondary }]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Color picker */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: textSecondary }]}>Color</Text>
              <View style={styles.colorGrid}>
                {PRESET_COLORS.map(c => (
                  <Pressable
                    key={c}
                    onPress={() => setColor(c)}
                    style={[
                      styles.colorDot,
                      { backgroundColor: c },
                      color === c && styles.colorDotSelected,
                    ]}>
                    {color === c && <Ionicons name="checkmark" size={14} color="#FFF" />}
                  </Pressable>
                ))}
              </View>
            </View>

            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}>
              {saving
                ? <ActivityIndicator color="#FFF" />
                : <Text style={styles.saveBtnText}>{initial ? 'Update' : 'Create'} Category</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Category Card ────────────────────────────────────────────────────────────

function CategoryCard({ item, isDark, onEdit, onDelete }: {
  item: Category; isDark: boolean;
  onEdit: (c: Category) => void; onDelete: (id: number) => void;
}) {
  const cardBg = isDark ? '#1E1E2E' : '#FFFFFF';
  const textPrimary = isDark ? '#F1F5F9' : '#1E293B';
  const accentColor = item.color || '#6C63FF';

  const iconName = PRESET_ICONS.find(i => i.name === item.icon)?.name ?? 'pricetag-outline';

  return (
    <View style={[styles.card, { backgroundColor: cardBg }]}>
      <View style={[styles.iconWrap, { backgroundColor: accentColor + '22' }]}>
        <Ionicons name={iconName} size={22} color={accentColor} />
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardName, { color: textPrimary }]}>{item.name}</Text>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, {
            backgroundColor: item.type === 'income'
              ? 'rgba(67,197,158,0.15)' : 'rgba(255,101,132,0.15)',
          }]}>
            <Text style={[styles.badgeText, {
              color: item.type === 'income' ? '#43C59E' : '#FF6584',
            }]}>
              {TYPE_LABELS[item.type]}
            </Text>
          </View>
        </View>
      </View>
      <TouchableOpacity onPress={() => onEdit(item)} style={styles.actionBtn}>
        <Ionicons name="pencil-outline" size={17} color="#6C63FF" />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => Alert.alert('Delete', `Delete "${item.name}"?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => onDelete(item.id) },
        ])}
        style={styles.actionBtn}>
        <Ionicons name="trash-outline" size={17} color="#FF6584" />
      </TouchableOpacity>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CategoriesScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const bg = isDark ? '#0F0F1A' : '#F8F9FF';
  const textPrimary = isDark ? '#F1F5F9' : '#1E293B';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const borderColor = isDark ? '#2A2A3E' : '#E2E8F0';

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');
  const [modalVisible, setModalVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<Category | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await categoriesApi.list();
      setCategories(res.data ?? []);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load categories.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = useCallback(async (id: number) => {
    try {
      await categoriesApi.delete(id);
      setCategories(prev => prev.filter(c => c.id !== id));
    } catch {
      Alert.alert('Error', 'Could not delete category.');
    }
  }, []);

  const handleSaved = useCallback((cat: Category) => {
    setCategories(prev => {
      const idx = prev.findIndex(c => c.id === cat.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = cat; return next; }
      return [...prev, cat];
    });
    setModalVisible(false);
    setEditTarget(null);
  }, []);

  const openCreate = () => { setEditTarget(null); setModalVisible(true); };
  const openEdit = (cat: Category) => { setEditTarget(cat); setModalVisible(true); };

  // Guard against undefined items from API
  const safeCategories = categories.filter(c => c != null);
  const filtered = safeCategories.filter(c => c.type === activeTab);

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: textPrimary }]}>Categories</Text>
        <TouchableOpacity onPress={openCreate} style={styles.addBtn}>
          <Ionicons name="add" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabRow, { borderBottomColor: borderColor }]}>
        {(['expense', 'income'] as const).map(t => (
          <TouchableOpacity key={t} onPress={() => setActiveTab(t)} style={styles.tab}>
            <Text style={[styles.tabText, { color: activeTab === t ? '#6C63FF' : textSecondary }]}>
              {TYPE_LABELS[t]}
            </Text>
            <View style={[styles.tabBadge, { backgroundColor: activeTab === t ? '#6C63FF' : borderColor }]}>
              <Text style={[styles.tabBadgeText, { color: activeTab === t ? '#FFF' : textSecondary }]}>
                {safeCategories.filter(c => c.type === t).length}
              </Text>
            </View>
            {activeTab === t && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor="#6C63FF"
            colors={['#6C63FF']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="pricetag-outline" size={48} color={textSecondary} />
            <Text style={[styles.emptyTitle, { color: textPrimary }]}>
              No {activeTab} categories
            </Text>
            <Text style={[styles.emptyText, { color: textSecondary }]}>Tap + to create one</Text>
            <TouchableOpacity onPress={openCreate} style={styles.emptyBtn}>
              <Text style={styles.emptyBtnText}>Create Category</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <CategoryCard item={item} isDark={isDark} onEdit={openEdit} onDelete={handleDelete} />
        )}
      />

      <CategoryFormModal
        visible={modalVisible}
        initial={editTarget}
        isDark={isDark}
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
  addBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#6C63FF',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },

  tabRow: {
    flexDirection: 'row', borderBottomWidth: 1,
    marginHorizontal: 20, marginBottom: 8,
  },
  tab: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 8, position: 'relative',
  },
  tabText: { fontSize: 15, fontWeight: '600' },
  tabBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  tabBadgeText: { fontSize: 11, fontWeight: '700' },
  tabIndicator: {
    position: 'absolute', bottom: 0, left: '15%', right: '15%',
    height: 2, backgroundColor: '#6C63FF', borderRadius: 1,
  },

  list: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 100, gap: 10 },

  card: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderRadius: 16, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  iconWrap: { width: 46, height: 46, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  cardBody: { flex: 1, gap: 4 },
  cardName: { fontSize: 15, fontWeight: '600' },
  badgeRow: { flexDirection: 'row' },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  actionBtn: { padding: 8 },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { fontSize: 14 },
  emptyBtn: {
    marginTop: 8, backgroundColor: '#6C63FF',
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12,
  },
  emptyBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },

  // ── Modal ──
  modalOverlay: { ...StyleSheet.absoluteFillObject },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '90%',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 12,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 12,
  },
  sheetHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  sheetTitle: { fontSize: 20, fontWeight: '800' },
  sheetCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(100,116,139,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },

  formGroup: { gap: 8 },
  formLabel: { fontSize: 13, fontWeight: '600', marginLeft: 2 },
  inputWrap: {
    borderRadius: 12, borderWidth: 1.5,
    paddingHorizontal: 14, height: 50,
    justifyContent: 'center',
  },
  input: { fontSize: 15 },
  errorText: { color: '#FF6584', fontSize: 12 },

  toggleRow: { flexDirection: 'row', borderRadius: 12, padding: 4, gap: 4 },
  toggleBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 8,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
  },
  toggleText: { fontSize: 14, fontWeight: '600' },

  // Icon grid
  iconGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    borderRadius: 14, padding: 12,
  },
  iconOption: {
    width: '18%', aspectRatio: 1, borderRadius: 12, borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center', gap: 3,
    paddingVertical: 6,
  },
  iconLabel: { fontSize: 9, fontWeight: '600', textAlign: 'center' },

  // Color grid
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorDot: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  colorDotSelected: { borderColor: '#FFF', transform: [{ scale: 1.15 }] },

  // Preview
  previewRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1,
  },
  previewIcon: {
    width: 46, height: 46, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  previewName: { fontSize: 15, fontWeight: '600' },
  previewType: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  colorSwatch: { width: 20, height: 20, borderRadius: 10 },

  saveBtn: {
    backgroundColor: '#6C63FF', borderRadius: 14, height: 54,
    justifyContent: 'center', alignItems: 'center', marginTop: 4,
    shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
