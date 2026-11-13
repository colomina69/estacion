import { create } from 'zustand';

import { getHistorySeries, getHistorySeriesBetween } from '../db/database';
import {
  influxConfigFromSettings,
  queryInfluxHistory,
} from '../influx/client';
import { bucketMsForDuration } from '../lib/dateRange';
import { useSettingsStore } from './settingsStore';
import type {
  CustomRange,
  HistoryPoint,
  HistorySelection,
  HistorySource,
} from '../types/weather';

interface HistoryState {
  range: HistorySelection;
  customRange: CustomRange | null;
  points: HistoryPoint[];
  loading: boolean;
  error: string | null;
  loadedRange: HistorySelection | null;
  source: HistorySource | null;
  setRange: (range: HistorySelection) => void;
  setCustomRange: (range: CustomRange) => void;
  applyCustomRange: (range: CustomRange) => Promise<void>;
  load: (range?: HistorySelection) => Promise<void>;
  refresh: () => Promise<void>;
}

let requestToken = 0;

export const useHistoryStore = create<HistoryState>((set, get) => ({
  range: '24h',
  customRange: null,
  points: [],
  loading: false,
  error: null,
  loadedRange: null,
  source: null,

  setRange: (range) => {
    if (range === 'custom' && !get().customRange) {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const start = new Date();
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      const customRange = { start: start.getTime(), end: end.getTime() };
      set({ range, customRange });
      void get().load('custom');
      return;
    }
    set({ range });
    void get().load(range);
  },

  setCustomRange: (range) => {
    set({ customRange: range });
  },

  applyCustomRange: async (range) => {
    set({ customRange: range });
    await get().load('custom');
  },

  load: async (range) => {
    const target = range ?? get().range;
    const customRange = get().customRange;

    if (target === 'custom' && !customRange) {
      set({
        loading: false,
        error: 'Selecciona una fecha inicial y una fecha final.',
      });
      return;
    }

    const requestId = ++requestToken;
    const settings = useSettingsStore.getState().settings;
    const source = settings.historySource;

    set({ loading: true, error: null, range: target, source });

    try {
      let points: HistoryPoint[];
      if (source === 'influx') {
        points = await queryInfluxHistory(
          influxConfigFromSettings(settings),
          target,
          target === 'custom' ? customRange : null,
        );
      } else if (target === 'custom' && customRange) {
        points = await getHistorySeriesBetween(
          customRange.start,
          customRange.end,
          bucketMsForDuration(customRange.end - customRange.start),
        );
      } else {
        points = await getHistorySeries(
          target === 'custom' ? '24h' : target,
        );
      }

      if (requestId !== requestToken) return;
      set({ points, loading: false, loadedRange: target });
    } catch (error) {
      if (requestId !== requestToken) return;
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo cargar el histórico';
      set({
        loading: false,
        error: source === 'influx' ? `InfluxDB: ${message}` : message,
      });
    }
  },

  refresh: async () => {
    await get().load(get().range);
  },
}));
