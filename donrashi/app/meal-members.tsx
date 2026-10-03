import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView,
  Modal, Platform, Pressable, RefreshControl,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { mealBooksApi, mealMembersApi } from '@/services/mealApi';
import { MealBook, MealBookInvitation, MealBookMember } from '@/types';

type ModalType = 'invite' | 'ghost' | 'token' | null;

export default function MealMembersScreen() {
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

  const [book, setBook]             = useState<MealBook | null>(null);
  const [members, setMembers]       = useState<MealBookMember[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [submitting, setSubmitting] = useState(false);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [lastInvite, setLastInvite]   = useState<MealBookInvitation | null>(null);

  // Ghost form
  const [ghostName, setGhostName]   = useState('');
  const [ghostEmail, setGhostEmail] = useState('');
  const [ghostPhone, setGhostPhone] = useState('');

  const load = useCallback(async () => {
    try {
      const [b, m] = await Promise.all([
        mealBooksApi.get(mealBookId),
        mealMembersApi.list(mealBookId),
      ]);
      setBook(b);
      setMembers(Array.isArray(m) ? m : []);
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [mealBookId]);

  useEffect(() => { load(); }, [load]);

  const isManager = members.find(m => m.user_id === user?.id)?.role === 'manager';

  async function handleInvite() {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      Alert.alert('Invalid', 'Enter a valid email address.'); return;
    }
    setSubmitting(true);
    try {
      const inv = await mealMembersApi.invite(mealBookId, email);
      setLastInvite(inv);
      setInviteEmail('');
      setActiveModal('token');
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed.');
    } finally { setSubmitting(false); }
  }

  async function handleAddGhost() {
    if (!ghostName.trim()) { Alert.alert('Required', 'Name is required.'); return; }
    setSubmitting(true);
    try {
      const m = await mealMembersApi.addGhost(mealBookId, {
        ghost_name:  ghostName.trim(),
        ghost_email: ghostEmail.trim() || undefined,
        ghost_phone: ghostPhone.trim() || undefined,
      });
      setMembers(prev => [...prev, m]);
      setGhostName(''); setGhostEmail(''); setGhostPhone('');
      setActiveModal(null);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed.');
    } finally { setSubmitting(false); }
  }

  async function handleRemove(member: MealBookMember) {
    if (!member.is_ghost && member.user_id === user?.id) {
      Alert.alert('Cannot remove yourself', 'Transfer management first.'); return;
    }
    Alert.alert('Remove Member', `Remove "${member.display_name}" from the mess?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            if (member.is_ghost) {
              await mealMembersApi.removeGhost(mealBookId, member.id);
            } else {
              await mealMembersApi.remove(mealBookId, member.user_id!);
            }
            setMembers(prev => prev.filter(m => m.id !== member.id));
          } catch (e: unknown) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Failed.');
          }
        },
      },
    ]);
  }

  function MemberCard({ item }: { item: MealBookMember }) {
    const isMe    = item.user_id === user?.id;
    const isMgr   = item.role === 'manager';
    const isGhost = item.is_ghost;
    const initial = (item.display_name ?? '?').charAt(0).toUpperCase();

    return (
      <View style={[styles.card, { backgroundColor: cardBg }]}>
        {/* Avatar */}
        <View style={[styles.avatar, {
          backgroundColor: isGhost ? '#F59E0B22' : isMgr ? '#6C63FF22' : '#43C59E22',
        }]}>
          {isGhost
            ? <Ionicons name="person-outline" size={20} color="#F59E0B" />
            : <Text style={[styles.avatarText, { color: isMgr ? '#6C63FF' : '#43C59E' }]}>{initial}</Text>
          }
        </View>

        {/* Info */}
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={[styles.memberName, { color: textPrimary }]} numberOfLines={1}>
              {item.display_name}
            </Text>
            {isMe && (
              <View style={[styles.badge, { backgroundColor: '#6C63FF22' }]}>
                <Text style={[styles.badgeText, { color: '#6C63FF' }]}>you</Text>
              </View>
            )}
            {isGhost && (
              <View style={[styles.badge, { backgroundColor: '#F59E0B22' }]}>
                <Ionicons name="cloud-offline-outline" size={10} color="#F59E0B" />
                <Text style={[styles.badgeText, { color: '#F59E0B' }]}>offline</Text>
              </View>
            )}
          </View>

          {/* Contact details */}
          {isGhost && (item.ghost_email || item.ghost_phone) && (
            <Text style={[styles.memberSub, { color: textSec }]}>
              {item.ghost_email || item.ghost_phone}
            </Text>
          )}
          {!isGhost && item.user?.email && (
            <Text style={[styles.memberSub, { color: textSec }]}>{item.user.email}</Text>
          )}
          {isGhost && (
            <Text style={[styles.memberHint, { color: textSec }]}>
              Can claim account later via join code
            </Text>
          )}
        </View>

        {/* Role badge */}
        <View style={[styles.roleBadge, {
          backgroundColor: isMgr ? '#6C63FF22' : isGhost ? '#F59E0B22' : '#94A3B822',
        }]}>
          <Text style={[styles.roleText, {
            color: isMgr ? '#6C63FF' : isGhost ? '#F59E0B' : textSec,
          }]}>
            {isMgr ? '👑 Manager' : isGhost ? 'Offline' : 'Member'}
          </Text>
        </View>

        {/* Remove (manager only, not self) */}
        {isManager && !isMe && (
          <TouchableOpacity onPress={() => handleRemove(item)} style={{ padding: 6, marginLeft: 2 }}>
            <Ionicons name="close-circle-outline" size={20} color="#FF6584" />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top', 'bottom']}>

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color={textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textPrimary }]}>
          Members ({members.length})
        </Text>
        {isManager && (
          <View style={styles.headerBtns}>
            <TouchableOpacity
              onPress={() => setActiveModal('ghost')}
              style={[styles.headerBtn, { backgroundColor: '#F59E0B' }]}>
              <Ionicons name="person-add-outline" size={14} color="#FFF" />
              <Text style={styles.headerBtnText}>Offline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveModal('invite')}
              style={[styles.headerBtn, { backgroundColor: '#6C63FF' }]}>
              <Ionicons name="mail-outline" size={14} color="#FFF" />
              <Text style={styles.headerBtnText}>Invite</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Legend */}
      <View style={[styles.legend, { borderBottomColor: borderColor }]}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#6C63FF' }]} />
          <Text style={[styles.legendLabel, { color: textSec }]}>App member</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
          <Text style={[styles.legendLabel, { color: textSec }]}>Offline — no account yet</Text>
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#6C63FF" /></View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor="#6C63FF" colors={['#6C63FF']} />
          }
          ListEmptyComponent={
            <View style={[styles.emptyCard, { backgroundColor: cardBg }]}>
              <Ionicons name="people-outline" size={48} color={textSec} />
              <Text style={[styles.emptyTitle, { color: textPrimary }]}>No members yet</Text>
              {isManager && (
                <TouchableOpacity onPress={() => setActiveModal('invite')} style={styles.emptyBtn}>
                  <Text style={styles.emptyBtnText}>Invite First Member</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item }) => <MemberCard item={item} />}
        />
      )}

      {/* ── Invite by email modal ── */}
      <Modal visible={activeModal === 'invite'} transparent animationType="slide"
        onRequestClose={() => setActiveModal(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.overlay} onPress={() => setActiveModal(null)} />
          <View style={[styles.sheet, { backgroundColor: cardBg }]}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.sheetTitle, { color: textPrimary }]}>Invite via Email</Text>
            <Text style={[styles.sheetSub, { color: textSec }]}>
              Works for people who already have an app account. They get a token to join.
            </Text>
            <View style={[styles.inputRow, { backgroundColor: inputBg }]}>
              <Ionicons name="mail-outline" size={18} color="#6C63FF" />
              <TextInput
                style={[styles.inputText, { color: textPrimary }]}
                value={inviteEmail} onChangeText={setInviteEmail}
                placeholder="email@example.com" placeholderTextColor={textSec}
                keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoFocus
              />
            </View>
            <View style={styles.sheetActions}>
              <TouchableOpacity onPress={() => setActiveModal(null)}
                style={[styles.cancelBtn, { backgroundColor: inputBg }]}>
                <Text style={[styles.cancelText, { color: textSec }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleInvite} disabled={submitting}
                style={[styles.submitBtn, { backgroundColor: '#6C63FF' }, submitting && { opacity: 0.5 }]}>
                {submitting ? <ActivityIndicator size="small" color="#FFF" />
                  : <><Ionicons name="send-outline" size={15} color="#FFF" />
                    <Text style={styles.submitBtnText}>Send Invite</Text></>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Add offline / ghost member modal ── */}
      <Modal visible={activeModal === 'ghost'} transparent animationType="slide"
        onRequestClose={() => setActiveModal(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.overlay} onPress={() => setActiveModal(null)} />
          <View style={[styles.sheet, { backgroundColor: cardBg }]}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.sheetTitle, { color: textPrimary }]}>Add Offline Member</Text>
            <Text style={[styles.sheetSub, { color: textSec }]}>
              Add someone who does not use the app. Their meals and settlement share will still be tracked.
              If they provide the same email when joining later, their records will be linked automatically.
            </Text>

            <View style={[styles.inputRow, { backgroundColor: inputBg }]}>
              <Ionicons name="person-outline" size={18} color="#F59E0B" />
              <TextInput
                style={[styles.inputText, { color: textPrimary }]}
                value={ghostName} onChangeText={setGhostName}
                placeholder="Full name (required)" placeholderTextColor={textSec}
                autoCapitalize="words" autoFocus
              />
            </View>

            <View style={[styles.inputRow, { backgroundColor: inputBg }]}>
              <Ionicons name="mail-outline" size={18} color="#F59E0B" />
              <TextInput
                style={[styles.inputText, { color: textPrimary }]}
                value={ghostEmail} onChangeText={setGhostEmail}
                placeholder="Email (optional)" placeholderTextColor={textSec}
                keyboardType="email-address" autoCapitalize="none"
              />
            </View>

            <View style={[styles.inputRow, { backgroundColor: inputBg }]}>
              <Ionicons name="call-outline" size={18} color="#F59E0B" />
              <TextInput
                style={[styles.inputText, { color: textPrimary }]}
                value={ghostPhone} onChangeText={setGhostPhone}
                placeholder="Phone number (optional)" placeholderTextColor={textSec}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.sheetActions}>
              <TouchableOpacity onPress={() => setActiveModal(null)}
                style={[styles.cancelBtn, { backgroundColor: inputBg }]}>
                <Text style={[styles.cancelText, { color: textSec }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAddGhost} disabled={submitting}
                style={[styles.submitBtn, { backgroundColor: '#F59E0B' }, submitting && { opacity: 0.5 }]}>
                {submitting ? <ActivityIndicator size="small" color="#FFF" />
                  : <><Ionicons name="person-add-outline" size={15} color="#FFF" />
                    <Text style={styles.submitBtnText}>Add Member</Text></>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Token display modal ── */}
      <Modal visible={activeModal === 'token'} transparent animationType="fade"
        onRequestClose={() => setActiveModal(null)}>
        <View style={[styles.overlay, { justifyContent: 'center', alignItems: 'center' }]}>
          <View style={[styles.tokenCard, { backgroundColor: cardBg }]}>
            <Ionicons name="checkmark-circle" size={52} color="#43C59E" />
            <Text style={[styles.sheetTitle, { color: textPrimary, textAlign: 'center' }]}>
              Invitation Created
            </Text>
            <Text style={[styles.sheetSub, { color: textSec, textAlign: 'center' }]}>
              Share this token with {lastInvite?.email}.{'\n'}
              They enter it under Mess {'\u2192'} Join via Token.
            </Text>
            <View style={[styles.tokenBox, { backgroundColor: inputBg }]}>
              <Text style={[styles.tokenText, { color: textPrimary }]} selectable>
                {lastInvite?.token ?? ''}
              </Text>
            </View>
            <Text style={[styles.tokenExpiry, { color: textSec }]}>Expires in 7 days</Text>
            <TouchableOpacity onPress={() => { setActiveModal(null); load(); }} style={styles.doneBtn}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  headerTitle: { fontSize: 17, fontWeight: '700', flex: 1, marginLeft: 12 },
  headerBtns:  { flexDirection: 'row', gap: 8 },
  headerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
  },
  headerBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  legend: {
    flexDirection: 'row', gap: 16,
    paddingHorizontal: 20, paddingVertical: 8, borderBottomWidth: 1,
  },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:   { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11 },

  list: { padding: 16, gap: 10, paddingBottom: 40 },

  card: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderRadius: 16, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  avatar:     { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800' },

  nameRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' },
  memberName: { fontSize: 14, fontWeight: '600' },
  memberSub:  { fontSize: 11, marginTop: 1 },
  memberHint: { fontSize: 10, marginTop: 2, fontStyle: 'italic' },

  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8,
  },
  badgeText: { fontSize: 10, fontWeight: '700' },

  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  roleText:  { fontSize: 11, fontWeight: '700' },

  emptyCard:  { borderRadius: 20, padding: 40, alignItems: 'center', gap: 12, margin: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyBtn:   { backgroundColor: '#6C63FF', paddingHorizontal: 24, paddingVertical: 11, borderRadius: 12 },
  emptyBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },

  sheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 44 : 28, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 16, elevation: 10,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 4 },
  sheetTitle:  { fontSize: 20, fontWeight: '800' },
  sheetSub:    { fontSize: 13, lineHeight: 19 },

  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, paddingHorizontal: 16, height: 52,
  },
  inputText: { flex: 1, fontSize: 15 },

  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600' },
  submitBtn: {
    flex: 2, height: 50, borderRadius: 14,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
  },
  submitBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  tokenCard: {
    margin: 28, borderRadius: 24, padding: 28,
    alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 20, elevation: 12,
  },
  tokenBox:    { width: '100%', borderRadius: 12, padding: 16, alignItems: 'center' },
  tokenText:   { fontSize: 13, fontFamily: 'monospace', letterSpacing: 1, textAlign: 'center' },
  tokenExpiry: { fontSize: 12 },
  doneBtn: {
    width: '100%', height: 50, borderRadius: 14, backgroundColor: '#6C63FF',
    justifyContent: 'center', alignItems: 'center',
  },
  doneBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
