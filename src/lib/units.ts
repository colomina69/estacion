import type { UnitSystem } from '../types/weather';

export function convertTemperature(valueC: number | null, units: UnitSystem): number | null {
  if (valueC === null) return null;
  return units === 'imperial' ? (valueC * 9) / 5 + 32 : valueC;
}

export function convertWind(valueKmh: number | null, units: UnitSystem): number | null {
  if (valueKmh === null) return null;
  return units === 'imperial' ? valueKmh * 0.621371 : valueKmh;
}

export function convertRain(valueMm: number | null, _units: UnitSystem): number | null {
  if (valueMm === null) return null;
  return valueMm;
}

export function temperatureUnit(units: UnitSystem): string {
  return units === 'imperial' ? '°F' : '°C';
}

export function windUnit(units: UnitSystem): string {
  return units === 'imperial' ? 'mph' : 'km/h';
}

export function rainUnit(_units: UnitSystem): string {
  return 'L';
}

export function rainRateUnit(units: UnitSystem): string {
  return `${rainUnit(units)}/h`;
}

export function formatNumber(
  value: number | null,
  digits = 1,
  fallback = '—',
): string {
  if (value === null || !Number.isFinite(value)) return fallback;
  return value.toFixed(digits);
}

export function formatTemperature(
  valueC: number | null,
  units: UnitSystem,
  digits = 1,
): string {
  const value = convertTemperature(valueC, units);
  if (value === null) return '—';
  return `${value.toFixed(digits)}${temperatureUnit(units)}`;
}

export function formatWind(valueKmh: number | null, units: UnitSystem, digits = 1): string {
  const value = convertWind(valueKmh, units);
  if (value === null) return '—';
  return `${value.toFixed(digits)} ${windUnit(units)}`;
}

export function formatRain(valueMm: number | null, units: UnitSystem, digits = 1): string {
  const value = convertRain(valueMm, units);
  if (value === null) return '—';
  return `${value.toFixed(digits)} ${rainUnit(units)}`;
}

export function formatRainRate(
  valueMmH: number | null,
  units: UnitSystem,
  digits = 1,
): string {
  const value = convertRain(valueMmH, units);
  if (value === null) return '—';
  return `${value.toFixed(digits)} ${rainRateUnit(units)}`;
}
