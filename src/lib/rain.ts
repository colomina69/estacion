export interface RainReading {
  t: number;
  mm: number | null;
}

export interface RainStats {
  totalMm: number;
  maxRateMmH: number | null;
}

export function summarizeRainReadings(
  readings: RainReading[],
  minElapsedMs = 5_000,
): RainStats {
  let totalMm = 0;
  let maxRateMmH: number | null = readings.length > 0 ? 0 : null;

  for (let index = 0; index < readings.length; index += 1) {
    const reading = readings[index];
    if (!reading) continue;
    const mm = Math.max(0, reading.mm ?? 0);
    if (!Number.isFinite(mm)) continue;
    totalMm += mm;

    if (index === 0 || mm <= 0) continue;
    const previous = readings[index - 1];
    if (!previous) continue;

    const elapsedMs = reading.t - previous.t;
    if (elapsedMs < minElapsedMs) continue;

    const rate = mm / (elapsedMs / 3_600_000);
    if (maxRateMmH === null || rate > maxRateMmH) {
      maxRateMmH = rate;
    }
  }

  return { totalMm, maxRateMmH };
}
