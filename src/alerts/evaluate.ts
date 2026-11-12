import { recordAlert, wasAlertRecently } from '../db/database';
import { formatRelative } from '../lib/time';
import { formatTemperature, formatWind } from '../lib/units';
import type { Reading, Settings } from '../types/weather';
import { sendWeatherAlert } from './notifications';

async function fire(
  type: string,
  value: number | null,
  threshold: number | null,
  title: string,
  body: string,
  cooldownMs: number,
): Promise<void> {
  if (await wasAlertRecently(type, cooldownMs)) return;
  await recordAlert(type, value, threshold, body);
  await sendWeatherAlert(title, body);
}

export async function evaluateReadingAlerts(
  reading: Reading,
  settings: Settings,
): Promise<void> {
  if (!settings.alertsEnabled) return;
  const limits = settings.thresholds;
  const cooldownMs = Math.max(1, limits.cooldownMinutes) * 60 * 1000;

  if (
    reading.windMaxKmh !== null &&
    reading.windMaxKmh >= limits.windMaxKmh
  ) {
    await fire(
      'wind',
      reading.windMaxKmh,
      limits.windMaxKmh,
      'Viento fuerte',
      `Racha de ${formatWind(reading.windMaxKmh, settings.units)} (umbral ${formatWind(limits.windMaxKmh, settings.units)}).`,
      cooldownMs,
    );
  }

  if (
    reading.rainDeltaMm !== null &&
    reading.rainDeltaMm >= limits.rainDeltaMm &&
    reading.rainDeltaMm > 0
  ) {
    await fire(
      'rain',
      reading.rainDeltaMm,
      limits.rainDeltaMm,
      'Lluvia intensa',
      `Se han acumulado ${reading.rainDeltaMm.toFixed(1)} mm desde la última lectura.`,
      cooldownMs,
    );
  }

  if (
    reading.temperatureC !== null &&
    reading.temperatureC >= limits.tempHighC
  ) {
    await fire(
      'temp-high',
      reading.temperatureC,
      limits.tempHighC,
      'Temperatura alta',
      `La estación marca ${formatTemperature(reading.temperatureC, settings.units)}.`,
      cooldownMs,
    );
  }

  if (
    reading.temperatureC !== null &&
    reading.temperatureC <= limits.tempLowC
  ) {
    await fire(
      'temp-low',
      reading.temperatureC,
      limits.tempLowC,
      'Temperatura baja',
      `La estación marca ${formatTemperature(reading.temperatureC, settings.units)}.`,
      cooldownMs,
    );
  }

  if (reading.uvi !== null && reading.uvi >= limits.uvi) {
    await fire(
      'uv',
      reading.uvi,
      limits.uvi,
      'Índice UV alto',
      `Índice UV ${reading.uvi.toFixed(1)}. Protege la piel.`,
      cooldownMs,
    );
  }

  if (limits.battery && reading.batteryOk === 0) {
    await fire(
      'battery',
      reading.batteryOk,
      null,
      'Batería de la estación baja',
      'La estación informa de batería baja.',
      cooldownMs,
    );
  }
}

export async function evaluateOfflineAlert(
  lastMessageAt: number | null,
  settings: Settings,
): Promise<void> {
  if (!settings.alertsEnabled || lastMessageAt === null) return;
  const limits = settings.thresholds;
  const elapsed = Date.now() - lastMessageAt;
  if (elapsed < Math.max(1, limits.offlineMinutes) * 60 * 1000) return;

  const cooldownMs = Math.max(1, limits.cooldownMinutes) * 60 * 1000;
  await fire(
    'offline',
    elapsed,
    limits.offlineMinutes * 60 * 1000,
    'Estación sin datos',
    `${formatRelative(lastMessageAt)} sin recibir datos de la estación.`,
    cooldownMs,
  );
}
