/**
 * Accept a meal book invitation via token.
 * Token comes from: router.push('/meal-accept-invite?token=<token>')
 * or from a deep link: donrashi://meal-accept-invite?token=<token>
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { mealMembersApi } from '@/services/mealApi';

export default function MealAcceptInviteScreen() {
  const { token: paramToken } = useLocalSearchParams<{ token?: string }>();

  const isDark      = useColorScheme() === 'dark';
  const bg          = isDark ? '#0F0F1A' : '#F8F9FF';
  const cardBg      = isDark ? '#1E1E2E' : '#FFFFFF';
  const textPrimary = isDark ? '#F1F5F9' : '#1E293B';
  const textSec     = isDark ? '#94A3B8' : '#64748B';
  const inputBg     = isDark ? '#2A2A3E' : '#F1F5F9';

  const [token, setToken]     = useState(paramToken ?? '');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState('');

  async function handleAccept() {
    if (!token.trim()) { setError('Please paste the invitation token.'); return; }
    setLoading(true); setError('');
    try {
      await mealMembersApi.acceptInvitation(token.trim());
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Invalid or expired token.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: bg }]}>
        <View style={[styles.successCard, { backgroundColor: cardBg }]}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={56} color="#43C59E" />
          </View>
          <Text style={[styles.successTitle, { color: textPrimary }]}>You're in!</Text>
          <Text style={[styles.successSub, { color: textSec }]}>
            You've successfully joined the mess. Go to the Mess tab to get started.
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <Ionicons name="close" size={24} color={textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <View style={[styles.iconWrap, { backgroundColor: '#6C63FF18' }]}>
            <Ionicons name="people-outline" size={40} color="#6C63FF" />
          </View>

          <Text style={[styles.title, { color: textPrimary }]}>Join a Meal Book</Text>
          <Text style={[styles.sub, { color: textSec }]}>
            Paste the invitation token shared by your mess manager to join.
          </Text>

          <View style={[styles.inputWrap, { backgroundColor: inputBg }]}>
            <Ionicons name="key-outline" size={18} color="#6C63FF" style={{ marginRight: 10 }} />
            <TextInput
              style={[styles.input, { color: textPrimary }]}
              value={token}
              onChangeText={v => { setToken(v); setError(''); }}
              placeholder="Paste invitation token here"
              placeholderTextColor={textSec}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
            />
          </View>

          {error ? (
            <View style={styles.errorWrap}>
              <Ionicons name="alert-circle-outline" size={16} color="#FF6584" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={handleAccept}
            disabled={loading}
            style={[styles.joinBtn, loading && { opacity: 0.5 }]}>
            {loading
              ? <ActivityIndicator color="#FFF" />
              : <>
                  <Ionicons name="person-add-outline" size={18} color="#FFF" />
                  <Text style={styles.joinBtnText}>Accept Invitation</Text>
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

  header: { paddingHorizontal: 20, paddingVertical: 14 },

  body: { flex: 1, paddingHorizontal: 28, paddingTop: 20, gap: 16 },

  iconWrap: {
    width: 80, height: 80, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center', alignSelf: 'center',
    marginBottom: 4,
  },
  title:  { fontSize: 26, fontWeight: '800', textAlign: 'center' },
  sub:    { fontSize: 14, lineHeight: 21, textAlign: 'center' },

  inputWrap: {
    flexDirection: 'row', alignItems: 'flex-start',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, gap: 0,
    minHeight: 80,
  },
  input: { flex: 1, fontSize: 14, lineHeight: 20 },

  errorWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  errorText: { color: '#FF6584', fontSize: 13, flex: 1 },

  joinBtn: {
    backgroundColor: '#6C63FF', borderRadius: 14, height: 54,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    marginTop: 8,
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
  successIcon:  { marginBottom: 4 },
  successTitle: { fontSize: 24, fontWeight: '800' },
  successSub:   { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  goBtn: {
    backgroundColor: '#43C59E', borderRadius: 14, height: 52, width: '100%',
    justifyContent: 'center', alignItems: 'center', marginTop: 8,
  },
  goBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
