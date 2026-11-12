import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { useSettingsStore } from '../store/settingsStore';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primarySoft: string;
  onPrimary: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  chartGrid: string;
  shadow: string;
}

export const lightColors: ThemeColors = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F5F9',
  border: '#E2E8F0',
  text: '#0F172A',
  textMuted: '#64748B',
  primary: '#0EA5E9',
  primarySoft: '#E0F2FE',
  onPrimary: '#FFFFFF',
  success: '#16A34A',
  successSoft: '#DCFCE7',
  warning: '#D97706',
  warningSoft: '#FEF3C7',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  chartGrid: '#E2E8F0',
  shadow: '#0F172A',
};

export const darkColors: ThemeColors = {
  background: '#0B1220',
  surface: '#111A2B',
  surfaceAlt: '#16213A',
  border: '#1E293B',
  text: '#E2E8F0',
  textMuted: '#94A3B8',
  primary: '#38BDF8',
  primarySoft: '#0C4A6E',
  onPrimary: '#0B1220',
  success: '#4ADE80',
  successSoft: '#14532D',
  warning: '#FBBF24',
  warningSoft: '#78350F',
  danger: '#F87171',
  dangerSoft: '#7F1D1D',
  chartGrid: '#1E293B',
  shadow: '#000000',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

interface ThemeValue {
  colors: ThemeColors;
  isDark: boolean;
  scheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeValue>({
  colors: lightColors,
  isDark: false,
  scheme: 'light',
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const preference = useSettingsStore((state) => state.settings.theme);

  const value = useMemo<ThemeValue>(() => {
    const scheme =
      preference === 'system' ? (systemScheme ?? 'light') : preference;
    const isDark = scheme === 'dark';
    return {
      colors: isDark ? darkColors : lightColors,
      isDark,
      scheme,
    };
  }, [preference, systemScheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}
