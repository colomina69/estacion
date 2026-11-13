import assert from 'node:assert/strict';

import {
  cardinalFromDeg,
  dewPointC,
  heatIndexC,
  luxCategory,
  rainDelta,
  uvCategory,
  windChillC,
} from '../src/lib/derived.ts';
import {
  INFLUX_RANGES,
  buildInfluxHistoryQuery,
  type InfluxConfig,
} from '../src/influx/client.ts';
import { parseInfluxCsv } from '../src/influx/csv.ts';
import {
  bucketMsForDuration,
  formatDateInput,
  formatDateTimeInput,
  parseCustomRange,
  parseDateInput,
} from '../src/lib/dateRange.ts';
import { summarizeRainReadings } from '../src/lib/rain.ts';
import {
  convertRain,
  convertTemperature,
  convertWind,
  formatRain,
  formatRainRate,
  formatTemperature,
  formatWind,
} from '../src/lib/units.ts';
import { parseStationPayload } from '../src/mqtt/parser.ts';

const sample = {
  time: '2026-11-12 16:03:17',
  model: 'Vevor-7in1',
  id: 7907,
  channel: 0,
  battery_ok: 1,
  temperature_C: 21.3,
  humidity: 46,
  wind_avg_km_h: 2.4001,
  wind_max_km_h: 3.2,
  wind_dir_deg: 322,
  rain_mm: 125.12099,
  uvi: 0,
  light_lux: 5695,
  mic: 'CHECKSUM',
};

const parsed = parseStationPayload(JSON.stringify(sample));
assert.equal(parsed.ok, true);
if (parsed.ok) {
  assert.equal(parsed.reading.model, 'Vevor-7in1');
  assert.equal(parsed.reading.stationId, 7907);
  assert.equal(parsed.reading.temperatureC, 21.3);
  assert.equal(parsed.reading.humidity, 46);
  assert.equal(parsed.reading.windDirDeg, 322);
  assert.equal(parsed.reading.micValid, true);
  assert.notEqual(parsed.reading.stationTimeMs, null);
}

assert.equal(parseStationPayload('{').ok, false);
assert.equal(parseStationPayload('[]').ok, false);
assert.equal(
  parseStationPayload(JSON.stringify({ time: '2026-11-12 16:03:17' })).ok,
  false,
);

const partial = parseStationPayload(JSON.stringify({ temperature_C: 18, humidity: 70 }));
assert.equal(partial.ok, true);
if (partial.ok) {
  assert.equal(partial.reading.uvi, null);
  assert.equal(partial.reading.micValid, true);
  assert.equal(partial.reading.rainMm, null);
}

const invalidMic = parseStationPayload(
  JSON.stringify({ temperature_C: 18, mic: 'BAD' }),
);
assert.equal(invalidMic.ok, true);
if (invalidMic.ok) assert.equal(invalidMic.reading.micValid, false);

assert.equal(cardinalFromDeg(0).abbreviation, 'N');
assert.equal(cardinalFromDeg(90).abbreviation, 'E');
assert.equal(cardinalFromDeg(270).abbreviation, 'O');
assert.equal(cardinalFromDeg(322).abbreviation, 'NO');
assert.equal(cardinalFromDeg(null).abbreviation, '—');

const dewPoint = dewPointC(21.3, 46);
assert.ok(dewPoint !== null && Math.abs(dewPoint - 9.1) < 0.5);
assert.equal(windChillC(21.3, 2.4), null);
assert.ok((windChillC(0, 20) ?? 0) < 0);
assert.equal(heatIndexC(21.3, 46), null);
assert.ok((heatIndexC(35, 60) ?? 0) > 35);

assert.equal(uvCategory(0).label, 'Bajo');
assert.equal(uvCategory(5).label, 'Moderado');
assert.equal(uvCategory(9).label, 'Muy alto');
assert.equal(uvCategory(12).label, 'Extremo');
assert.equal(luxCategory(5695), 'Día nublado');
assert.equal(luxCategory(0), 'Oscuro');

assert.equal(rainDelta(10, 8), 2);
assert.equal(rainDelta(2, 125), 2);
assert.equal(rainDelta(10, null), 0);
assert.equal(rainDelta(null, 10), null);

assert.equal(convertTemperature(0, 'imperial'), 32);
assert.ok(Math.abs((convertWind(100, 'imperial') ?? 0) - 62.1371) < 0.001);
assert.equal(convertRain(25.4, 'imperial'), 25.4);
assert.equal(formatTemperature(21.3, 'metric'), '21.3°C');
assert.equal(formatWind(2.4, 'metric'), '2.4 km/h');
assert.equal(formatRain(1, 'metric'), '1.0 L');
assert.equal(formatRain(25.4, 'imperial'), '25.4 L');
assert.equal(formatRainRate(12.4, 'metric'), '12.4 L/h');
assert.equal(formatRainRate(25.4, 'imperial'), '25.4 L/h');

const emptyRain = summarizeRainReadings([]);
assert.equal(emptyRain.totalMm, 0);
assert.equal(emptyRain.maxRateMmH, null);

const rainReadings = summarizeRainReadings([
  { t: 0, mm: 0.2 },
  { t: 60_000, mm: 0.4 },
  { t: 120_000, mm: 0 },
]);
assert.ok(Math.abs(rainReadings.totalMm - 0.6) < 1e-9);
assert.ok(Math.abs((rainReadings.maxRateMmH ?? 0) - 24) < 1e-9);

const rainAfterGap = summarizeRainReadings([
  { t: 0, mm: null },
  { t: 3_600_000, mm: 1 },
]);
assert.ok(Math.abs(rainAfterGap.totalMm - 1) < 1e-9);
assert.ok(Math.abs((rainAfterGap.maxRateMmH ?? 0) - 1) < 1e-9);

const dryReadings = summarizeRainReadings([{ t: 0, mm: 0 }]);
assert.equal(dryReadings.totalMm, 0);
assert.equal(dryReadings.maxRateMmH, 0);

const influxCsv = `,result,table,_start,_stop,_time,_measurement,device,humidity,light_lux,rain_mm,temperature,uvi,wind_avg_km_h,wind_max_km_h
,_result,0,2026-11-13T08:37:00Z,2026-11-13T09:37:00Z,2026-11-13T08:38:00Z,vevor_7in1,7907,59.2,14010.3,125.12,17.8,1,3.3,6.4
,_result,0,2026-11-13T08:37:00Z,2026-11-13T09:37:00Z,2026-11-13T08:39:00Z,vevor_7in1,7907,59,10445.9,125.2,17.9,,1.9,4
`;
const influxPoints = parseInfluxCsv(influxCsv);
assert.equal(influxPoints.length, 2);
assert.equal(influxPoints[0]?.temperatureC, 17.8);
assert.equal(influxPoints[0]?.humidity, 59.2);
assert.equal(influxPoints[0]?.windMaxKmh, 6.4);
assert.equal(influxPoints[0]?.rainDeltaMm, 0);
assert.ok(
  Math.abs((influxPoints[1]?.rainDeltaMm ?? 0) - 0.08) < 1e-6,
);
assert.equal(influxPoints[1]?.uvi, null);
assert.equal(parseInfluxCsv('').length, 0);
assert.equal(parseInfluxCsv('#datatype,string,long\n').length, 0);

const influxConfig: InfluxConfig = {
  url: 'https://influx.benicolo.com',
  org: 'my-org',
  bucket: 'my-bucket',
  measurement: 'vevor_7in1',
  device: '7907',
  token: 'secret-token',
};
const influxQuery = buildInfluxHistoryQuery(influxConfig, '7d');
assert.ok(influxQuery.includes('from(bucket: "my-bucket")'));
assert.ok(influxQuery.includes('r._measurement == "vevor_7in1"'));
assert.ok(influxQuery.includes('r.device == "7907"'));
assert.ok(influxQuery.includes('range(start: -7d)'));
assert.ok(influxQuery.includes('every: 30m'));
assert.ok(!influxQuery.includes('secret-token'));
assert.equal(INFLUX_RANGES['1h'].window, '1m');
assert.equal(INFLUX_RANGES['24h'].window, '5m');

const parsedDate = parseDateInput('13-11-2026');
assert.notEqual(parsedDate, null);
assert.equal(formatDateInput(parsedDate ?? 0), '13-11-2026');
assert.equal(formatDateTimeInput(parsedDate ?? 0), '13-11-2026 00:00');
assert.equal(parseDateInput('2026-11-13'), parsedDate);
assert.equal(parseDateInput('30-02-2026'), null);
assert.equal(parseDateInput('13/11/2026'), null);

const custom = parseCustomRange('01-11-2026', '03-11-2026');
assert.equal(custom.ok, true);
if (custom.ok) {
  assert.equal(formatDateInput(custom.range.start), '01-11-2026');
  assert.equal(formatDateInput(custom.range.end), '03-11-2026');
  assert.ok(custom.range.end - custom.range.start > 2 * 86_400_000);
}
assert.equal(parseCustomRange('03-11-2026', '01-11-2026').ok, false);
assert.equal(parseCustomRange('bad', '01-11-2026').ok, false);

assert.equal(bucketMsForDuration(60 * 60 * 1000), 60_000);
assert.ok(bucketMsForDuration(7 * 24 * 60 * 60 * 1000) > 60_000);
assert.equal(bucketMsForDuration(10 * 365 * 24 * 60 * 60 * 1000), 86_400_000);

const customQuery = buildInfluxHistoryQuery(influxConfig, 'custom', {
  start: Date.parse('2026-11-01T00:00:00Z'),
  end: Date.parse('2026-11-03T23:59:59Z'),
});
assert.ok(customQuery.includes('range(start: time(v: "2026-11-01T00:00:00.000Z")'));
assert.ok(customQuery.includes('stop: time(v: "2026-11-03T23:59:59.000Z")'));

console.log('✔ Pruebas de lógica superadas');
