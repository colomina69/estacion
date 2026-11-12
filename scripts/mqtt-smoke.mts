import net from 'node:net';

import {
  DISCONNECT_PACKET,
  MqttParser,
  encodeConnect,
  encodeSubscribe,
  utf8Decode,
} from '../src/mqtt/codec.ts';
import { parseStationPayload } from '../src/mqtt/parser.ts';

const host = process.env.MQTT_HOST ?? 'mqtt.benicolo.com';
const port = Number(process.env.MQTT_PORT ?? 1883);
const username = process.env.MQTT_USER ?? 'toni';
const password = process.env.MQTT_PASSWORD ?? 'palomo69';
const topic = process.env.MQTT_TOPIC ?? 'rtl_433/chuwi/events';

const parser = new MqttParser();
const socket = net.createConnection({ host, port });
let connected = false;
let subscribed = false;

const timeout = setTimeout(() => {
  console.error('✖ Timeout: no se recibió ningún mensaje en 25 s.');
  socket.destroy();
  process.exitCode = 1;
}, 25_000);

socket.on('connect', () => {
  console.log(`→ TCP conectado a ${host}:${port}`);
  socket.write(
    encodeConnect({
      clientId: `estacio-smoke-${Date.now()}`,
      username,
      password,
      keepalive: 30,
    }),
  );
});

socket.on('data', (chunk) => {
  const packets = parser.push(chunk);
  for (const packet of packets) {
    if (packet.type === 'connack') {
      if (packet.returnCode !== 0) {
        console.error(`✖ CONNACK rechazado con código ${packet.returnCode}`);
        socket.destroy();
        process.exitCode = 1;
        return;
      }
      connected = true;
      console.log('✔ CONNACK aceptado');
      if (!subscribed) {
        subscribed = true;
        socket.write(encodeSubscribe(1, topic, 0));
        console.log(`→ Suscrito a ${topic}`);
      }
    } else if (packet.type === 'suback') {
      if (packet.codes.some((code) => code === 0x80)) {
        console.error('✖ SUBACK rechazó la suscripción');
        socket.destroy();
        process.exitCode = 1;
        return;
      }
      console.log('✔ SUBACK correcto');
    } else if (packet.type === 'publish') {
      const payload = utf8Decode(packet.payload);
      console.log(`✔ PUBLISH en ${packet.topic}`);
      const parsed = parseStationPayload(payload);
      if (!parsed.ok) {
        console.error(`✖ Payload no válido: ${parsed.error}`);
        process.exitCode = 1;
        socket.destroy();
        return;
      }
      console.log(
        `  ${parsed.reading.model ?? 'modelo'} · ${parsed.reading.temperatureC ?? '—'} °C · ` +
          `${parsed.reading.humidity ?? '—'} % · viento ${parsed.reading.windMaxKmh ?? '—'} km/h · ` +
          `UV ${parsed.reading.uvi ?? '—'} · checksum ${parsed.reading.micValid ? 'OK' : 'inválido'}`,
      );
      clearTimeout(timeout);
      socket.write(DISCONNECT_PACKET);
      socket.end();
      console.log('✔ Prueba MQTT completada');
    }
  }
});

socket.on('error', (error) => {
  console.error(`✖ Error de red: ${error.message}`);
  process.exitCode = 1;
});

socket.on('close', () => {
  clearTimeout(timeout);
  if (!connected) {
    console.error('✖ El socket se cerró antes de completar el handshake.');
    process.exitCode = 1;
  }
});
