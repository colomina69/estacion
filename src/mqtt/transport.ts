import { utf8Encode } from './codec';

export interface TransportCallbacks {
  onOpen: () => void;
  onData: (data: Uint8Array) => void;
  onError: (message: string) => void;
  onClose: () => void;
}

export interface MqttTransport {
  connect(callbacks: TransportCallbacks): void;
  write(bytes: Uint8Array): boolean;
  destroy(): void;
}

type TcpSocketModule = typeof import('react-native-tcp-socket').default;

function loadTcpModule(): TcpSocketModule | null {
  try {
    const module = require('react-native-tcp-socket') as
      | TcpSocketModule
      | { default?: TcpSocketModule };
    return 'default' in module && module.default ? module.default : (module as TcpSocketModule);
  } catch {
    return null;
  }
}

export class WebSocketTransport implements MqttTransport {
  private socket: WebSocket | null = null;
  private closed = false;
  private callbacks: TransportCallbacks | null = null;

  constructor(private readonly url: string) {}

  connect(callbacks: TransportCallbacks): void {
    this.callbacks = callbacks;
    this.closed = false;

    let socket: WebSocket;
    try {
      socket = new WebSocket(this.url, ['mqtt']);
    } catch (error) {
      callbacks.onError(
        error instanceof Error ? error.message : 'No se pudo abrir el WebSocket.',
      );
      callbacks.onClose();
      return;
    }

    this.socket = socket;
    socket.binaryType = 'arraybuffer';

    socket.onopen = () => {
      callbacks.onOpen();
    };

    socket.onmessage = (event: WebSocketMessageEvent) => {
      const data = event.data;
      if (data instanceof ArrayBuffer) {
        callbacks.onData(new Uint8Array(data));
      } else if (typeof data === 'string') {
        callbacks.onData(utf8Encode(data));
      } else if (ArrayBuffer.isView(data)) {
        callbacks.onData(
          new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
        );
      }
    };

    socket.onerror = (event) => {
      const message =
        (event as unknown as { message?: string }).message ??
        'Error de red en el WebSocket MQTT.';
      callbacks.onError(message);
    };

    socket.onclose = () => {
      if (this.closed) return;
      this.closed = true;
      callbacks.onClose();
    };
  }

  write(bytes: Uint8Array): boolean {
    const socket = this.socket;
    if (!socket || socket.readyState !== 1) return false;
    try {
      const copy = new Uint8Array(bytes).buffer as ArrayBuffer;
      socket.send(copy);
      return true;
    } catch {
      return false;
    }
  }

  destroy(): void {
    this.closed = true;
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      try {
        socket.close();
      } catch {
        // ignore
      }
    }
  }
}

export class TcpTransport implements MqttTransport {
  private socket: ReturnType<TcpSocketModule['createConnection']> | null = null;
  private callbacks: TransportCallbacks | null = null;

  constructor(
    private readonly host: string,
    private readonly port: number,
  ) {}

  connect(callbacks: TransportCallbacks): void {
    this.callbacks = callbacks;
    const TcpSocket = loadTcpModule();
    if (!TcpSocket) {
      callbacks.onError(
        'TCP nativo no está disponible en Expo Go. Usa el transporte WebSocket.',
      );
      callbacks.onClose();
      return;
    }

    let socket: ReturnType<TcpSocketModule['createConnection']>;
    try {
      socket = TcpSocket.createConnection(
        {
          host: this.host,
          port: this.port,
          connectTimeout: 12_000,
          tls: false,
        },
        () => callbacks.onOpen(),
      );
    } catch (error) {
      callbacks.onError(
        error instanceof Error ? error.message : 'No se pudo abrir el socket TCP.',
      );
      callbacks.onClose();
      return;
    }

    this.socket = socket;
    socket.setNoDelay(true);
    socket.setKeepAlive(true, 30_000);

    socket.on('data', (data) => {
      callbacks.onData(
        typeof data === 'string' ? utf8Encode(data) : data,
      );
    });

    socket.on('error', (error) => {
      callbacks.onError(
        error instanceof Error ? error.message : 'Error de red en el socket MQTT.',
      );
    });

    socket.on('close', () => {
      callbacks.onClose();
    });
  }

  write(bytes: Uint8Array): boolean {
    const socket = this.socket;
    if (!socket || socket.destroyed) return false;
    try {
      socket.write(bytes);
      return true;
    } catch {
      return false;
    }
  }

  destroy(): void {
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      try {
        socket.destroy();
      } catch {
        // ignore
      }
    }
  }
}

export function createTransport(config: {
  transport: 'tcp' | 'ws';
  host: string;
  port: number;
  wsUrl?: string;
}): MqttTransport {
  if (config.transport === 'ws') {
    return new WebSocketTransport(config.wsUrl ?? 'wss://mqtt.benicolo.com/mqtt');
  }
  return new TcpTransport(config.host, config.port);
}
