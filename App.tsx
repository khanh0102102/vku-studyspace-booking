import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/src/constants/theme';
import { RootNavigator } from '@/src/navigation/RootNavigator';
import { useBookingStore } from '@/src/store/useBookingStore';

export default function App() {
  const hasHydrated = useBookingStore((state) => state.hasHydrated);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {hasHydrated ? (
        <RootNavigator />
      ) : (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading StudySpace…</Text>
        </View>
      )}
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
