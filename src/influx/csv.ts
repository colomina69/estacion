import type { HistoryPoint } from '../types/weather';

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (inQuotes) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char ?? '';
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(current);
      current = '';
    } else {
      current += char ?? '';
    }
  }

  fields.push(current);
  return fields;
}

function toNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseInfluxCsv(csv: string): HistoryPoint[] {
  const lines = csv
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '' && !line.startsWith('#'));

  const headerIndex = lines.findIndex((line) =>
    parseCsvLine(line).includes('_time'),
  );
  if (headerIndex === -1) return [];

  const header = parseCsvLine(lines[headerIndex] ?? '').map((value) =>
    value.trim(),
  );
  const column = (name: string) => header.indexOf(name);
  const timeIndex = column('_time');
  if (timeIndex === -1) return [];

  const temperatureIndex = column('temperature');
  const humidityIndex = column('humidity');
  const windAvgIndex = column('wind_avg_km_h');
  const windMaxIndex = column('wind_max_km_h');
  const rainIndex = column('rain_mm');
  const uviIndex = column('uvi');
  const lightIndex = column('light_lux');

  const byTime = new Map<number, HistoryPoint>();
  let previousRain: number | null = null;

  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const columns = parseCsvLine(lines[index] ?? '');
    const timeRaw = columns[timeIndex];
    if (!timeRaw || timeRaw === '_time') continue;

    const t = Date.parse(timeRaw);
    if (!Number.isFinite(t)) continue;

    const rainMm = rainIndex >= 0 ? toNumber(columns[rainIndex]) : null;
    let rainDeltaMm: number | null = null;
    if (rainMm !== null) {
      if (previousRain === null) {
        rainDeltaMm = 0;
      } else if (rainMm < previousRain) {
        rainDeltaMm = rainMm;
      } else {
        rainDeltaMm = rainMm - previousRain;
      }
      previousRain = rainMm;
    }

    const point: HistoryPoint = {
      t,
      temperatureC:
        temperatureIndex >= 0 ? toNumber(columns[temperatureIndex]) : null,
      humidity: humidityIndex >= 0 ? toNumber(columns[humidityIndex]) : null,
      windAvgKmh: windAvgIndex >= 0 ? toNumber(columns[windAvgIndex]) : null,
      windMaxKmh: windMaxIndex >= 0 ? toNumber(columns[windMaxIndex]) : null,
      rainMm,
      rainDeltaMm,
      uvi: uviIndex >= 0 ? toNumber(columns[uviIndex]) : null,
      lightLux: lightIndex >= 0 ? toNumber(columns[lightIndex]) : null,
    };

    const existing = byTime.get(t);
    if (existing) {
      byTime.set(t, {
        t,
        temperatureC: existing.temperatureC ?? point.temperatureC,
        humidity: existing.humidity ?? point.humidity,
        windAvgKmh: existing.windAvgKmh ?? point.windAvgKmh,
        windMaxKmh: existing.windMaxKmh ?? point.windMaxKmh,
        rainMm: existing.rainMm ?? point.rainMm,
        rainDeltaMm: existing.rainDeltaMm ?? point.rainDeltaMm,
        uvi: existing.uvi ?? point.uvi,
        lightLux: existing.lightLux ?? point.lightLux,
      });
    } else {
      byTime.set(t, point);
    }
  }

  return Array.from(byTime.values()).sort((a, b) => a.t - b.t);
}
