export type MqttPacket =
  | { type: 'connack'; sessionPresent: boolean; returnCode: number }
  | { type: 'suback'; packetId: number; codes: number[] }
  | {
      type: 'publish';
      topic: string;
      payload: Uint8Array;
      qos: number;
      retain: boolean;
      dup: boolean;
      packetId?: number;
    }
  | { type: 'puback'; packetId: number }
  | { type: 'pingresp' }
  | { type: 'disconnect' }
  | { type: 'unknown'; typeCode: number };

export interface ConnectOptions {
  clientId: string;
  username?: string;
  password?: string;
  keepalive?: number;
  clean?: boolean;
}

export const MQTT_PACKET = {
  CONNECT: 1,
  CONNACK: 2,
  PUBLISH: 3,
  PUBACK: 4,
  SUBSCRIBE: 8,
  SUBACK: 9,
  PINGREQ: 12,
  PINGRESP: 13,
  DISCONNECT: 14,
} as const;

const MAX_REMAINING_LENGTH_BYTES = 4;

export function utf8Encode(input: string): Uint8Array {
  const bytes: number[] = [];
  for (const char of input) {
    const codePoint = char.codePointAt(0);
    if (codePoint === undefined) continue;
    if (codePoint < 0x80) {
      bytes.push(codePoint);
    } else if (codePoint < 0x800) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint < 0x10000) {
      bytes.push(
        0xe0 | (codePoint >> 12),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }
  return Uint8Array.from(bytes);
}

export function utf8Decode(bytes: Uint8Array): string {
  let output = '';
  let index = 0;
  while (index < bytes.length) {
    const first = bytes[index];
    if (first === undefined) break;
    let codePoint: number;
    let width: number;
    if (first < 0x80) {
      codePoint = first;
      width = 1;
    } else if ((first & 0xe0) === 0xc0) {
      codePoint = ((first & 0x1f) << 6) | (bytes[index + 1] ?? 0) & 0x3f;
      width = 2;
    } else if ((first & 0xf0) === 0xe0) {
      codePoint =
        ((first & 0x0f) << 12) |
        (((bytes[index + 1] ?? 0) & 0x3f) << 6) |
        ((bytes[index + 2] ?? 0) & 0x3f);
      width = 3;
    } else {
      codePoint =
        ((first & 0x07) << 18) |
        (((bytes[index + 1] ?? 0) & 0x3f) << 12) |
        (((bytes[index + 2] ?? 0) & 0x3f) << 6) |
        ((bytes[index + 3] ?? 0) & 0x3f);
      width = 4;
    }
    output += String.fromCodePoint(codePoint);
    index += width;
  }
  return output;
}

export function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

export function encodeVarint(value: number): Uint8Array {
  if (value < 0 || value > 268435455) {
    throw new Error(`Longitud MQTT inválida: ${value}`);
  }
  const bytes: number[] = [];
  let remaining = value;
  do {
    let byte = remaining % 128;
    remaining = Math.floor(remaining / 128);
    if (remaining > 0) byte |= 0x80;
    bytes.push(byte);
  } while (remaining > 0);
  return Uint8Array.from(bytes);
}

export function readVarint(
  buffer: Uint8Array,
  offset = 0,
): { value: number; bytes: number } | null {
  let value = 0;
  let multiplier = 1;
  for (let index = 0; index < MAX_REMAINING_LENGTH_BYTES; index += 1) {
    const position = offset + index;
    if (position >= buffer.length) return null;
    const byte = buffer[position];
    if (byte === undefined) return null;
    value += (byte & 0x7f) * multiplier;
    if ((byte & 0x80) === 0) {
      return { value, bytes: index + 1 };
    }
    multiplier *= 128;
  }
  throw new Error('Longitud MQTT demasiado grande');
}

function uint16(value: number): Uint8Array {
  return Uint8Array.from([(value >> 8) & 0xff, value & 0xff]);
}

function readUint16(buffer: Uint8Array, offset: number): number {
  return ((buffer[offset] ?? 0) << 8) | (buffer[offset + 1] ?? 0);
}

function encodeString(value: string): Uint8Array {
  const encoded = utf8Encode(value);
  return concatBytes([uint16(encoded.length), encoded]);
}

function buildPacket(header: number, body: Uint8Array): Uint8Array {
  return concatBytes([Uint8Array.from([header]), encodeVarint(body.length), body]);
}

export function encodeConnect(options: ConnectOptions): Uint8Array {
  let flags = options.clean === false ? 0 : 0x02;
  if (options.username !== undefined) flags |= 0x80;
  if (options.password !== undefined) flags |= 0x40;

  const keepalive = options.keepalive ?? 60;
  const body = concatBytes([
    encodeString('MQTT'),
    Uint8Array.from([4, flags]),
    uint16(keepalive),
    encodeString(options.clientId),
    ...(options.username !== undefined ? [encodeString(options.username)] : []),
    ...(options.password !== undefined ? [encodeString(options.password)] : []),
  ]);

  return buildPacket(0x10, body);
}

export function encodeSubscribe(
  packetId: number,
  topic: string,
  qos: 0 | 1 | 2 = 0,
): Uint8Array {
  const body = concatBytes([
    uint16(packetId),
    encodeString(topic),
    Uint8Array.from([qos]),
  ]);
  return buildPacket(0x82, body);
}

export function encodePuback(packetId: number): Uint8Array {
  return buildPacket(0x40, uint16(packetId));
}

export const PINGREQ_PACKET = Uint8Array.from([0xc0, 0x00]);
export const DISCONNECT_PACKET = Uint8Array.from([0xe0, 0x00]);

export class MqttParser {
  private buffer: Uint8Array = new Uint8Array(0);

  push(chunk: Uint8Array): MqttPacket[] {
    this.buffer = concatBytes([this.buffer, chunk]);
    const packets: MqttPacket[] = [];

    for (;;) {
      if (this.buffer.length < 2) break;
      const lengthInfo = readVarint(this.buffer, 1);
      if (lengthInfo === null) break;

      const headerSize = 1 + lengthInfo.bytes;
      const totalSize = headerSize + lengthInfo.value;
      if (this.buffer.length < totalSize) break;

      const header = this.buffer[0] ?? 0;
      const body = this.buffer.slice(headerSize, totalSize);
      this.buffer = this.buffer.slice(totalSize);

      try {
        packets.push(decodePacket(header, body));
      } catch {
        packets.push({ type: 'unknown', typeCode: (header >> 4) & 0x0f });
      }
    }

    return packets;
  }

  reset(): void {
    this.buffer = new Uint8Array(0);
  }
}

function decodePacket(header: number, body: Uint8Array): MqttPacket {
  const typeCode = (header >> 4) & 0x0f;

  switch (typeCode) {
    case MQTT_PACKET.CONNACK:
      return {
        type: 'connack',
        sessionPresent: (body[0] ?? 0) === 1,
        returnCode: body[1] ?? 0,
      };
    case MQTT_PACKET.SUBACK:
      return {
        type: 'suback',
        packetId: readUint16(body, 0),
        codes: Array.from(body.slice(2)),
      };
    case MQTT_PACKET.PUBLISH: {
      const topicLength = readUint16(body, 0);
      const topic = utf8Decode(body.slice(2, 2 + topicLength));
      let offset = 2 + topicLength;
      const qos = (header >> 1) & 0x03;
      let packetId: number | undefined;
      if (qos > 0) {
        packetId = readUint16(body, offset);
        offset += 2;
      }
      return {
        type: 'publish',
        topic,
        payload: body.slice(offset),
        qos,
        retain: (header & 0x01) === 1,
        dup: (header & 0x08) === 8,
        packetId,
      };
    }
    case MQTT_PACKET.PUBACK:
      return { type: 'puback', packetId: readUint16(body, 0) };
    case MQTT_PACKET.PINGRESP:
      return { type: 'pingresp' };
    case MQTT_PACKET.DISCONNECT:
      return { type: 'disconnect' };
    default:
      return { type: 'unknown', typeCode };
  }
}
