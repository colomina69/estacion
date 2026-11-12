export type UnitSystem = 'metric' | 'imperial';
export type ThemePreference = 'system' | 'light' | 'dark';
export type MqttTransportType = 'tcp' | 'ws';

export interface AlertThresholds {
  windMaxKmh: number;
  rainDeltaMm: number;
  tempHighC: number;
  tempLowC: number;
  uvi: number;
  cooldownMinutes: number;
  offlineMinutes: number;
  battery: boolean;
}

export interface Settings {
  host: string;
  port: number;
  transport: MqttTransportType;
  wsUrl: string;
  username: string;
  password: string;
  topic: string;
  units: UnitSystem;
  theme: ThemePreference;
  retentionDays: number;
  alertsEnabled: boolean;
  thresholds: AlertThresholds;
}

export interface Reading {
  id?: number;
  receivedAt: number;
  stationTime: string | null;
  stationTimeMs: number | null;
  model: string | null;
  stationId: number | null;
  channel: number | null;
  batteryOk: number | null;
  temperatureC: number | null;
  humidity: number | null;
  windAvgKmh: number | null;
  windMaxKmh: number | null;
  windDirDeg: number | null;
  rainMm: number | null;
  rainDeltaMm: number | null;
  uvi: number | null;
  lightLux: number | null;
  mic: string | null;
  micValid: boolean;
  rawJson: string;
}

export interface HistoryPoint {
  t: number;
  temperatureC: number | null;
  humidity: number | null;
  windAvgKmh: number | null;
  windMaxKmh: number | null;
  rainMm: number | null;
  rainDeltaMm: number | null;
  uvi: number | null;
  lightLux: number | null;
}

export type HistoryRange = '1h' | '24h' | '7d';
