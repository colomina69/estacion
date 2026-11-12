import { create } from 'zustand';

import { getHistorySeries } from '../db/database';
import type { HistoryPoint, HistoryRange } from '../types/weather';

interface HistoryState {
  range: HistoryRange;
  points: HistoryPoint[];
  loading: boolean;
  error: string | null;
  loadedRange: HistoryRange | null;
  setRange: (range: HistoryRange) => void;
  load: (range?: HistoryRange) => Promise<void>;
  refresh: () => Promise<void>;
}

let requestToken = 0;

export const useHistoryStore = create<HistoryState>((set, get) => ({
  range: '24h',
  points: [],
  loading: false,
  error: null,
  loadedRange: null,

  setRange: (range) => {
    set({ range });
    void get().load(range);
  },

  load: async (range) => {
    const target = range ?? get().range;
    const token = ++requestToken;
    set({ loading: true, error: null, range: target });
    try {
      const points = await getHistorySeries(target);
      if (token !== requestToken) return;
      set({ points, loading: false, loadedRange: target });
    } catch (error) {
      if (token !== requestToken) return;
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'No se pudo cargar el histórico',
      });
    }
  },

  refresh: async () => {
    await get().load(get().range);
  },
}));
