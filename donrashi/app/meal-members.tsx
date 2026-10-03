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

  // Invite modal
  const [showInvite, setShowInvite]         = useState(false);
  const [inviteEmail, setInviteEmail]       = useState('');
  const [inviting, setInviting]             = useState(false);
  const [lastInvite, setLastInvite]         = useState<MealBookInvitation | null>(null);
  const [showTokenModal, setShowTokenModal] = useState(false);

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
    setInviting(true);
    try {
      const inv = await mealMembersApi.invite(mealBookId, email);
      setLastInvite(inv);
      setShowInvite(false);
      setInviteEmail('');
      setShowTokenModal(true);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to send invitation.');
    } finally { setInviting(false); }
  }

  async function handleRemove(member: MealBookMember) {
    if (member.user_id === user?.id) {
      Alert.alert('Cannot remove yourself', 'Transfer management first, then leave.'); return;
    }
    Alert.alert(
      'Remove Member',
      `Remove ${member.user?.name ?? 'this member'} from the mess?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            try {
              await mealMembersApi.remove(mealBookId, member.user_id);
              setMembers(prev => prev.filter(m => m.user_id !== member.user_id));
            } catch (e: unknown) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed to remove member.');
            }
          },
        },
      ]
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
          <TouchableOpacity onPress={() => setShowInvite(true)} style={styles.inviteBtn}>
            <Ionicons name="person-add-outline" size={15} color="#FFF" />
            <Text style={styles.inviteBtnText}>Invite</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={item => String(item.user_id)}
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
                <TouchableOpacity onPress={() => setShowInvite(true)} style={styles.emptyBtn}>
                  <Text style={styles.emptyBtnText}>Invite Someone</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item }) => {
            const initials = (item.user?.name ?? '?').charAt(0).toUpperCase();
            const isMe     = item.user_id === user?.id;
            const isMgr    = item.role === 'manager';
            return (
              <View style={[styles.memberCard, { backgroundColor: cardBg }]}>
                {/* Avatar */}
                <View style={[styles.avatar, {
                  backgroundColor: isMgr ? '#6C63FF22' : '#43C59E22',
                }]}>
                  <Text style={[styles.avatarText, { color: isMgr ? '#6C63FF' : '#43C59E' }]}>
                    {initials}
                  </Text>
                </View>

                {/* Info */}
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.memberName, { color: textPrimary }]}>
                      {item.user?.name ?? `User #${item.user_id}`}
                    </Text>
                    {isMe && (
                      <View style={styles.youBadge}>
                        <Text style={styles.youText}>you</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.memberEmail, { color: textSec }]}>
                    {item.user?.email ?? ''}
                  </Text>
                  {item.joined_at && (
                    <Text style={[styles.memberJoined, { color: textSec }]}>
                      Joined {new Date(item.joined_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  )}
                </View>

                {/* Role badge */}
                <View style={[styles.roleBadge, {
                  backgroundColor: isMgr ? '#6C63FF22' : '#94A3B822',
                }]}>
                  <Text style={[styles.roleText, { color: isMgr ? '#6C63FF' : textSec }]}>
                    {isMgr ? '👑 Manager' : 'Member'}
                  </Text>
                </View>

                {/* Remove button (manager only, not self, not other manager) */}
                {isManager && !isMe && !isMgr && (
                  <TouchableOpacity onPress={() => handleRemove(item)} style={{ padding: 6, marginLeft: 4 }}>
                    <Ionicons name="close-circle-outline" size={20} color="#FF6584" />
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
        />
      )}

      {/* ── Invite modal ── */}
      <Modal
        visible={showInvite}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInvite(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.overlay} onPress={() => setShowInvite(false)} />
          <View style={[styles.sheet, { backgroundColor: cardBg }]}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.sheetTitle, { color: textPrimary }]}>Invite Member</Text>
            <Text style={[styles.sheetSub, { color: textSec }]}>
              Enter their email. You'll get a token to share with them.
            </Text>

            <View style={[styles.emailRow, { backgroundColor: inputBg }]}>
              <Ionicons name="mail-outline" size={18} color="#6C63FF" />
              <TextInput
                style={[styles.emailInput, { color: textPrimary }]}
                value={inviteEmail}
                onChangeText={setInviteEmail}
                placeholder="email@example.com"
                placeholderTextColor={textSec}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
            </View>

            <View style={styles.sheetActions}>
              <TouchableOpacity
                onPress={() => { setShowInvite(false); setInviteEmail(''); }}
                style={[styles.cancelBtn, { backgroundColor: inputBg }]}>
                <Text style={[styles.cancelText, { color: textSec }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleInvite}
                disabled={inviting}
                style={[styles.sendBtn, inviting && { opacity: 0.5 }]}>
                {inviting
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <><Ionicons name="send-outline" size={16} color="#FFF" />
                      <Text style={styles.sendBtnText}>Send Invite</Text></>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Token display modal ── */}
      <Modal
        visible={showTokenModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTokenModal(false)}>
        <View style={styles.overlay}>
          <View style={[styles.tokenCard, { backgroundColor: cardBg }]}>
            <View style={[styles.tokenIconWrap, { backgroundColor: '#43C59E18' }]}>
              <Ionicons name="checkmark-circle" size={36} color="#43C59E" />
            </View>
            <Text style={[styles.tokenTitle, { color: textPrimary }]}>Invitation Created</Text>
            <Text style={[styles.tokenSub, { color: textSec }]}>
              Share this token with {lastInvite?.email}. They can enter it in the app under{' '}
              <Text style={{ fontWeight: '700' }}>Mess → Join via Token</Text>.
            </Text>

            <View style={[styles.tokenBox, { backgroundColor: inputBg }]}>
              <Text style={[styles.tokenText, { color: textPrimary }]} selectable>
                {lastInvite?.token ?? ''}
              </Text>
            </View>

            <Text style={[styles.tokenExpiry, { color: textSec }]}>
              Expires in 7 days
            </Text>

            <TouchableOpacity
              onPress={() => setShowTokenModal(false)}
              style={styles.doneBtn}>
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', flex: 1, marginLeft: 12 },
  inviteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#6C63FF', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  inviteBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  list: { padding: 16, gap: 10, paddingBottom: 40 },

  memberCard: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderRadius: 16, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  avatar: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800' },
  nameRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  memberName: { fontSize: 15, fontWeight: '600' },
  memberEmail: { fontSize: 12, marginBottom: 2 },
  memberJoined: { fontSize: 11 },
  youBadge: { backgroundColor: '#6C63FF22', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  youText:  { color: '#6C63FF', fontSize: 10, fontWeight: '700' },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  roleText:  { fontSize: 11, fontWeight: '700' },

  emptyCard: { borderRadius: 20, padding: 40, alignItems: 'center', gap: 12, margin: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyBtn: { backgroundColor: '#6C63FF', paddingHorizontal: 24, paddingVertical: 11, borderRadius: 12 },
  emptyBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },

  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 44 : 28, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 16, elevation: 10,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 4 },
  sheetTitle: { fontSize: 20, fontWeight: '800' },
  sheetSub:   { fontSize: 13, lineHeight: 19 },
  emailRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, paddingHorizontal: 16, height: 52,
  },
  emailInput: { flex: 1, fontSize: 15 },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600' },
  sendBtn: {
    flex: 2, height: 50, borderRadius: 14, backgroundColor: '#6C63FF',
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
  },
  sendBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  // Token modal (centered card style)
  tokenCard: {
    margin: 28, borderRadius: 24, padding: 28,
    alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 20, elevation: 12,
  },
  tokenIconWrap: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  tokenTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  tokenSub:   { fontSize: 13, lineHeight: 20, textAlign: 'center' },
  tokenBox: {
    width: '100%', borderRadius: 12, padding: 16,
    alignItems: 'center',
  },
  tokenText:   { fontSize: 13, fontFamily: 'monospace', letterSpacing: 1, textAlign: 'center' },
  tokenExpiry: { fontSize: 12 },
  doneBtn: {
    width: '100%', height: 50, borderRadius: 14, backgroundColor: '#6C63FF',
    justifyContent: 'center', alignItems: 'center', marginTop: 4,
  },
  doneBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
