import WebSocket from 'ws';

import {
  DISCONNECT_PACKET,
  MqttParser,
  encodeConnect,
  encodeSubscribe,
  utf8Decode,
} from '../src/mqtt/codec.ts';
import { parseStationPayload } from '../src/mqtt/parser.ts';

const url = process.env.MQTT_WS_URL ?? 'wss://mqtt.benicolo.com/mqtt';
const username = process.env.MQTT_USER ?? 'toni';
const password = process.env.MQTT_PASSWORD ?? 'palomo69';
const topic = process.env.MQTT_TOPIC ?? 'rtl_433/chuwi/events';

const parser = new MqttParser();
const ws = new WebSocket(url, ['mqtt']);
let connected = false;
let gotMessage = false;

const timeout = setTimeout(() => {
  console.error('✖ Timeout: no se recibió ningún mensaje en 25 s.');
  ws.terminate();
  process.exitCode = 1;
}, 25_000);

ws.on('open', () => {
  console.log(`→ WebSocket abierto en ${url}`);
  ws.send(
    encodeConnect({
      clientId: `estacio-wss-smoke-${Date.now()}`,
      username,
      password,
      keepalive: 30,
    }),
  );
});

ws.on('message', (data) => {
  const packets = parser.push(new Uint8Array(data as Buffer));
  for (const packet of packets) {
    if (packet.type === 'connack') {
      if (packet.returnCode !== 0) {
        console.error(`✖ CONNACK rechazado con código ${packet.returnCode}`);
        ws.terminate();
        process.exitCode = 1;
        return;
      }
      connected = true;
      console.log('✔ CONNACK aceptado sobre WSS');
      ws.send(encodeSubscribe(1, topic, 0));
      console.log(`→ Suscrito a ${topic}`);
    } else if (packet.type === 'suback') {
      if (packet.codes.some((code) => code === 0x80)) {
        console.error('✖ SUBACK rechazó la suscripción');
        ws.terminate();
        process.exitCode = 1;
        return;
      }
      console.log('✔ SUBACK correcto');
    } else if (packet.type === 'publish') {
      gotMessage = true;
      const parsed = parseStationPayload(utf8Decode(packet.payload));
      if (!parsed.ok) {
        console.error(`✖ Payload no válido: ${parsed.error}`);
        process.exitCode = 1;
      } else {
        console.log(
          `✔ PUBLISH WSS: ${parsed.reading.model ?? 'modelo'} · ` +
            `${parsed.reading.temperatureC ?? '—'} °C · ` +
            `${parsed.reading.humidity ?? '—'} % · checksum ` +
            `${parsed.reading.micValid ? 'OK' : 'inválido'}`,
        );
      }
      clearTimeout(timeout);
      ws.send(DISCONNECT_PACKET);
      ws.close();
    }
  }
});

ws.on('error', (error) => {
  console.error(`✖ Error WebSocket: ${error.message}`);
  process.exitCode = 1;
});

ws.on('close', () => {
  clearTimeout(timeout);
  if (!connected) {
    console.error('✖ El WebSocket se cerró antes del CONNACK.');
    process.exitCode = 1;
  } else if (!gotMessage && process.exitCode !== 1) {
    console.error('✖ No se recibió ningún PUBLISH.');
    process.exitCode = 1;
  }
});
