import type { Reading } from '../types/weather';

export type ParseResult =
  | { ok: true; reading: Reading }
  | { ok: false; error: string };

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseStationTime(value: string | null): number | null {
  if (!value) return null;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  const time = date.getTime();
  return Number.isFinite(time) ? time : null;
}

export function parseStationPayload(raw: string): ParseResult {
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'JSON inválido' };
  }

  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return { ok: false, error: 'El payload no es un objeto JSON' };
  }

  const data = payload as Record<string, unknown>;
  const stationTime = toStringValue(data.time);
  const mic = toStringValue(data.mic);

  const reading: Reading = {
    receivedAt: Date.now(),
    stationTime,
    stationTimeMs: parseStationTime(stationTime),
    model: toStringValue(data.model),
    stationId: toNumber(data.id),
    channel: toNumber(data.channel),
    batteryOk: toNumber(data.battery_ok),
    temperatureC: toNumber(data.temperature_C),
    humidity: toNumber(data.humidity),
    windAvgKmh: toNumber(data.wind_avg_km_h),
    windMaxKmh: toNumber(data.wind_max_km_h),
    windDirDeg: toNumber(data.wind_dir_deg),
    rainMm: toNumber(data.rain_mm),
    rainDeltaMm: null,
    uvi: toNumber(data.uvi),
    lightLux: toNumber(data.light_lux),
    mic,
    micValid: mic === null || mic.toUpperCase() === 'CHECKSUM',
    rawJson: raw,
  };

  const hasMetrics = [
    reading.temperatureC,
    reading.humidity,
    reading.windAvgKmh,
    reading.windMaxKmh,
    reading.rainMm,
    reading.uvi,
    reading.lightLux,
  ].some((value) => value !== null);

  if (!hasMetrics) {
    return { ok: false, error: 'Payload sin métricas meteorológicas' };
  }

  return { ok: true, reading };
}
