import type { Reading } from '../types/weather';

export function dewPointC(tempC: number | null, humidity: number | null): number | null {
  if (tempC === null || humidity === null || humidity <= 0 || humidity > 100) {
    return null;
  }
  const gamma =
    Math.log(humidity / 100) + (17.62 * tempC) / (243.12 + tempC);
  const dewPoint = (243.12 * gamma) / (17.62 - gamma);
  return Number.isFinite(dewPoint) ? dewPoint : null;
}

export function windChillC(tempC: number | null, windKmh: number | null): number | null {
  if (tempC === null || windKmh === null) return null;
  if (tempC > 10 || windKmh < 4.8) return null;
  const v = Math.pow(windKmh, 0.16);
  return 13.12 + 0.6215 * tempC - 11.37 * v + 0.3965 * tempC * v;
}

export function heatIndexC(tempC: number | null, humidity: number | null): number | null {
  if (tempC === null || humidity === null || tempC < 27) return null;
  const T = (tempC * 9) / 5 + 32;
  const R = humidity;
  const simple =
    -42.379 +
    2.04901523 * T +
    10.14333127 * R -
    0.22475541 * T * R -
    0.00683783 * T * T -
    0.05481717 * R * R +
    0.00122874 * T * T * R +
    0.00085282 * T * R * R -
    0.00000199 * T * T * R * R;
  return ((simple - 32) * 5) / 9;
}

export function feelsLikeC(reading: Reading): number | null {
  const heat = heatIndexC(reading.temperatureC, reading.humidity);
  if (heat !== null) return heat;
  const chill = windChillC(reading.temperatureC, reading.windAvgKmh);
  if (chill !== null) return chill;
  return reading.temperatureC;
}

const CARDINALS: { abbreviation: string; label: string; degrees: number }[] = [
  { abbreviation: 'N', label: 'Norte', degrees: 0 },
  { abbreviation: 'NNE', label: 'Nor-noreste', degrees: 22.5 },
  { abbreviation: 'NE', label: 'Noreste', degrees: 45 },
  { abbreviation: 'ENE', label: 'Este-noreste', degrees: 67.5 },
  { abbreviation: 'E', label: 'Este', degrees: 90 },
  { abbreviation: 'ESE', label: 'Este-sureste', degrees: 112.5 },
  { abbreviation: 'SE', label: 'Sureste', degrees: 135 },
  { abbreviation: 'SSE', label: 'Sur-sureste', degrees: 157.5 },
  { abbreviation: 'S', label: 'Sur', degrees: 180 },
  { abbreviation: 'SSO', label: 'Sur-suroeste', degrees: 202.5 },
  { abbreviation: 'SO', label: 'Suroeste', degrees: 225 },
  { abbreviation: 'OSO', label: 'Oeste-suroeste', degrees: 247.5 },
  { abbreviation: 'O', label: 'Oeste', degrees: 270 },
  { abbreviation: 'ONO', label: 'Oeste-noroeste', degrees: 292.5 },
  { abbreviation: 'NO', label: 'Noroeste', degrees: 315 },
  { abbreviation: 'NNO', label: 'Nor-noroeste', degrees: 337.5 },
];

export function cardinalFromDeg(degrees: number | null): {
  abbreviation: string;
  label: string;
} {
  if (degrees === null || !Number.isFinite(degrees)) {
    return { abbreviation: '—', label: 'Sin dirección' };
  }
  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % 16;
  return CARDINALS[index] ?? CARDINALS[0]!;
}

export type UvLevel = 'low' | 'moderate' | 'high' | 'veryHigh' | 'extreme' | 'none';

export function uvCategory(uvi: number | null): { level: UvLevel; label: string } {
  if (uvi === null || !Number.isFinite(uvi)) return { level: 'none', label: 'Sin dato' };
  if (uvi < 3) return { level: 'low', label: 'Bajo' };
  if (uvi < 6) return { level: 'moderate', label: 'Moderado' };
  if (uvi < 8) return { level: 'high', label: 'Alto' };
  if (uvi < 11) return { level: 'veryHigh', label: 'Muy alto' };
  return { level: 'extreme', label: 'Extremo' };
}

export function luxCategory(lux: number | null): string {
  if (lux === null || !Number.isFinite(lux)) return 'Sin dato';
  if (lux < 10) return 'Oscuro';
  if (lux < 100) return 'Muy nublado';
  if (lux < 1_000) return 'Nublado';
  if (lux < 10_000) return 'Día nublado';
  if (lux < 50_000) return 'Día claro';
  return 'Sol directo';
}

export function rainDelta(current: number | null, previous: number | null): number | null {
  if (current === null || !Number.isFinite(current)) return null;
  if (previous === null || !Number.isFinite(previous)) return 0;
  if (current < previous) return current;
  return Math.max(0, current - previous);
}
