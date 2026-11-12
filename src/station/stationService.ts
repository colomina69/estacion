import { evaluateOfflineAlert, evaluateReadingAlerts } from '../alerts/evaluate';
import { setupNotifications } from '../alerts/notifications';
import {
  getLatestReading,
  getRainStats,
  initDatabase,
  insertReading,
  purgeOldReadings,
} from '../db/database';
import { rainDelta } from '../lib/derived';
import { effectiveTransport } from '../lib/environment';
import { MqttClient } from '../mqtt/client';
import { parseStationPayload } from '../mqtt/parser';
import { useSettingsStore } from '../store/settingsStore';
import { useWeatherStore } from '../store/weatherStore';
import type { Reading, Settings } from '../types/weather';

class StationService {
  private client = new MqttClient();
  private started = false;
  private monitor: ReturnType<typeof setInterval> | null = null;
  private lastOfflineCheck = 0;
  private rainStatsInFlight = false;
  private rainStatsQueued = false;

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    await initDatabase();
    const settings = await useSettingsStore.getState().load();

    const latest = await getLatestReading();
    if (latest) {
      useWeatherStore.getState().setLatest(latest);
    }
    void purgeOldReadings(settings.retentionDays);

    this.connect(settings);
    this.startMonitor();
    void setupNotifications();
  }

  async restart(): Promise<void> {
    const settings = useSettingsStore.getState().settings;
    await purgeOldReadings(settings.retentionDays);
    this.connect(settings);
  }

  stop(): void {
    this.started = false;
    this.client.disconnect();
    if (this.monitor) {
      clearInterval(this.monitor);
      this.monitor = null;
    }
  }

  async testConnection(
    settings: Settings,
  ): Promise<{ ok: boolean; message: string }> {
    return new Promise((resolve) => {
      let settled = false;
      let timeout: ReturnType<typeof setTimeout> | null = null;
      const testClient = new MqttClient();

      const finish = (ok: boolean, message: string) => {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        testClient.disconnect();
        resolve({ ok, message });
      };

      timeout = setTimeout(() => {
        finish(false, 'Tiempo de espera agotado (12 s).');
      }, 12_000);

      testClient.setHandlers({
        onState: (state, detail) => {
          if (state === 'connected') {
            finish(true, 'Conexión y suscripción correctas.');
          } else if (state === 'error') {
            finish(false, detail ?? 'No se pudo conectar.');
          }
        },
        onError: (message) => finish(false, message),
        onMessage: () => finish(true, 'Conexión y suscripción correctas.'),
      });

      testClient.connect({
        host: settings.host,
        port: settings.port,
        transport: effectiveTransport(settings),
        wsUrl: settings.wsUrl,
        username: settings.username,
        password: settings.password,
        topic: settings.topic,
        clientId: `estacio-test-${Date.now()}`,
      });
    });
  }

  private connect(settings: Settings): void {
    const previous = useWeatherStore.getState();
    const previousLatest = previous.latest;
    const previousRainTodayMm = previous.rainTodayMm;
    const previousRainMaxRateMmH = previous.rainMaxRateMmH;
    useWeatherStore.getState().reset();
    if (previousLatest) {
      useWeatherStore.getState().setLatest(previousLatest);
    }
    useWeatherStore.getState().setRainStats({
      totalMm: previousRainTodayMm,
      maxRateMmH: previousRainMaxRateMmH,
    });
    void this.refreshRainStats();

    this.client.setHandlers({
      onState: (state, detail) => {
        useWeatherStore.getState().setStatus(state, detail ?? null);
      },
      onError: (message) => {
        useWeatherStore.getState().setError(message);
      },
      onMessage: (topic, payload) => {
        void this.handleMessage(topic, payload);
      },
    });

    this.client.connect({
      host: settings.host,
      port: settings.port,
      transport: effectiveTransport(settings),
      wsUrl: settings.wsUrl,
      username: settings.username,
      password: settings.password,
      topic: settings.topic,
      clientId: `estacio-${Math.random().toString(16).slice(2, 10)}`,
    });
  }

  private async handleMessage(topic: string, payload: string): Promise<void> {
    if (!topic || payload.trim() === '') {
      useWeatherStore.getState().noteDiscarded('Mensaje vacío');
      return;
    }

    const result = parseStationPayload(payload);
    if (!result.ok) {
      useWeatherStore.getState().noteDiscarded(result.error);
      return;
    }

    const weather = useWeatherStore.getState();
    const previous = weather.latest;
    const reading: Reading = {
      ...result.reading,
      rainDeltaMm: rainDelta(result.reading.rainMm, previous?.rainMm ?? null),
    };

    useWeatherStore.getState().ingest(reading);
    const settings = useSettingsStore.getState().settings;

    try {
      await insertReading(reading);
      void this.refreshRainStats();
    } catch (error) {
      console.warn('No se pudo guardar la lectura', error);
    }

    try {
      await evaluateReadingAlerts(reading, settings);
    } catch (error) {
      console.warn('No se pudieron evaluar las alertas', error);
    }
  }

  private async refreshRainStats(): Promise<void> {
    if (this.rainStatsInFlight) {
      this.rainStatsQueued = true;
      return;
    }
    this.rainStatsInFlight = true;
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const stats = await getRainStats(startOfDay.getTime());
      useWeatherStore.getState().setRainStats(stats);
    } catch (error) {
      console.warn('No se pudieron calcular las estadísticas de lluvia', error);
    } finally {
      this.rainStatsInFlight = false;
      if (this.rainStatsQueued) {
        this.rainStatsQueued = false;
        void this.refreshRainStats();
      }
    }
  }

  private startMonitor(): void {
    if (this.monitor) return;
    this.monitor = setInterval(() => {
      const now = Date.now();
      if (now - this.lastOfflineCheck < 25_000) return;
      this.lastOfflineCheck = now;
      const settings = useSettingsStore.getState().settings;
      const weather = useWeatherStore.getState();
      if (weather.status !== 'connected') return;
      void evaluateOfflineAlert(weather.lastMessageAt, settings).catch(() => {
        // ignore
      });
    }, 30_000);
  }
}

export const stationService = new StationService();
