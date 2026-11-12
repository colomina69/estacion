import { create } from 'zustand';

import type { RainStats } from '../lib/rain';
import type { ConnectionState } from '../mqtt/client';
import type { Reading } from '../types/weather';

interface WeatherState {
  latest: Reading | null;
  status: ConnectionState;
  statusDetail: string | null;
  error: string | null;
  lastMessageAt: number | null;
  lastParseError: string | null;
  receivedCount: number;
  discardedCount: number;
  rainTodayMm: number;
  rainMaxRateMmH: number | null;
  setStatus: (status: ConnectionState, detail?: string | null) => void;
  setError: (error: string | null) => void;
  setLatest: (reading: Reading | null) => void;
  setRainStats: (stats: RainStats) => void;
  ingest: (reading: Reading) => void;
  noteDiscarded: (reason: string) => void;
  reset: () => void;
}

export const useWeatherStore = create<WeatherState>((set) => ({
  latest: null,
  status: 'idle',
  statusDetail: null,
  error: null,
  lastMessageAt: null,
  lastParseError: null,
  receivedCount: 0,
  discardedCount: 0,
  rainTodayMm: 0,
  rainMaxRateMmH: null,

  setStatus: (status, detail = null) =>
    set((state) => ({
      status,
      statusDetail: detail,
      error: status === 'connected' ? null : state.error,
    })),

  setError: (error) => set({ error }),

  setLatest: (reading) =>
    set({
      latest: reading,
      lastMessageAt: reading?.receivedAt ?? null,
    }),

  setRainStats: (stats) =>
    set({
      rainTodayMm: stats.totalMm,
      rainMaxRateMmH: stats.maxRateMmH,
    }),

  ingest: (reading) =>
    set((state) => ({
      latest: reading,
      lastMessageAt: reading.receivedAt,
      receivedCount: state.receivedCount + 1,
      lastParseError: null,
      error: null,
    })),

  noteDiscarded: (reason) =>
    set((state) => ({
      discardedCount: state.discardedCount + 1,
      lastParseError: reason,
    })),

  reset: () =>
    set({
      latest: null,
      status: 'idle',
      statusDetail: null,
      error: null,
      lastMessageAt: null,
      lastParseError: null,
      receivedCount: 0,
      discardedCount: 0,
      rainTodayMm: 0,
      rainMaxRateMmH: null,
    }),
}));
