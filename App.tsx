import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/src/constants/theme';
import { RootNavigator } from '@/src/navigation/RootNavigator';
import { AuthScreen } from '@/src/screens/AuthScreen';
import {
  getCurrentUserSession,
  getUserSessionFromAuthSession,
} from '@/src/services/auth';
import { supabase } from '@/src/services/supabase';
import { useBookingStore } from '@/src/store/useBookingStore';

export default function App() {
  const hasHydrated = useBookingStore((state) => state.hasHydrated);
  const session = useBookingStore((state) => state.session);
  const setSession = useBookingStore((state) => state.setSession);
  const startRealtime = useBookingStore((state) => state.startRealtime);
  const [authReady, setAuthReady] = React.useState(false);

  React.useEffect(() => {
    if (!hasHydrated) return;

    let active = true;

    const applyCurrentAuthSession = async () => {
      try {
        const nextSession = await getCurrentUserSession();
        if (active) {
          setSession(nextSession);
          setAuthReady(true);
        }
      } catch {
        if (active) {
          setSession(null);
          setAuthReady(true);
        }
      }
    };

    if (!supabase) {
      setSession(null);
      setAuthReady(true);
      return () => {
        active = false;
      };
    }

    void applyCurrentAuthSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, authSession) => {
      if (!active) return;

      if (!authSession) {
        setSession(null);
        setAuthReady(true);
        return;
      }

      setTimeout(() => {
        if (!active) return;

        void getUserSessionFromAuthSession(authSession)
          .then((nextSession) => {
            if (active) {
              setSession(nextSession);
              setAuthReady(true);
            }
          })
          .catch(() => {
            if (active) {
              setSession(null);
              setAuthReady(true);
            }
          });
      }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [hasHydrated, setSession]);

  React.useEffect(() => {
    if (!hasHydrated || !session) return;
    return startRealtime();
  }, [hasHydrated, session, startRealtime]);

  if (!hasHydrated || !authReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Loading StudySpace…</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {session ? <RootNavigator /> : <AuthScreen />}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    backgroundColor: colors.page,
    flex: 1,
    gap: 12,
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
});
