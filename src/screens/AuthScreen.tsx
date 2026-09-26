import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors, shadows } from '@/src/constants/theme';
import { signInWithPassword, signUpWithPassword } from '@/src/services/auth';
import { isSupabaseConfigured } from '@/src/services/supabase';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function AuthScreen() {
  const [mode, setMode] = React.useState<'signIn' | 'signUp'>('signIn');
  const [fullName, setFullName] = React.useState('');
  const [studentId, setStudentId] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const submit = async () => {
    setErrorMessage(null);
    setMessage(null);

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedStudentId = studentId.trim().toUpperCase().replace(/\s+/g, '');
    const normalizedName = fullName.trim();

    if (!isValidEmail(normalizedEmail)) {
      setErrorMessage('Enter a valid email address.');
      return;
    }

    if (!normalizedEmail.endsWith('@vku.udn.vn')) {
      setErrorMessage('Please use your VKU email address ending in @vku.udn.vn.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must contain at least 8 characters.');
      return;
    }

    if (mode === 'signUp') {
      if (normalizedName.length < 2) {
        setErrorMessage('Enter your full name.');
        return;
      }

      if (!/^[A-Z0-9]{3,20}$/.test(normalizedStudentId)) {
        setErrorMessage('Student ID must be 3–20 letters or numbers.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'signIn') {
        await signInWithPassword(normalizedEmail, password);
        return;
      }

      await signUpWithPassword({
        email: normalizedEmail,
        password,
        fullName: normalizedName,
        studentId: normalizedStudentId,
      });

      setMessage('Account created successfully. You are now signed in.');
      setPassword('');
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Authentication failed.',
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <View style={styles.configScreen}>
        <Ionicons color={colors.primary} name="cloud-offline-outline" size={46} />
        <Text style={styles.configTitle}>Backend configuration required</Text>
        <Text style={styles.configText}>
          Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to the app environment before signing in.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.safeArea}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.logo}>
          <Ionicons color={colors.surface} name="library-outline" size={30} />
        </View>
        <Text style={styles.brand}>VKU StudySpace</Text>
        <Text style={styles.title}>
          {mode === 'signIn' ? 'Welcome back' : 'Create your student account'}
        </Text>
        <Text style={styles.subtitle}>
          {mode === 'signIn'
            ? 'Sign in to reserve study rooms and manage your booking passes.'
            : 'Create an account with your VKU email and start booking immediately.'}
        </Text>

        <View style={styles.form}>
          {mode === 'signUp' && (
            <>
              <Text style={styles.label}>Full name</Text>
              <TextInput
                autoCapitalize="words"
                editable={!loading}
                onChangeText={setFullName}
                placeholder="Nguyen Van A"
                placeholderTextColor="#98A1B4"
                style={styles.input}
                value={fullName}
              />

              <Text style={styles.label}>Student ID</Text>
              <TextInput
                autoCapitalize="characters"
                editable={!loading}
                onChangeText={setStudentId}
                placeholder="23IT123"
                placeholderTextColor="#98A1B4"
                style={styles.input}
                value={studentId}
              />
            </>
          )}

          <Text style={styles.label}>VKU email</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            editable={!loading}
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="23it123@vku.udn.vn"
            placeholderTextColor="#98A1B4"
            style={styles.input}
            value={email}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="password"
            editable={!loading}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            placeholderTextColor="#98A1B4"
            secureTextEntry
            style={styles.input}
            value={password}
          />

          {message && <Text style={styles.success}>{message}</Text>}
          {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

          <Pressable
            disabled={loading}
            onPress={() => void submit()}
            style={({ pressed }) => [
              styles.primaryButton,
              loading && styles.disabled,
              pressed && !loading && styles.pressed,
            ]}
          >
            {loading ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={styles.primaryButtonText}>
                {mode === 'signIn' ? 'Sign in' : 'Create account'}
              </Text>
            )}
          </Pressable>

          <Pressable
            disabled={loading}
            onPress={() => {
              setErrorMessage(null);
              setMessage(null);
              setMode(mode === 'signIn' ? 'signUp' : 'signIn');
            }}
            style={styles.switchButton}
          >
            <Text style={styles.switchText}>
              {mode === 'signIn'
                ? 'New student? Create an account'
                : 'Already have an account? Sign in'}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.securityNote}>
          Basic form validation is handled in the app. Booking ownership is still tied to your authenticated Supabase user.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.page,
    flex: 1,
  },
  configScreen: {
    alignItems: 'center',
    backgroundColor: colors.page,
    flex: 1,
    justifyContent: 'center',
    padding: 28,
  },
  configTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 15,
    textAlign: 'center',
  },
  configText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
    maxWidth: 420,
    textAlign: 'center',
  },
  container: {
    alignItems: 'center',
    minHeight: '100%',
    paddingHorizontal: 22,
    paddingVertical: 40,
  },
  logo: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 20,
    height: 66,
    justifyContent: 'center',
    width: 66,
    ...shadows.card,
  },
  brand: {
    color: colors.primaryDark,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 13,
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '900',
    marginTop: 23,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    maxWidth: 470,
    textAlign: 'center',
  },
  form: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    marginTop: 24,
    maxWidth: 470,
    padding: 18,
    width: '100%',
    ...shadows.card,
  },
  label: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
    marginTop: 13,
  },
  input: {
    backgroundColor: colors.page,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 14,
    minHeight: 48,
    paddingHorizontal: 13,
  },
  success: {
    color: colors.success,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 13,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 13,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 13,
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '900',
  },
  switchButton: {
    alignItems: 'center',
    marginTop: 14,
    padding: 8,
  },
  switchText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  securityNote: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 18,
    maxWidth: 470,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.78,
  },
});
