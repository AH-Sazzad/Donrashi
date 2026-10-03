/**
 * Join a meal book — two methods:
 *   1. Token — from an email invitation (48-char token)
 *   2. Join Code — 6-char code shown in Settings, shared directly by manager
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform,
  Pressable, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { mealBooksApi, mealMembersApi } from '@/services/mealApi';
import { MealBook } from '@/types';

type Method = 'code' | 'token';

export default function MealAcceptInviteScreen() {
  const { token: paramToken } = useLocalSearchParams<{ token?: string }>();

  const isDark      = useColorScheme() === 'dark';
  const bg          = isDark ? '#0F0F1A' : '#F8F9FF';
  const cardBg      = isDark ? '#1E1E2E' : '#FFFFFF';
  const textPrimary = isDark ? '#F1F5F9' : '#1E293B';
  const textSec     = isDark ? '#94A3B8' : '#64748B';
  const inputBg     = isDark ? '#2A2A3E' : '#F1F5F9';
  const borderColor = isDark ? '#2A2A3E' : '#E2E8F0';

  const [method, setMethod]   = useState<Method>('code');
  const [value, setValue]     = useState(paramToken ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [joined, setJoined]   = useState<MealBook | null>(null);

  const isCode = method === 'code';

  async function handleJoin() {
    const trimmed = value.trim();
    if (!trimmed) { setError(isCode ? 'Enter the join code.' : 'Paste the invitation token.'); return; }
    if (isCode && trimmed.length !== 6) { setError('Join code must be 6 characters.'); return; }

    setLoading(true); setError('');
    try {
      if (isCode) {
        const res = await mealBooksApi.joinByCode(trimmed);
        setJoined(res.meal_book);
      } else {
        await mealMembersApi.acceptInvitation(trimmed);
        setJoined({ id: 0, name: 'your mess' } as MealBook); // token join doesn't return book
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Invalid code or token. Please try again.');
    } finally { setLoading(false); }
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (joined) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: bg }]}>
        <View style={[styles.successCard, { backgroundColor: cardBg }]}>
          <Ionicons name="checkmark-circle" size={64} color="#43C59E" />
          <Text style={[styles.successTitle, { color: textPrimary }]}>You're in! 🎉</Text>
          <Text style={[styles.successSub, { color: textSec }]}>
            {joined.id > 0
              ? `You've joined "${joined.name}". Head to the Mess tab to get started.`
              : "You've joined the mess. Head to the Mess tab to get started."}
          </Text>
          <TouchableOpacity
            onPress={() => router.replace('/(tabs)/meal')}
            style={styles.goBtn}>
            <Text style={styles.goBtnText}>Go to Mess</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <Ionicons name="close" size={24} color={textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <View style={[styles.iconWrap, { backgroundColor: '#6C63FF18' }]}>
            <Ionicons name="people-outline" size={40} color="#6C63FF" />
          </View>

          <Text style={[styles.title, { color: textPrimary }]}>Join a Mess</Text>
          <Text style={[styles.sub, { color: textSec }]}>
            Enter a join code or paste an invitation token to join a meal book.
          </Text>

          {/* Method switcher */}
          <View style={[styles.methodRow, { backgroundColor: isDark ? '#1E1E2E' : '#FFFFFF' }]}>
            {([
              { key: 'code',  label: '6-digit Code', icon: 'keypad-outline' },
              { key: 'token', label: 'Invite Token',  icon: 'key-outline' },
            ] as { key: Method; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[]).map(m => (
              <Pressable
                key={m.key}
                onPress={() => { setMethod(m.key); setValue(''); setError(''); }}
                style={[styles.methodTab, method === m.key && styles.methodTabActive]}>
                <Ionicons name={m.icon} size={15} color={method === m.key ? '#FFF' : textSec} />
                <Text style={[styles.methodTabText, { color: method === m.key ? '#FFF' : textSec }]}>
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Input */}
          <View style={[
            styles.inputWrap,
            { backgroundColor: inputBg, borderColor: error ? '#FF6584' : borderColor },
          ]}>
            <Ionicons
              name={isCode ? 'keypad-outline' : 'key-outline'}
              size={18} color="#6C63FF"
              style={{ marginRight: 10 }}
            />
            <TextInput
              style={[styles.input, { color: textPrimary }]}
              value={value}
              onChangeText={v => { setValue(isCode ? v.toUpperCase().replace(/[^A-Z0-9]/g, '') : v); setError(''); }}
              placeholder={isCode ? 'e.g. AB3X9Z' : 'Paste invitation token here'}
              placeholderTextColor={textSec}
              autoCapitalize={isCode ? 'characters' : 'none'}
              autoCorrect={false}
              maxLength={isCode ? 6 : undefined}
              keyboardType={isCode ? 'default' : 'default'}
              multiline={!isCode}
            />
            {isCode && value.length > 0 && (
              <Text style={[styles.charCount, { color: value.length === 6 ? '#43C59E' : textSec }]}>
                {value.length}/6
              </Text>
            )}
          </View>

          {error ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={15} color="#FF6584" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Hint */}
          <Text style={[styles.hint, { color: textSec }]}>
            {isCode
              ? 'Ask your mess manager to share the 6-character code from their Settings screen.'
              : "The manager invites you by email. They'll share a token for you to paste here."}
          </Text>

          <TouchableOpacity
            onPress={handleJoin}
            disabled={loading || (isCode && value.length !== 6)}
            style={[
              styles.joinBtn,
              (loading || (isCode && value.length !== 6)) && { opacity: 0.45 },
            ]}>
            {loading
              ? <ActivityIndicator color="#FFF" />
              : <>
                  <Ionicons name="enter-outline" size={18} color="#FFF" />
                  <Text style={styles.joinBtnText}>{isCode ? 'Join Mess' : 'Accept Invitation'}</Text>
                </>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },

  topBar: { paddingHorizontal: 20, paddingVertical: 14 },

  body: { flex: 1, paddingHorizontal: 24, paddingTop: 8, gap: 14 },

  iconWrap: {
    width: 76, height: 76, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center', alignSelf: 'center',
  },
  title: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
  sub:   { fontSize: 14, lineHeight: 20, textAlign: 'center' },

  methodRow: {
    flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  methodTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 10,
  },
  methodTabActive: { backgroundColor: '#6C63FF' },
  methodTabText:   { fontSize: 13, fontWeight: '700' },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1.5, minHeight: 54,
  },
  input:     { flex: 1, fontSize: 18, fontWeight: '700', letterSpacing: 2 },
  charCount: { fontSize: 12, fontWeight: '700' },

  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  errorText: { color: '#FF6584', fontSize: 13, flex: 1 },

  hint: { fontSize: 12, lineHeight: 18, textAlign: 'center' },

  joinBtn: {
    backgroundColor: '#6C63FF', borderRadius: 14, height: 54,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  joinBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  successCard: {
    width: '100%', borderRadius: 24, padding: 32,
    alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 6,
  },
  successTitle: { fontSize: 24, fontWeight: '800' },
  successSub:   { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  goBtn: {
    backgroundColor: '#43C59E', borderRadius: 14, height: 52, width: '100%',
    justifyContent: 'center', alignItems: 'center', marginTop: 8,
  },
  goBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
