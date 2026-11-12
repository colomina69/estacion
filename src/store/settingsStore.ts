import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { DEFAULT_SETTINGS, SETTINGS_KEY } from '../config/defaults';
import type { AlertThresholds, Settings } from '../types/weather';

function isWeb(): boolean {
  return Platform.OS === 'web';
}

async function readStored(): Promise<string | null> {
  if (isWeb()) {
    try {
      return globalThis.localStorage?.getItem(SETTINGS_KEY) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(SETTINGS_KEY);
}

async function writeStored(value: string): Promise<void> {
  if (isWeb()) {
    try {
      globalThis.localStorage?.setItem(SETTINGS_KEY, value);
    } catch {
      // ignore
    }
    return;
  }
  await SecureStore.setItemAsync(SETTINGS_KEY, value);
}

async function deleteStored(): Promise<void> {
  if (isWeb()) {
    try {
      globalThis.localStorage?.removeItem(SETTINGS_KEY);
    } catch {
      // ignore
    }
    return;
  }
  await SecureStore.deleteItemAsync(SETTINGS_KEY);
}

function mergeSettings(stored: Partial<Settings> | null): Settings {
  const port = Number(stored?.port);
  const transport =
    stored?.transport === 'tcp' || stored?.transport === 'ws'
      ? stored.transport
      : DEFAULT_SETTINGS.transport;
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    transport,
    wsUrl:
      typeof stored?.wsUrl === 'string' && stored.wsUrl.length > 0
        ? stored.wsUrl
        : DEFAULT_SETTINGS.wsUrl,
    port: Number.isFinite(port) && port > 0 ? port : DEFAULT_SETTINGS.port,
    thresholds: {
      ...DEFAULT_SETTINGS.thresholds,
      ...(stored?.thresholds ?? {}),
    },
    retentionDays:
      typeof stored?.retentionDays === 'number' && stored.retentionDays > 0
        ? stored.retentionDays
        : DEFAULT_SETTINGS.retentionDays,
  };
}

interface SettingsState {
  settings: Settings;
  loaded: boolean;
  load: () => Promise<Settings>;
  update: (patch: Partial<Settings>) => Promise<void>;
  updateThresholds: (patch: Partial<AlertThresholds>) => Promise<void>;
  reset: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  load: async () => {
    if (get().loaded) return get().settings;
    let parsed: Partial<Settings> | null = null;
    try {
      const raw = await readStored();
      if (raw) parsed = JSON.parse(raw) as Partial<Settings>;
    } catch {
      parsed = null;
    }
    const settings = mergeSettings(parsed);
    set({ settings, loaded: true });
    return settings;
  },

  update: async (patch) => {
    const next: Settings = {
      ...get().settings,
      ...patch,
      thresholds: patch.thresholds
        ? { ...get().settings.thresholds, ...patch.thresholds }
        : get().settings.thresholds,
    };
    set({ settings: next });
    try {
      await writeStored(JSON.stringify(next));
    } catch (error) {
      console.warn('No se pudieron guardar los ajustes', error);
    }
  },

  updateThresholds: async (patch) => {
    const next: Settings = {
      ...get().settings,
      thresholds: { ...get().settings.thresholds, ...patch },
    };
    set({ settings: next });
    try {
      await writeStored(JSON.stringify(next));
    } catch (error) {
      console.warn('No se pudieron guardar los umbrales', error);
    }
  },

  reset: async () => {
    set({ settings: DEFAULT_SETTINGS, loaded: true });
    try {
      await deleteStored();
    } catch {
      // ignore
    }
  },
}));
