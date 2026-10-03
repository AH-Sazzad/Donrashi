import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: {
  name: string;
  title: string;
  icon: IoniconName;
  activeIcon: IoniconName;
}[] = [
  { name: 'index',      title: 'Home',       icon: 'home-outline',            activeIcon: 'home' },
  { name: 'categories', title: 'Categories', icon: 'pricetags-outline',        activeIcon: 'pricetags' },
  { name: 'wallets',    title: 'Wallets',    icon: 'wallet-outline',           activeIcon: 'wallet' },
  { name: 'meal',       title: 'Mess',       icon: 'restaurant-outline',       activeIcon: 'restaurant' },
  { name: 'account',   title: 'Account',    icon: 'person-circle-outline',    activeIcon: 'person-circle' },
];

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const colors      = Colors[colorScheme ?? 'light'];
  const isDark      = colorScheme === 'dark';
  const { token }   = useAuth();

  if (!token) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:   '#6C63FF',
        tabBarInactiveTintColor: isDark ? '#64748B' : '#94A3B8',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF',
          borderTopColor:  isDark ? '#2A2A3E' : '#F0F0F0',
          borderTopWidth: 1,
          height:          Platform.OS === 'ios' ? 88 : 64,
          paddingBottom:   Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 8,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}>
      {TABS.map(tab => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? tab.activeIcon : tab.icon}
                size={24}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
