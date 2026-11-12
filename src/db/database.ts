import * as SQLite from 'expo-sqlite';

import { DB_NAME } from '../config/defaults';
import type { HistoryPoint, HistoryRange, Reading } from '../types/weather';

interface ReadingRow {
  id: number;
  received_at: number;
  station_time: string | null;
  station_time_ms: number | null;
  model: string | null;
  station_id: number | null;
  channel: number | null;
  battery_ok: number | null;
  temperature_c: number | null;
  humidity: number | null;
  wind_avg_kmh: number | null;
  wind_max_kmh: number | null;
  wind_dir_deg: number | null;
  rain_mm: number | null;
  rain_delta_mm: number | null;
  uvi: number | null;
  light_lux: number | null;
  mic: string | null;
  mic_valid: number | null;
  raw_json: string;
}

interface HistoryRow {
  bucket: number;
  temperature_c: number | null;
  humidity: number | null;
  wind_avg_kmh: number | null;
  wind_max_kmh: number | null;
  rain_mm: number | null;
  rain_delta_mm: number | null;
  uvi: number | null;
  light_lux: number | null;
}

export const HISTORY_RANGES: Record<
  HistoryRange,
  { durationMs: number; bucketMs: number; label: string }
> = {
  '1h': { durationMs: 60 * 60 * 1000, bucketMs: 60 * 1000, label: '1 h' },
  '24h': {
    durationMs: 24 * 60 * 60 * 1000,
    bucketMs: 5 * 60 * 1000,
    label: '24 h',
  },
  '7d': {
    durationMs: 7 * 24 * 60 * 60 * 1000,
    bucketMs: 30 * 60 * 1000,
    label: '7 d',
  },
};

let database: SQLite.SQLiteDatabase | null = null;
let opening: Promise<SQLite.SQLiteDatabase> | null = null;

export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (database) return database;
  if (opening) return opening;

  opening = (async () => {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;

      CREATE TABLE IF NOT EXISTS readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        received_at INTEGER NOT NULL,
        station_time TEXT,
        station_time_ms INTEGER,
        model TEXT,
        station_id INTEGER,
        channel INTEGER,
        battery_ok INTEGER,
        temperature_c REAL,
        humidity REAL,
        wind_avg_kmh REAL,
        wind_max_kmh REAL,
        wind_dir_deg INTEGER,
        rain_mm REAL,
        rain_delta_mm REAL,
        uvi REAL,
        light_lux REAL,
        mic TEXT,
        mic_valid INTEGER,
        raw_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_readings_received_at
        ON readings (received_at);

      CREATE TABLE IF NOT EXISTS alert_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fired_at INTEGER NOT NULL,
        type TEXT NOT NULL,
        value REAL,
        threshold REAL,
        message TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_alert_type_fired
        ON alert_events (type, fired_at);
    `);
    database = db;
    return db;
  })();

  try {
    return await opening;
  } finally {
    opening = null;
  }
}

function rowToReading(row: ReadingRow): Reading {
  return {
    id: row.id,
    receivedAt: row.received_at,
    stationTime: row.station_time,
    stationTimeMs: row.station_time_ms,
    model: row.model,
    stationId: row.station_id,
    channel: row.channel,
    batteryOk: row.battery_ok,
    temperatureC: row.temperature_c,
    humidity: row.humidity,
    windAvgKmh: row.wind_avg_kmh,
    windMaxKmh: row.wind_max_kmh,
    windDirDeg: row.wind_dir_deg,
    rainMm: row.rain_mm,
    rainDeltaMm: row.rain_delta_mm,
    uvi: row.uvi,
    lightLux: row.light_lux,
    mic: row.mic,
    micValid: row.mic_valid !== 0,
    rawJson: row.raw_json,
  };
}

export async function insertReading(reading: Reading): Promise<number> {
  const db = await initDatabase();
  const result = await db.runAsync(
    `INSERT INTO readings (
      received_at, station_time, station_time_ms, model, station_id, channel,
      battery_ok, temperature_c, humidity, wind_avg_kmh, wind_max_kmh,
      wind_dir_deg, rain_mm, rain_delta_mm, uvi, light_lux, mic, mic_valid,
      raw_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    reading.receivedAt,
    reading.stationTime,
    reading.stationTimeMs,
    reading.model,
    reading.stationId,
    reading.channel,
    reading.batteryOk,
    reading.temperatureC,
    reading.humidity,
    reading.windAvgKmh,
    reading.windMaxKmh,
    reading.windDirDeg,
    reading.rainMm,
    reading.rainDeltaMm,
    reading.uvi,
    reading.lightLux,
    reading.mic,
    reading.micValid ? 1 : 0,
    reading.rawJson,
  );
  return result.lastInsertRowId;
}

export async function getLatestReading(): Promise<Reading | null> {
  const db = await initDatabase();
  const row = await db.getFirstAsync<ReadingRow>(
    'SELECT * FROM readings ORDER BY received_at DESC LIMIT 1',
  );
  return row ? rowToReading(row) : null;
}

export async function getReadingsSince(since: number): Promise<Reading[]> {
  const db = await initDatabase();
  const rows = await db.getAllAsync<ReadingRow>(
    'SELECT * FROM readings WHERE received_at >= ? ORDER BY received_at ASC',
    since,
  );
  return rows.map(rowToReading);
}

export async function getHistorySeries(range: HistoryRange): Promise<HistoryPoint[]> {
  const db = await initDatabase();
  const { durationMs, bucketMs } = HISTORY_RANGES[range];
  const since = Date.now() - durationMs;

  const rows = await db.getAllAsync<HistoryRow>(
    `SELECT
       (received_at / ?) * ? AS bucket,
       AVG(temperature_c) AS temperature_c,
       AVG(humidity) AS humidity,
       AVG(wind_avg_kmh) AS wind_avg_kmh,
       MAX(wind_max_kmh) AS wind_max_kmh,
       MAX(rain_mm) AS rain_mm,
       SUM(rain_delta_mm) AS rain_delta_mm,
       AVG(uvi) AS uvi,
       AVG(light_lux) AS light_lux
     FROM readings
     WHERE received_at >= ?
     GROUP BY bucket
     ORDER BY bucket ASC`,
    bucketMs,
    bucketMs,
    since,
  );

  return rows.map((row) => ({
    t: row.bucket,
    temperatureC: row.temperature_c,
    humidity: row.humidity,
    windAvgKmh: row.wind_avg_kmh,
    windMaxKmh: row.wind_max_kmh,
    rainMm: row.rain_mm,
    rainDeltaMm: row.rain_delta_mm,
    uvi: row.uvi,
    lightLux: row.light_lux,
  }));
}

export async function purgeOldReadings(retentionDays: number): Promise<void> {
  const db = await initDatabase();
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  await db.runAsync('DELETE FROM readings WHERE received_at < ?', cutoff);
  await db.runAsync('DELETE FROM alert_events WHERE fired_at < ?', cutoff);
}

export async function clearReadings(): Promise<void> {
  const db = await initDatabase();
  await db.execAsync('DELETE FROM readings; DELETE FROM alert_events;');
}

export async function countReadings(): Promise<number> {
  const db = await initDatabase();
  const row = await db.getFirstAsync<{ total: number }>(
    'SELECT COUNT(*) AS total FROM readings',
  );
  return row?.total ?? 0;
}

export async function wasAlertRecently(
  type: string,
  withinMs: number,
): Promise<boolean> {
  const db = await initDatabase();
  const row = await db.getFirstAsync<{ fired_at: number }>(
    'SELECT fired_at FROM alert_events WHERE type = ? ORDER BY fired_at DESC LIMIT 1',
    type,
  );
  if (!row) return false;
  return Date.now() - row.fired_at < withinMs;
}

export async function recordAlert(
  type: string,
  value: number | null,
  threshold: number | null,
  message: string,
): Promise<void> {
  const db = await initDatabase();
  await db.runAsync(
    'INSERT INTO alert_events (fired_at, type, value, threshold, message) VALUES (?, ?, ?, ?, ?)',
    Date.now(),
    type,
    value,
    threshold,
    message,
  );
}
