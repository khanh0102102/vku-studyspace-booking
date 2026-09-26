import AsyncStorage from '@react-native-async-storage/async-storage';
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
import {
  resendSignupConfirmation,
  signInWithPassword,
  signUpWithPassword,
} from '@/src/services/auth';
import { isSupabaseConfigured } from '@/src/services/supabase';

const EMAIL_COOLDOWN_SECONDS = 60;
const EMAIL_COOLDOWN_KEY = 'vku-studyspace-email-verification-cooldown';

function isRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const normalized = error.message.toLowerCase();
  return (
    normalized.includes('rate limit') ||
    normalized.includes('too many') ||
    normalized.includes('over_email_send_rate_limit')
  );
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
  const [verificationEmail, setVerificationEmail] = React.useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = React.useState(0);

  React.useEffect(() => {
    if (cooldownSeconds <= 0) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      setCooldownSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearInterval(intervalId);
  }, [cooldownSeconds]);

  React.useEffect(() => {
    if (!email.trim()) {
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    void AsyncStorage.getItem(EMAIL_COOLDOWN_KEY + ':' + normalizedEmail).then((value) => {
      const expiresAt = Number(value ?? 0);
      const remaining = Math.max(
        0,
        Math.ceil((expiresAt - Date.now()) / 1000),
      );
      if (remaining > 0) {
        setCooldownSeconds(remaining);
      }
    });
  }, [email]);

  const startEmailCooldown = React.useCallback(async (targetEmail: string) => {
    const expiresAt = Date.now() + EMAIL_COOLDOWN_SECONDS * 1000;
    setCooldownSeconds(EMAIL_COOLDOWN_SECONDS);
    await AsyncStorage.setItem(
      EMAIL_COOLDOWN_KEY + ':' + targetEmail,
      String(expiresAt),
    );
  }, []);

  const submit = async () => {
    setErrorMessage(null);
    setMessage(null);

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedStudentId = studentId.trim().toUpperCase();
    const normalizedName = fullName.trim();

    if (!normalizedEmail.endsWith('@vku.udn.vn')) {
      setErrorMessage('Please use your VKU email address ending in @vku.udn.vn.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must contain at least 8 characters.');
      return;
    }

    if (
      mode === 'signUp' &&
      (normalizedName.length < 2 || normalizedStudentId.length < 3)
    ) {
      setErrorMessage('Enter your full name and VKU student ID to create the account.');
      return;
    }

    if (mode === 'signUp' && cooldownSeconds > 0) {
      setErrorMessage(
        'Please wait ' + cooldownSeconds + 's before requesting another verification email.',
      );
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signIn') {
        await signInWithPassword(normalizedEmail, password);
        setVerificationEmail(null);
        setCooldownSeconds(0);
      } else {
        const result = await signUpWithPassword({
          email: normalizedEmail,
          password,
          fullName: normalizedName,
          studentId: normalizedStudentId,
        });

        if (result.needsEmailConfirmation) {
          setVerificationEmail(normalizedEmail);
          await startEmailCooldown(normalizedEmail);
          setMessage(
            'Account created. Check your VKU email, confirm the address, then sign in.',
          );
          setMode('signIn');
          setPassword('');
        }
      }
    } catch (error) {
      if (isRateLimitError(error)) {
        await startEmailCooldown(normalizedEmail);
        setErrorMessage(
          'Verification emails are being rate-limited. Please wait before trying again.',
        );
      } else {
        setErrorMessage(
          error instanceof Error ? error.message : 'Authentication failed.',
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const resendVerification = async () => {
    if (!verificationEmail || loading || cooldownSeconds > 0) {
      return;
    }

    setErrorMessage(null);
    setMessage(null);
    setLoading(true);

    try {
      await resendSignupConfirmation(verificationEmail);
      await startEmailCooldown(verificationEmail);
      setMessage(
        'A new verification email was sent. Please check Inbox and Spam.',
      );
    } catch (error) {
      if (isRateLimitError(error)) {
        await startEmailCooldown(verificationEmail);
        setErrorMessage(
          'Too many verification requests. Please wait before trying again.',
        );
      } else {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Could not resend the verification email.',
        );
      }
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
            : 'Use your VKU email so reservations belong to your account on every device.'}
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
            disabled={loading || (mode === 'signUp' && cooldownSeconds > 0)}
            onPress={() => void submit()}
            style={({ pressed }) => [
              styles.primaryButton,
              (loading || (mode === 'signUp' && cooldownSeconds > 0)) && styles.disabled,
              pressed && !loading && styles.pressed,
            ]}
          >
            {loading ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={styles.primaryButtonText}>
                {mode === 'signIn'
                  ? 'Sign in'
                  : cooldownSeconds > 0
                    ? 'Try again in ' + cooldownSeconds + 's'
                    : 'Create account'}
              </Text>
            )}
          </Pressable>

          {verificationEmail && mode === 'signIn' && (
            <View style={styles.verifyPanel}>
              <View style={styles.verifyHeader}>
                <Ionicons color={colors.primary} name="mail-outline" size={20} />
                <Text style={styles.verifyTitle}>Verification email</Text>
              </View>
              <Text style={styles.verifyEmail}>{verificationEmail}</Text>
              <Text style={styles.verifyHint}>
                Confirm your email before signing in. Check Spam if the message is missing.
              </Text>
              <Pressable
                disabled={loading || cooldownSeconds > 0}
                onPress={() => void resendVerification()}
                style={({ pressed }) => [
                  styles.resendButton,
                  (loading || cooldownSeconds > 0) && styles.disabled,
                  pressed && cooldownSeconds === 0 && styles.pressed,
                ]}
              >
                <Text style={styles.resendText}>
                  {cooldownSeconds > 0
                    ? 'Resend available in ' + cooldownSeconds + 's'
                    : 'Resend verification email'}
                </Text>
              </Pressable>
            </View>
          )}

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
          Booking ownership is tied to your authenticated Supabase user and enforced by the database.
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
  verifyPanel: {
    backgroundColor: colors.page,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 16,
    padding: 13,
  },
  verifyHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  verifyTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  verifyEmail: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 7,
  },
  verifyHint: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 6,
  },
  resendButton: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 11,
    minHeight: 42,
    justifyContent: 'center',
  },
  resendText: {
    color: colors.primary,
    fontSize: 12,
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
