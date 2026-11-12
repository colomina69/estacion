import {
  DISCONNECT_PACKET,
  MqttParser,
  PINGREQ_PACKET,
  encodeConnect,
  encodePuback,
  encodeSubscribe,
  utf8Decode,
} from './codec';
import {
  createTransport,
  type MqttTransport,
} from './transport';

export type ConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'offline'
  | 'error';

export interface MqttConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  topic: string;
  clientId?: string;
  keepalive?: number;
  transport?: 'tcp' | 'ws';
  wsUrl?: string;
}

export interface MqttHandlers {
  onState?: (state: ConnectionState, detail?: string) => void;
  onMessage?: (topic: string, payload: string) => void;
  onError?: (message: string) => void;
}

const CONNECT_TIMEOUT_MS = 12_000;
const PING_INTERVAL_MS = 20_000;
const RECONNECT_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000];

function connackMessage(code: number): string {
  switch (code) {
    case 1:
      return 'El broker rechazó el protocolo MQTT.';
    case 2:
      return 'El identificador de cliente fue rechazado.';
    case 3:
      return 'El servidor MQTT no está disponible.';
    case 4:
      return 'Usuario o contraseña incorrectos.';
    case 5:
      return 'No autorizado por el broker.';
    default:
      return `Conexión rechazada por el broker (código ${code}).`;
  }
}

export class MqttClient {
  private transport: MqttTransport | null = null;
  private parser = new MqttParser();
  private config: MqttConfig | null = null;
  private handlers: MqttHandlers;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempt = 0;
  private packetId = 1;
  private manualStop = true;
  private pendingPing = false;
  private generation = 0;
  private state: ConnectionState = 'idle';

  constructor(handlers: MqttHandlers = {}) {
    this.handlers = handlers;
  }

  setHandlers(handlers: MqttHandlers): void {
    this.handlers = handlers;
  }

  getState(): ConnectionState {
    return this.state;
  }

  connect(config: MqttConfig): void {
    this.disconnect();
    this.manualStop = false;
    this.config = config;
    this.reconnectAttempt = 0;
    this.setState('connecting');
    this.open();
  }

  disconnect(): void {
    this.manualStop = true;
    this.generation += 1;
    this.clearTimers();
    const transport = this.transport;
    this.transport = null;
    if (transport) {
      transport.write(DISCONNECT_PACKET);
      transport.destroy();
    }
    this.parser.reset();
    if (this.state !== 'idle' && this.state !== 'error') {
      this.setState('offline');
    }
  }

  private open(): void {
    const config = this.config;
    if (!config || this.manualStop) return;

    this.parser.reset();
    this.pendingPing = false;
    this.setState(this.reconnectAttempt === 0 ? 'connecting' : 'reconnecting');
    this.setConnectTimeout();

    const generation = ++this.generation;
    const transport = createTransport({
      transport: config.transport ?? 'ws',
      host: config.host,
      port: config.port,
      wsUrl: config.wsUrl,
    });
    this.transport = transport;

    transport.connect({
      onOpen: () => {
        if (generation !== this.generation || this.manualStop) return;
        this.clearConnectTimer();
        const clientId =
          config.clientId ?? `estacio-${Math.random().toString(16).slice(2, 10)}`;
        this.send(
          encodeConnect({
            clientId,
            username: config.username,
            password: config.password,
            keepalive: config.keepalive ?? 60,
          }),
        );
      },
      onData: (data) => {
        if (generation !== this.generation) return;
        this.handleData(data);
      },
      onError: (message) => {
        if (generation !== this.generation) return;
        this.clearConnectTimer();
        this.handlers.onError?.(message);
      },
      onClose: () => {
        if (generation !== this.generation) return;
        this.transport = null;
        this.clearConnectTimer();
        this.stopPing();
        if (this.manualStop) {
          this.setState('offline');
        } else {
          this.scheduleReconnect();
        }
      },
    });
  }

  private handleData(chunk: Uint8Array): void {
    const packets = this.parser.push(chunk);
    for (const packet of packets) {
      switch (packet.type) {
        case 'connack': {
          this.clearConnectTimer();
          if (packet.returnCode !== 0) {
            const message = connackMessage(packet.returnCode);
            const retryable = packet.returnCode === 3;
            this.fail(message, retryable);
            return;
          }
          this.reconnectAttempt = 0;
          this.startPing();
          this.setState('connected');
          this.subscribe();
          break;
        }
        case 'suback': {
          if (packet.codes.some((code) => code === 0x80)) {
            this.handlers.onError?.('El broker rechazó la suscripción al topic.');
          }
          break;
        }
        case 'publish': {
          const payload = utf8Decode(packet.payload);
          if (packet.qos === 1 && packet.packetId !== undefined) {
            this.send(encodePuback(packet.packetId));
          }
          this.handlers.onMessage?.(packet.topic, payload);
          break;
        }
        case 'pingresp':
          this.pendingPing = false;
          break;
        default:
          break;
      }
    }
  }

  private subscribe(): void {
    const topic = this.config?.topic;
    if (!topic) return;
    const packetId = this.nextPacketId();
    this.send(encodeSubscribe(packetId, topic, 0));
  }

  private nextPacketId(): number {
    this.packetId = this.packetId >= 0xffff ? 1 : this.packetId + 1;
    return this.packetId;
  }

  private send(bytes: Uint8Array): boolean {
    return this.transport?.write(bytes) ?? false;
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (!this.transport) return;
      if (this.pendingPing) {
        this.fail('El broker no respondió al keepalive.', true);
        return;
      }
      this.pendingPing = true;
      this.send(PINGREQ_PACKET);
    }, PING_INTERVAL_MS);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    this.pendingPing = false;
  }

  private setConnectTimeout(): void {
    this.clearConnectTimer();
    this.connectTimer = setTimeout(() => {
      this.fail('Tiempo de conexión agotado con el broker.', true);
    }, CONNECT_TIMEOUT_MS);
  }

  private clearConnectTimer(): void {
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.manualStop || this.reconnectTimer) return;
    const index = Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1);
    const base = RECONNECT_DELAYS_MS[index] ?? 30_000;
    const jitter = base * 0.2 * (Math.random() * 2 - 1);
    const delay = Math.max(500, Math.round(base + jitter));
    this.reconnectAttempt += 1;
    this.setState('reconnecting', `Reintentando en ${Math.ceil(delay / 1000)} s`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  private fail(message: string, retry: boolean): void {
    this.clearTimers();
    this.handlers.onError?.(message);
    this.generation += 1;
    const transport = this.transport;
    this.transport = null;
    if (transport) {
      transport.destroy();
    }
    if (retry && !this.manualStop) {
      this.scheduleReconnect();
    } else {
      this.manualStop = true;
      this.setState('error', message);
    }
  }

  private clearTimers(): void {
    this.clearConnectTimer();
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setState(state: ConnectionState, detail?: string): void {
    this.state = state;
    this.handlers.onState?.(state, detail);
  }
}
