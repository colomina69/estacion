import { DEFAULT_SETTINGS } from '../src/config/defaults.ts';
import {
  influxConfigFromSettings,
  queryInfluxHistory,
  testInfluxConnection,
} from '../src/influx/client.ts';

const config = influxConfigFromSettings(DEFAULT_SETTINGS);

console.log(`→ InfluxDB ${config.url} · org ${config.org} · bucket ${config.bucket}`);
const health = await testInfluxConnection(config);
console.log(`${health.ok ? '✔' : '✖'} ${health.message}`);
if (!health.ok) process.exit(1);

for (const range of ['1h', '24h', '7d'] as const) {
  const points = await queryInfluxHistory(config, range);
  const temperatures = points
    .map((point) => point.temperatureC)
    .filter((value): value is number => value !== null);
  const rainTotal = points.reduce(
    (sum, point) => sum + (point.rainDeltaMm ?? 0),
    0,
  );
  const maxWind = points.reduce(
    (max, point) => Math.max(max, point.windMaxKmh ?? 0),
    0,
  );

  if (points.length === 0) {
    console.error(`✖ ${range}: sin datos`);
    process.exit(1);
  }

  console.log(
    `✔ ${range}: ${points.length} puntos · ` +
      `temp ${Math.min(...temperatures).toFixed(1)}…${Math.max(...temperatures).toFixed(1)} °C · ` +
      `viento máx ${maxWind.toFixed(1)} km/h · lluvia ${rainTotal.toFixed(2)} L`,
  );
}

const customEnd = Date.now();
const customStart = customEnd - 3 * 24 * 60 * 60 * 1000;
const customPoints = await queryInfluxHistory(config, 'custom', {
  start: customStart,
  end: customEnd,
});
if (customPoints.length === 0) {
  console.error('✖ Rango personalizado: sin datos');
  process.exit(1);
}
const customRain = customPoints.reduce(
  (sum, point) => sum + (point.rainDeltaMm ?? 0),
  0,
);
console.log(
  `✔ Rango personalizado (3 días): ${customPoints.length} puntos · ` +
    `lluvia ${customRain.toFixed(2)} L`,
);

console.log('✔ Integración InfluxDB correcta');
