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
          <Stack.Screen
            name="meal-book-detail"
            options={{ presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen
            name="meal-book-create"
            options={{ presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen
            name="meal-calendar"
            options={{ presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen
            name="meal-expenses"
            options={{ presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen
            name="meal-deposits"
            options={{ presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen
            name="meal-settlement"
            options={{ presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen
            name="meal-bazar"
            options={{ presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen
            name="meal-activity"
            options={{ presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen
            name="meal-accept-invite"
            options={{ presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen
            name="meal-utilities"
            options={{ presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen
            name="meal-members"
            options={{ presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen
            name="meal-settings"
            options={{ presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen
            name="meal-control-panel"
            options={{ presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen
            name="meal-manager-deposits"
            options={{ presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen
            name="meal-manager-meals"
            options={{ presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen
            name="meal-report"
            options={{ presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </CurrencyProvider>
    </AuthProvider>
  );
}
