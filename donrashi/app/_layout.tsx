import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AuthProvider } from '@/context/AuthContext';
import { CurrencyProvider } from '@/context/CurrencyContext';

export const unstable_settings = {
  anchor: '(auth)',
};

export default function RootLayout() {
  return (
    <AuthProvider>
      <CurrencyProvider>
        <Stack>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="add-transaction"
            options={{ presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen
            name="transfer"
            options={{ presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen
            name="transaction-detail"
            options={{ presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </CurrencyProvider>
    </AuthProvider>
  );
}
