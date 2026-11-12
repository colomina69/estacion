import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { stationService } from '../src/station/stationService';
import { useSettingsStore } from '../src/store/settingsStore';
import { ThemeProvider, useTheme } from '../src/ui/theme';

void SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { colors, isDark } = useTheme();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await useSettingsStore.getState().load();
        if (active) await stationService.start();
      } finally {
        await SplashScreen.hideAsync();
      }
    })();
    return () => {
      active = false;
      stationService.stop();
    };
  }, []);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootNavigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
