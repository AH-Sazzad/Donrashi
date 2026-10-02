import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function RegisterScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { register, isLoading } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const bg = isDark ? '#0F0F1A' : '#F8F9FF';
  const cardBg = isDark ? '#1E1E2E' : '#FFFFFF';
  const textPrimary = isDark ? '#F1F5F9' : '#1E293B';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const inputBg = isDark ? '#2A2A3E' : '#F1F5F9';
  const borderColor = isDark ? '#3A3A5E' : '#E2E8F0';

  function validate(): boolean {
    const e: typeof errors = {};
    if (!name.trim()) e.name = 'Name is required';
    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    else if (password.length < 8) e.password = 'At least 8 characters';
    if (!confirmPassword) e.confirmPassword = 'Please confirm your password';
    else if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleRegister() {
    if (!validate()) return;
    try {
      await register(name.trim(), email.trim(), password);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Registration failed. Please try again.';
      Alert.alert('Registration failed', msg);
    }
  }

  function field(
    key: string,
    label: string,
    icon: React.ComponentProps<typeof Ionicons>['name'],
    value: string,
    onChange: (v: string) => void,
    opts: {
      placeholder: string;
      secure?: boolean;
      showToggle?: boolean;
      onToggle?: () => void;
      keyboardType?: React.ComponentProps<typeof TextInput>['keyboardType'];
      autoComplete?: React.ComponentProps<typeof TextInput>['autoComplete'];
      returnKeyType?: React.ComponentProps<typeof TextInput>['returnKeyType'];
      onSubmit?: () => void;
      error?: string;
    }
  ) {
    const isFocused = focusedField === key;
    const hasError = !!opts.error;
    return (
      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: textSecondary }]}>{label}</Text>
        <View
          style={[
            styles.inputWrap,
            {
              backgroundColor: inputBg,
              borderColor: hasError ? '#FF6584' : isFocused ? '#6C63FF' : borderColor,
            },
          ]}>
          <Ionicons
            name={icon}
            size={18}
            color={isFocused ? '#6C63FF' : textSecondary}
            style={styles.inputIcon}
          />
          <TextInput
            style={[styles.input, { color: textPrimary }]}
            value={value}
            onChangeText={v => {
              onChange(v);
              setErrors(prev => ({ ...prev, [key]: undefined }));
            }}
            onFocus={() => setFocusedField(key)}
            onBlur={() => setFocusedField(null)}
            placeholder={opts.placeholder}
            placeholderTextColor={textSecondary}
            secureTextEntry={opts.secure && !opts.showToggle ? true : opts.secure ? !opts.showToggle : false}
            keyboardType={opts.keyboardType}
            autoCapitalize={key === 'name' ? 'words' : 'none'}
            autoComplete={opts.autoComplete}
            returnKeyType={opts.returnKeyType ?? 'next'}
            onSubmitEditing={opts.onSubmit}
          />
          {opts.onToggle && (
            <Pressable onPress={opts.onToggle} style={styles.eyeBtn}>
              <Ionicons
                name={opts.showToggle ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={textSecondary}
              />
            </Pressable>
          )}
        </View>
        {opts.error ? <Text style={styles.errorText}>{opts.error}</Text> : null}
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* Brand */}
          <View style={styles.brand}>
            <View style={styles.logoWrap}>
              <Ionicons name="wallet" size={36} color="#FFFFFF" />
            </View>
            <Text style={[styles.appName, { color: textPrimary }]}>Donrashi</Text>
            <Text style={[styles.appTagline, { color: textSecondary }]}>
              Start tracking your finances
            </Text>
          </View>

          {/* Card */}
          <View style={[styles.card, { backgroundColor: cardBg }]}>
            <Text style={[styles.cardTitle, { color: textPrimary }]}>Create account</Text>
            <Text style={[styles.cardSubtitle, { color: textSecondary }]}>
              Join Donrashi for free
            </Text>

            {field('name', 'Full Name', 'person-outline', name, setName, {
              placeholder: 'John Doe',
              autoComplete: 'name',
              error: errors.name,
            })}

            {field('email', 'Email', 'mail-outline', email, setEmail, {
              placeholder: 'you@example.com',
              keyboardType: 'email-address',
              autoComplete: 'email',
              error: errors.email,
            })}

            {field('password', 'Password', 'lock-closed-outline', password, setPassword, {
              placeholder: '••••••••',
              secure: true,
              showToggle: showPassword,
              onToggle: () => setShowPassword(v => !v),
              autoComplete: 'new-password',
              error: errors.password,
            })}

            {field(
              'confirmPassword',
              'Confirm Password',
              'shield-checkmark-outline',
              confirmPassword,
              setConfirmPassword,
              {
                placeholder: '••••••••',
                secure: true,
                showToggle: showConfirm,
                onToggle: () => setShowConfirm(v => !v),
                autoComplete: 'new-password',
                returnKeyType: 'done',
                onSubmit: handleRegister,
                error: errors.confirmPassword,
              }
            )}

            {/* Password hint */}
            <View style={styles.hintRow}>
              <Ionicons name="information-circle-outline" size={14} color={textSecondary} />
              <Text style={[styles.hintText, { color: textSecondary }]}>
                Password must be at least 8 characters
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
              onPress={handleRegister}
              disabled={isLoading}
              activeOpacity={0.85}>
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: textSecondary }]}>
              Already have an account?{' '}
            </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Sign in</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 24,
  },

  brand: { alignItems: 'center', gap: 8 },
  logoWrap: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: '#6C63FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  appName: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  appTagline: { fontSize: 14 },

  card: {
    borderRadius: 24,
    padding: 24,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  cardTitle: { fontSize: 22, fontWeight: '800' },
  cardSubtitle: { fontSize: 14, marginTop: -8 },

  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', marginLeft: 2 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15 },
  eyeBtn: { padding: 4 },
  errorText: { color: '#FF6584', fontSize: 12, marginLeft: 2 },

  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -4 },
  hintText: { fontSize: 12 },

  submitBtn: {
    backgroundColor: '#6C63FF',
    borderRadius: 14,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: { fontSize: 14 },
  footerLink: { fontSize: 14, fontWeight: '700', color: '#6C63FF' },
});
