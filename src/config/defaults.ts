import type { Settings } from '../types/weather';

export const APP_NAME = 'Estación Meteorológica';
export const DB_NAME = 'estacio.db';
export const SETTINGS_KEY = 'estacio.settings.v1';

export const DEFAULT_SETTINGS: Settings = {
  host: 'mqtt.benicolo.com',
  port: 1883,
  transport: 'ws',
  wsUrl: 'wss://mqtt.benicolo.com/mqtt',
  username: 'toni',
  password: 'palomo69',
  topic: 'rtl_433/chuwi/events',
  units: 'metric',
  theme: 'system',
  retentionDays: 30,
  alertsEnabled: true,
  historySource: 'influx',
  influxUrl: 'https://influx.benicolo.com',
  influxOrg: 'my-org',
  influxBucket: 'my-bucket',
  influxMeasurement: 'vevor_7in1',
  influxDevice: '7907',
  influxToken:
    'SWQgTMCPktgA74kWJTGxebh_Hp18Hk77IbNOUVESudaSBuFVJp1tq9ewWg9eDGmmZueeJ58IVjMoY3kWAFUL4g==',
  thresholds: {
    windMaxKmh: 40,
    rainDeltaMm: 2,
    tempHighC: 35,
    tempLowC: 2,
    uvi: 8,
    cooldownMinutes: 30,
    offlineMinutes: 10,
    battery: true,
  },
};

export const STALE_AFTER_MS = 5 * 60 * 1000;
