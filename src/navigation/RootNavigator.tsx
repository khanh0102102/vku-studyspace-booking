import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { colors } from '@/src/constants/theme';
import { DiscoverScreen } from '@/src/screens/DiscoverScreen';
import { MyBookingsScreen } from '@/src/screens/MyBookingsScreen';
import { RoomDetailsScreen } from '@/src/screens/RoomDetailsScreen';
import { RootStackParamList } from '@/src/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.page,
    card: colors.surface,
    primary: colors.primary,
    text: colors.ink,
  },
};

export function RootNavigator() {
  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator screenOptions={{ animation: 'slide_from_right', headerShown: false }}>
        <Stack.Screen component={DiscoverScreen} name="Discover" />
        <Stack.Screen component={RoomDetailsScreen} name="RoomDetails" />
        <Stack.Screen component={MyBookingsScreen} name="MyBookings" />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
