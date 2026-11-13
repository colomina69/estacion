import { bucketMsForDuration } from '../lib/dateRange.ts';
import type {
  CustomRange,
  HistoryPoint,
  HistoryRange,
  HistorySelection,
  Settings,
} from '../types/weather';
import { parseInfluxCsv } from './csv.ts';

export interface InfluxConfig {
  url: string;
  org: string;
  bucket: string;
  measurement: string;
  device: string;
  token: string;
}

export const INFLUX_RANGES: Record<
  HistoryRange,
  { start: string; window: string; label: string }
> = {
  '1h': { start: '-1h', window: '1m', label: '1 h' },
  '24h': { start: '-24h', window: '5m', label: '24 h' },
  '7d': { start: '-7d', window: '30m', label: '7 días' },
};

export function influxConfigFromSettings(settings: Settings): InfluxConfig {
  return {
    url: settings.influxUrl,
    org: settings.influxOrg,
    bucket: settings.influxBucket,
    measurement: settings.influxMeasurement,
    device: settings.influxDevice,
    token: settings.influxToken,
  };
}

function fluxString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function fluxTime(ms: number): string {
  return `time(v: "${new Date(ms).toISOString()}")`;
}

function stream(
  name: string,
  config: InfluxConfig,
  rangeClause: string,
  window: string,
  field: string,
  aggregate: 'mean' | 'max',
): string {
  const device =
    config.device.trim().length > 0
      ? ` and r.device == ${fluxString(config.device.trim())}`
      : '';
  return `${name} = from(bucket: ${fluxString(config.bucket)})
  |> range(${rangeClause})
  |> filter(fn: (r) => r._measurement == ${fluxString(
    config.measurement,
  )}${device} and r._field == ${fluxString(field)})
  |> aggregateWindow(every: ${window}, fn: ${aggregate}, createEmpty: false)`;
}

export function buildInfluxHistoryQuery(
  config: InfluxConfig,
  range: HistorySelection,
  customRange?: CustomRange | null,
): string {
  let rangeClause: string;
  let window: string;

  if (range === 'custom') {
    if (!customRange) {
      throw new Error('Selecciona una fecha inicial y una fecha final.');
    }
    if (customRange.end <= customRange.start) {
      throw new Error('El rango de fechas no es válido.');
    }
    rangeClause = `start: ${fluxTime(customRange.start)}, stop: ${fluxTime(
      customRange.end,
    )}`;
    window = `${Math.round(
      bucketMsForDuration(customRange.end - customRange.start) / 60_000,
    )}m`;
  } else {
    rangeClause = `start: ${INFLUX_RANGES[range].start}`;
    window = INFLUX_RANGES[range].window;
  }

  return [
    stream('temperature', config, rangeClause, window, 'temperature', 'mean'),
    stream('humidity', config, rangeClause, window, 'humidity', 'mean'),
    stream('windAvg', config, rangeClause, window, 'wind_avg_km_h', 'mean'),
    stream('windMax', config, rangeClause, window, 'wind_max_km_h', 'max'),
    stream('rain', config, rangeClause, window, 'rain_mm', 'max'),
    stream('uvi', config, rangeClause, window, 'uvi', 'mean'),
    stream('lux', config, rangeClause, window, 'light_lux', 'mean'),
    'union(tables: [temperature, humidity, windAvg, windMax, rain, uvi, lux])',
    '  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")',
    '  |> sort(columns: ["_time"])',
  ].join('\n');
}

function validateConfig(config: InfluxConfig): void {
  if (!/^https?:\/\//i.test(config.url)) {
    throw new Error('La URL de InfluxDB debe empezar por http:// o https://.');
  }
  if (!config.org.trim()) throw new Error('Falta la organización de InfluxDB.');
  if (!config.bucket.trim()) throw new Error('Falta el bucket de InfluxDB.');
  if (!config.token.trim()) throw new Error('Falta el token de InfluxDB.');
}

async function queryFlux(
  config: InfluxConfig,
  query: string,
  timeoutMs = 15_000,
): Promise<string> {
  validateConfig(config);
  const base = config.url.replace(/\/+$/, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `${base}/api/v2/query?org=${encodeURIComponent(config.org)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${config.token}`,
          'Content-Type': 'application/vnd.flux',
          Accept: 'application/csv',
        },
        body: query,
        signal: controller.signal,
      },
    );

    const text = await response.text();
    if (!response.ok) {
      let message = text.trim();
      try {
        const parsed = JSON.parse(text) as { message?: string; error?: string };
        message = parsed.message ?? parsed.error ?? message;
      } catch {
        // keep raw text
      }
      if (response.status === 401 || response.status === 403) {
        message = 'Token de InfluxDB inválido o sin permisos.';
      }
      throw new Error(message || `InfluxDB respondió con estado ${response.status}.`);
    }
    return text;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Tiempo de espera agotado al consultar InfluxDB.');
    }
    if (error instanceof TypeError) {
      throw new Error('No se pudo conectar con InfluxDB. Revisa la URL y la red.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function queryInfluxHistory(
  config: InfluxConfig,
  range: HistorySelection,
  customRange?: CustomRange | null,
): Promise<HistoryPoint[]> {
  const csv = await queryFlux(
    config,
    buildInfluxHistoryQuery(config, range, customRange),
  );
  return parseInfluxCsv(csv);
}

export async function testInfluxConnection(
  config: InfluxConfig,
): Promise<{ ok: boolean; message: string }> {
  try {
    await queryFlux(
      config,
      `from(bucket: ${fluxString(config.bucket)})
  |> range(start: -1h)
  |> limit(n: 1)`,
      10_000,
    );
    return { ok: true, message: 'Conexión con InfluxDB correcta.' };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : 'No se pudo conectar con InfluxDB.',
    };
  }
}
