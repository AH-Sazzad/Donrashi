import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import {
    CURRENCY_NAMES,
    CURRENCY_SYMBOLS,
    SupportedCurrency,
    useCurrency,
} from '@/context/CurrencyContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

const CURRENCIES: SupportedCurrency[] = ['BDT', 'USD', 'EUR'];

// ─── Menu Row ─────────────────────────────────────────────────────────────────

function MenuRow({
  icon, label, value, onPress, destructive, isDark, loading,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  isDark: boolean;
  loading?: boolean;
}) {
  const textPrimary = isDark ? '#F1F5F9' : '#1E293B';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const borderColor = isDark ? '#2A2A3E' : '#F1F5F9';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={[styles.menuRow, { borderBottomColor: borderColor }]}>
      <View style={[
        styles.menuIconWrap,
        { backgroundColor: destructive ? '#FFF0F3' : '#EEF2FF' },
      ]}>
        <Ionicons name={icon} size={18} color={destructive ? '#FF6584' : '#6C63FF'} />
      </View>
      <Text style={[styles.menuLabel, { color: destructive ? '#FF6584' : textPrimary }]}>
        {label}
      </Text>
      <View style={styles.menuRight}>
        {loading
          ? <ActivityIndicator size="small" color="#6C63FF" />
          : value
            ? <Text style={[styles.menuValue, { color: textSecondary }]}>{value}</Text>
            : null}
        {onPress && !loading && (
          <Ionicons name="chevron-forward" size={16} color={textSecondary} />
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Currency Picker Modal ────────────────────────────────────────────────────

function CurrencyPickerModal({
  visible, current, isDark, onSelect, onClose,
}: {
  visible: boolean;
  current: SupportedCurrency;
  isDark: boolean;
  onSelect: (c: SupportedCurrency) => void;
  onClose: () => void;
}) {
  const bg = isDark ? '#1A1A2E' : '#FFFFFF';
  const overlay = isDark ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.45)';
  const textPrimary = isDark ? '#F1F5F9' : '#1E293B';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const rowBorder = isDark ? '#2A2A3E' : '#F1F5F9';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.modalOverlay, { backgroundColor: overlay }]} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: bg }]}>
        <View style={styles.sheetHandle} />
        <Text style={[styles.sheetTitle, { color: textPrimary }]}>Base Currency</Text>
        <Text style={[styles.sheetSubtitle, { color: textSecondary }]}>
          All totals will be converted and shown in this currency
        </Text>
        {CURRENCIES.map(c => (
          <TouchableOpacity
            key={c}
            onPress={() => { onSelect(c); onClose(); }}
            style={[styles.currencyRow, { borderBottomColor: rowBorder }]}>
            <View style={[styles.currencySymbolWrap, {
              backgroundColor: current === c ? '#6C63FF' : (isDark ? '#2A2A3E' : '#EEF2FF'),
            }]}>
              <Text style={[styles.currencySymbolText, {
                color: current === c ? '#FFF' : '#6C63FF',
              }]}>
                {CURRENCY_SYMBOLS[c]}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.currencyCode, { color: textPrimary }]}>{c}</Text>
              <Text style={[styles.currencyName, { color: textSecondary }]}>{CURRENCY_NAMES[c]}</Text>
            </View>
            {current === c && (
              <Ionicons name="checkmark-circle" size={22} color="#6C63FF" />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AccountScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user, logout, refreshUser } = useAuth();
  const { baseCurrency, setBaseCurrency, symbol } = useCurrency();

  const bg = isDark ? '#0F0F1A' : '#F8F9FF';
  const cardBg = isDark ? '#1E1E2E' : '#FFFFFF';
  const textPrimary = isDark ? '#F1F5F9' : '#1E293B';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';

  const [loggingOut, setLoggingOut] = useState(false);
  const [loadingUser, setLoadingUser] = useState(false);
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);

  // Fetch fresh user data once on mount — intentionally omitting deps
  useEffect(() => {
    if (!user) {
      setLoadingUser(true);
      refreshUser().finally(() => setLoadingUser(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await logout();
          } catch {
            Alert.alert('Error', 'Could not log out. Please try again.');
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  const initials = user?.name
    ? user.name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase()).join('')
    : '?';

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    : undefined;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: textPrimary }]}>Account</Text>
        </View>

        {/* Avatar */}
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            {loadingUser
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.avatarText}>{initials}</Text>}
          </View>
          <Text style={[styles.profileName, { color: textPrimary }]}>
            {user?.name ?? (loadingUser ? '…' : 'Guest')}
          </Text>
          <Text style={[styles.profileEmail, { color: textSecondary }]}>
            {user?.email ?? ''}
          </Text>
        </View>

        {/* User info */}
        <View style={[styles.menuCard, { backgroundColor: cardBg }]}>
          <MenuRow
            icon="person-outline"
            label="Name"
            value={user?.name}
            loading={loadingUser && !user?.name}
            isDark={isDark}
          />
          <MenuRow
            icon="mail-outline"
            label="Email"
            value={user?.email}
            loading={loadingUser && !user?.email}
            isDark={isDark}
          />
          <MenuRow
            icon="calendar-outline"
            label="Member since"
            value={memberSince}
            loading={loadingUser && !memberSince}
            isDark={isDark}
          />
        </View>

        {/* Preferences */}
        <Text style={[styles.sectionLabel, { color: textSecondary }]}>PREFERENCES</Text>
        <View style={[styles.menuCard, { backgroundColor: cardBg }]}>
          <MenuRow
            icon="cash-outline"
            label="Base Currency"
            value={`${symbol} ${baseCurrency}`}
            onPress={() => setCurrencyModalVisible(true)}
            isDark={isDark}
          />
          <MenuRow
            icon="moon-outline"
            label="Appearance"
            value={colorScheme === 'dark' ? 'Dark' : 'Light'}
            isDark={isDark}
          />
          <MenuRow
            icon="information-circle-outline"
            label="Version"
            value="1.0.0"
            isDark={isDark}
          />
        </View>

        {/* Currency info banner */}
        <View style={[styles.infoBanner, { backgroundColor: '#6C63FF18', borderColor: '#6C63FF40' }]}>
          <Ionicons name="swap-horizontal-outline" size={18} color="#6C63FF" />
          <Text style={[styles.infoBannerText, { color: textSecondary }]}>
            Base currency is <Text style={{ color: '#6C63FF', fontWeight: '700' }}>{baseCurrency}</Text>.
            {' '}All wallet totals and transaction summaries are auto-converted to {baseCurrency}.
          </Text>
        </View>

        {/* Logout */}
        <View style={[styles.menuCard, { backgroundColor: cardBg }]}>
          <MenuRow
            icon="log-out-outline"
            label={loggingOut ? 'Logging out…' : 'Log out'}
            onPress={loggingOut ? undefined : handleLogout}
            loading={loggingOut}
            destructive
            isDark={isDark}
          />
        </View>
      </ScrollView>

      <CurrencyPickerModal
        visible={currencyModalVisible}
        current={baseCurrency}
        isDark={isDark}
        onSelect={setBaseCurrency}
        onClose={() => setCurrencyModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontSize: 28, fontWeight: '800' },

  profileSection: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#6C63FF',
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
    shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
  avatarText: { color: '#FFF', fontSize: 28, fontWeight: '800' },
  profileName: { fontSize: 20, fontWeight: '700' },
  profileEmail: { fontSize: 14 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1,
    paddingHorizontal: 24, paddingTop: 8, paddingBottom: 6,
  },
  menuCard: {
    marginHorizontal: 20, marginBottom: 16, borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  menuRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 12,
  },
  menuIconWrap: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  menuRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  menuValue: { fontSize: 14 },

  infoBanner: {
    marginHorizontal: 20, marginBottom: 16, borderRadius: 14, borderWidth: 1,
    padding: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start',
  },
  infoBannerText: { flex: 1, fontSize: 13, lineHeight: 18 },

  // Modal
  modalOverlay: { ...StyleSheet.absoluteFillObject },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 36,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 12,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1',
    alignSelf: 'center', marginBottom: 16,
  },
  sheetTitle: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  sheetSubtitle: { fontSize: 13, marginBottom: 20 },
  currencyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, borderBottomWidth: 1,
  },
  currencySymbolWrap: {
    width: 44, height: 44, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  currencySymbolText: { fontSize: 20, fontWeight: '800' },
  currencyCode: { fontSize: 16, fontWeight: '700' },
  currencyName: { fontSize: 13, marginTop: 2 },
});
