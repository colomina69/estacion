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
assert.ok(Math.abs((convertRain(25.4, 'imperial') ?? 0) - 1) < 0.0001);
assert.equal(formatTemperature(21.3, 'metric'), '21.3°C');
assert.equal(formatWind(2.4, 'metric'), '2.4 km/h');
assert.equal(formatRain(25.4, 'imperial'), '1.0 in');
assert.equal(formatRainRate(12.4, 'metric'), '12.4 mm/h');
assert.equal(formatRainRate(25.4, 'imperial'), '1.0 in/h');

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

console.log('✔ Pruebas de lógica superadas');
