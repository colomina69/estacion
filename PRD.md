# PRD — Estación Meteorológica (Android / Expo)

| Campo | Valor |
|---|---|
| Producto | Estación Meteorológica |
| Plataforma | Android (Expo / React Native) |
| Versión del documento | 1.0 |
| Fecha | 2026-11-12 |
| Estado | Borrador para aprobación |
| Autor | Equipo de producto |
| Fuente de datos | Broker MQTT `mqtt.benicolo.com`, topic `rtl_433/chuwi/events` |

---

## 1. Resumen ejecutivo

Aplicación Android desarrollada con Expo que muestra en tiempo real los datos de una estación meteorológica **Vevor-7in1** captados por `rtl_433` y publicados en un broker MQTT. La app ofrece un dashboard claro y moderno, historial local con gráficas y alertas configurables por umbrales.

El MVP funciona en **Expo Go** mediante **MQTT sobre WebSocket seguro** (`wss://mqtt.benicolo.com/mqtt`, puerto 443). El transporte TCP 1883 se mantiene como opción para **development builds** y redes locales.

---

## 2. Problema y oportunidad

El propietario de la estación recibe datos técnicos en bruto (JSON de `rtl_433`) a través de MQTT, sin una interfaz cómoda para consultarlos desde el móvil. No existe una vista resumida, ni histórico, ni avisos cuando se superan umbrales relevantes (viento fuerte, lluvia, UV alto, batería baja).

**Oportunidad:** una app ligera, offline-first para el histórico, que convierta datos crudos en información accionable.

---

## 3. Objetivos

### 3.1 Objetivos de producto

1. Visualizar todas las métricas de la estación en una pantalla principal en menos de 5 segundos tras abrir la app.
2. Mantener una conexión MQTT estable con reconexión automática.
3. Conservar 30 días de histórico local y permitir analizarlo con gráficas.
4. Avisar al usuario cuando se superen umbrales meteorológicos configurables.
5. Ofrecer un diseño sencillo, moderno y legible en exteriores (alto contraste, modo claro/oscuro).

### 3.2 Métricas de éxito

| Métrica | Objetivo |
|---|---|
| Tiempo hasta primer dato visible (arranque en frío) | < 5 s |
| Sesiones sin caída de conexión no recuperada | > 99 % |
| Actualización de UI tras mensaje MQTT | < 500 ms |
| Retención de histórico | 30 días |
| Crash-free sessions | > 99.5 % |
| Tamaño del APK | < 40 MB |

---

## 4. No objetivos (fuera de alcance del MVP)

- iOS (la arquitectura lo permitirá, pero no se valida).
- Soporte multiestación / múltiples topics.
- Integración con servicios de pronóstico externos.
- Control de actuadores o escritura en MQTT.
- Widgets de pantalla de inicio y Wear OS.
- Sincronización en la nube o cuentas de usuario.
- Mapa de ubicación o geolocalización.

---

## 5. Usuarios y casos de uso

### 5.1 Usuario principal

**Toni** — propietario de la estación. Quiere consultar el tiempo de su ubicación desde el móvil, revisar cómo evolucionó el viento o la lluvia y recibir avisos ante condiciones relevantes.

### 5.2 Casos de uso

| ID | Caso de uso | Prioridad |
|---|---|---|
| UC-01 | Abrir la app y ver el estado actual de la estación | Must |
| UC-02 | Comprobar si la conexión está activa y cuándo llegó el último dato | Must |
| UC-03 | Consultar temperatura, humedad, viento, lluvia, UV y luminosidad | Must |
| UC-04 | Ver la evolución de las métricas en 1 h / 24 h / 7 días | Should |
| UC-05 | Configurar credenciales y topic del broker | Must |
| UC-06 | Definir umbrales y recibir alertas locales | Should |
| UC-07 | Cambiar unidades (°C/°F, km/h/m/s) y tema | Could |
| UC-08 | Ver la dirección del viento de forma intuitiva (rosa de los vientos) | Should |

---

## 6. Requisitos funcionales

### 6.1 Conexión MQTT

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| RF-01 | Conectar al broker por WSS (`wss://mqtt.benicolo.com/mqtt`, por defecto) o TCP 1883, con usuario y password | Must | La conexión se establece y el estado pasa a `Conectado` |
| RF-02 | Autenticarse con usuario `toni` y password configurable | Must | Un password incorrecto muestra error y permite reintentar |
| RF-03 | Suscribirse a `rtl_433/chuwi/events` con QoS 0 | Must | Se reciben mensajes y se actualiza el dashboard |
| RF-04 | Reconexión automática con backoff exponencial + jitter (1, 2, 4, 8, 16, 30 s máx.) | Must | Tras perder red, reconecta sin intervención |
| RF-05 | `clientId` único, `cleanSession: true`, `keepalive: 60` | Must | Configuración visible en logs de desarrollo |
| RF-06 | Botón de reconexión manual | Should | Fuerza cierre y nueva conexión |
| RF-07 | Mostrar estado: `Conectando`, `Conectado`, `Reconectando`, `Offline`, `Error` | Must | Chip de estado coherente con la realidad |
| RF-08 | Mostrar hora del último mensaje recibido y marcar dato obsoleto tras 5 min | Must | Banner/indicador tras el umbral |

### 6.2 Parseo y datos

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| RF-09 | Parsear el JSON de `rtl_433` de forma tolerante (campos ausentes → `—`) | Must | Payload incompleto no rompe la app |
| RF-10 | Validar `mic === "CHECKSUM"`; si no, marcar lectura como dudosa | Should | Chip de advertencia en la lectura |
| RF-11 | Usar `time` de la estación como hora del dato y `received_at` del dispositivo como respaldo | Must | Histórico ordenado correctamente |
| RF-12 | Tratar `rain_mm` como acumulado; calcular delta entre lecturas y detectar reinicio del contador | Must | Delta nunca negativo |
| RF-13 | Calcular métricas derivadas: punto de rocío, sensación térmica, cardinal (16 rumbos), categoría UV y de luminosidad | Should | Valores coherentes con fórmulas del anexo |

### 6.3 Dashboard

| ID | Requisito | Prioridad |
|---|---|---|
| RF-14 | Tarjeta principal con temperatura, icono meteorológico y sensación térmica | Must |
| RF-15 | Tarjetas de humedad, punto de rocío, viento medio/máximo, dirección, lluvia, UV, lux y batería | Must |
| RF-16 | Brújula/rosa de los vientos para `wind_dir_deg` | Should |
| RF-17 | Pull-to-refresh que reconecta si está offline | Should |
| RF-18 | Skeleton de carga y estado vacío ("Esperando datos de la estación") | Must |

### 6.4 Histórico

| ID | Requisito | Prioridad |
|---|---|---|
| RF-19 | Persistir cada lectura en SQLite con índice por fecha | Must |
| RF-20 | Retención configurable, por defecto 30 días, con purga automática | Must |
| RF-21 | Gráficas de temperatura/humedad, viento y lluvia para 1 h, 24 h y 7 d | Should |
| RF-22 | Agregación por minuto para rangos largos y rendimiento estable | Should |
| RF-23 | Sobrevivir a cierres y reinicios de la app | Must |

### 6.5 Alertas

| ID | Requisito | Prioridad |
|---|---|---|
| RF-24 | Alertas locales con `expo-notifications` | Should |
| RF-25 | Umbrales configurables: viento máximo, delta de lluvia, temperatura alta/baja, UV, batería baja y pérdida de conexión | Should |
| RF-26 | Cooldown por tipo de alerta (por defecto 30 min) para evitar spam | Should |
| RF-27 | Registro local de alertas disparadas | Could |
| RF-28 | Las alertas en segundo plano requieren foreground service; el MVP alerta con la app abierta o en background reciente | Must (limitación documentada) |

### 6.6 Ajustes

| ID | Requisito | Prioridad |
|---|---|---|
| RF-29 | Editar transporte (WSS/TCP), URL WebSocket, host, puerto, usuario, password y topic | Must |
| RF-30 | Guardar credenciales con `expo-secure-store` (nunca en texto plano ni en logs) | Must |
| RF-31 | Valores por defecto precargados (WSS, host, puerto, topic, usuario) | Must |
| RF-32 | Cambiar unidades y tema (sistema/claro/oscuro) | Could |
| RF-33 | Restablecer ajustes y borrar histórico con confirmación | Should |
| RF-34 | Mostrar versión de la app y estado de la build | Could |

---

## 7. Requisitos no funcionales

| Área | Requisito |
|---|---|
| Plataforma | Android 7.0+ (API 24), target API 35 |
| Framework | Expo SDK estable más reciente (54+), React Native, TypeScript estricto |
| Distribución | **Expo Go (SDK 58)** por WSS; development build + APK/AAB vía EAS para TCP |
| Diseño | Material 3 adaptado, modo claro/oscuro, tokens centralizados |
| Accesibilidad | Contraste WCAG AA, áreas táctiles ≥ 44 dp, etiquetas para TalkBack, soporte de fuente dinámica |
| Rendimiento | 60 fps en scroll, arranque en frío < 3 s, gráficas < 300 ms |
| Batería | Sin polling; conexión MQTT persistente y reconexión eficiente |
| Seguridad | Credenciales en SecureStore, sin logs sensibles, WSS con TLS por defecto |
| Resiliencia | La app no debe crashear ante JSON inválido, mensajes gigantes o campos desconocidos |
| Internacionalización | Español (es-ES) en v1; textos centralizados para futuras traducciones |
| Almacenamiento | Histórico < 50 MB con retención por defecto |

### 7.1 Nota de seguridad

Las sondas confirmaron:

| Endpoint | Estado | Uso |
|---|---|---|
| `wss://mqtt.benicolo.com/mqtt` (443) | **Disponible** | MQTT sobre WebSocket con TLS; opción por defecto |
| 1883 | Abierto | MQTT TCP sin cifrar; solo development build / red local |
| 8883 | Cerrado | MQTT sobre TLS nativo (no necesario con WSS) |
| 8083 / 8084 | Cerrados | WebSocket sin TLS |

El transporte por defecto es **WSS con TLS**, que cifra usuario y password y funciona en Expo Go. El transporte TCP 1883 se ofrece como opción avanzada para development builds; en ese caso las credenciales viajan en claro y la app muestra una advertencia en Ajustes.

---

## 8. Contrato de datos

### 8.1 Topic

```
rtl_433/chuwi/events
```

### 8.2 Payload de ejemplo

```json
{
  "time": "2026-11-12 16:03:17",
  "model": "Vevor-7in1",
  "id": 7907,
  "channel": 0,
  "battery_ok": 1,
  "temperature_C": 21.3,
  "humidity": 46,
  "wind_avg_km_h": 2.4001,
  "wind_max_km_h": 3.2,
  "wind_dir_deg": 322,
  "rain_mm": 125.12099,
  "uvi": 0,
  "light_lux": 5695,
  "mic": "CHECKSUM"
}
```

### 8.3 Campos

| Campo | Tipo | Unidad | Rango esperado | Nulo | Uso en UI |
|---|---|---|---|---|---|
| `time` | string | fecha local `YYYY-MM-DD HH:mm:ss` | — | Sí | Hora del dato |
| `model` | string | — | `Vevor-7in1` | Sí | Cabecera / diagnóstico |
| `id` | number | — | — | Sí | Identificador de estación |
| `channel` | number | — | 0 | Sí | Diagnóstico |
| `battery_ok` | 0/1 | booleano | 0–1 | Sí | Estado de batería |
| `temperature_C` | number | °C | −40…60 | Sí | Tarjeta principal |
| `humidity` | number | % | 0–100 | Sí | Tarjeta humedad |
| `wind_avg_km_h` | number | km/h | 0…200 | Sí | Viento medio |
| `wind_max_km_h` | number | km/h | 0…250 | Sí | Viento máximo |
| `wind_dir_deg` | number | grados | 0–359 | Sí | Brújula |
| `rain_mm` | number | mm acumulados | 0…∞ | Sí | Lluvia total + delta |
| `uvi` | number | índice UV | 0…15 | Sí | Tarjeta UV |
| `light_lux` | number | lux | 0…150 000 | Sí | Tarjeta luminosidad |
| `mic` | string | — | `CHECKSUM` | Sí | Calidad de lectura |

### 8.4 Fórmulas derivadas

- **Punto de rocío (Magnus):**
  `γ = ln(RH/100) + (17.62·T)/(243.12+T)`; `Td = 243.12·γ/(17.62−γ)`.
- **Sensación térmica (wind chill, T ≤ 10 °C y v > 4.8 km/h):**
  `13.12 + 0.6215·T − 11.37·v^0.16 + 0.3965·T·v^0.16`.
- **Índice de calor (T ≥ 27 °C):** ecuación de Rothfusz.
- **Cardinal:** 16 rumbos (N, NNE, NE, …) a partir de `wind_dir_deg`.
- **Categoría UV:** 0–2 Bajo, 3–5 Moderado, 6–7 Alto, 8–10 Muy alto, 11+ Extremo.
- **Delta de lluvia:** `max(0, rain_actual − rain_anterior)`; si `rain_actual < rain_anterior`, asumir reinicio del contador y usar `rain_actual`.

---

## 9. Arquitectura técnica

### 9.1 Stack

| Capa | Tecnología |
|---|---|
| Framework | Expo SDK estable + React Native + TypeScript estricto |
| Navegación | `expo-router` (tabs) |
| Estado | Zustand (`weatherStore`, `historyStore`, `settingsStore`) |
| MQTT | Cliente MQTT 3.1.1 propio (QoS 0) sobre WebSocket (WSS) y TCP |
| Persistencia | `expo-sqlite` |
| Seguridad | `expo-secure-store` |
| Notificaciones | `expo-notifications` |
| Gráficas | `react-native-svg` (componentes propios o `react-native-gifted-charts`) |
| Build | EAS Build (`development` y `preview`) |

### 9.2 Integración MQTT en React Native

`mqtt.js` depende de módulos Node (`net`, `tls`, `stream`, `buffer`, `process`) y de polyfills frágiles en React Native. Para reducir riesgo se implementó un **cliente MQTT 3.1.1 mínimo** con dos transportes intercambiables:

1. **WebSocket** (`src/mqtt/transport.ts`): usa el `WebSocket` global de React Native con subprotocolo `mqtt`; funciona en **Expo Go** y usa TLS (`wss://`).
2. **TCP** (`react-native-tcp-socket`): carga diferida para no romper Expo Go; requiere **development build**.
3. Codec propio (`src/mqtt/codec.ts`): `CONNECT`, `CONNACK`, `SUBSCRIBE`, `SUBACK`, `PUBLISH` (QoS 0/1 de lectura) y `PINGREQ`/`PINGRESP`.
4. Cliente (`src/mqtt/client.ts`): autenticación, suscripción, keepalive de 20 s, reconexión con backoff exponencial y jitter, y validación de códigos `CONNACK`.
5. En Expo Go la app fuerza automáticamente el transporte WebSocket; `app.json` declara los permisos Android (`INTERNET`, `ACCESS_NETWORK_STATE`, `POST_NOTIFICATIONS`).

La integración se valida con `npm run test:mqtt:ws` (WSS, equivalente a Expo Go) y `npm run test:mqtt` (TCP), que conectan al broker real, se suscriben al topic y parsean un payload recibido.

### 9.3 Estructura de carpetas implementada

```
app/
  _layout.tsx
  (tabs)/
    _layout.tsx        # Tabs
    index.tsx          # Dashboard
    history.tsx        # Histórico
    settings.tsx       # Ajustes
src/
  alerts/
    notifications.ts   # canal y permisos
    evaluate.ts        # umbrales y cooldown
  config/defaults.ts
  db/database.ts       # schema, insert, query, agregaciones, purga
  lib/
    derived.ts         # punto de rocío, wind chill, cardinal, UV
    units.ts
    time.ts
  mqtt/
    codec.ts           # MQTT 3.1.1 (CONNECT, SUBSCRIBE, PUBLISH, PING)
    transport.ts       # WebSocket (Expo Go) y TCP (dev build)
    client.ts          # reconexión, keepalive
    parser.ts          # validación y normalización del payload
  station/
    stationService.ts  # une MQTT, SQLite, stores y alertas
  store/
    weatherStore.ts
    historyStore.ts
    settingsStore.ts
  types/weather.ts
  ui/
    theme.tsx
    components/        # base, inputs, charts, weather
```

### 9.4 Máquina de estados de conexión

```
idle → connecting → connected
                 ↘ error → reconnecting → connecting
connected → offline (pérdida de red) → reconnecting
```

- Backoff: 1 s, 2 s, 4 s, 8 s, 16 s, 30 s (máximo), con jitter ±20 %.
- Al recuperar conexión se vuelve a suscribir al topic.
- `lastMessageAt` se actualiza con cada mensaje; si supera 5 min → dato obsoleto.

### 9.5 Esquema SQLite

```sql
CREATE TABLE IF NOT EXISTS readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  received_at INTEGER NOT NULL,
  station_time TEXT,
  station_time_ms INTEGER,
  model TEXT,
  station_id INTEGER,
  channel INTEGER,
  battery_ok INTEGER,
  temperature_c REAL,
  humidity REAL,
  wind_avg_kmh REAL,
  wind_max_kmh REAL,
  wind_dir_deg INTEGER,
  rain_mm REAL,
  rain_delta_mm REAL,
  uvi REAL,
  light_lux REAL,
  mic TEXT,
  mic_valid INTEGER,
  raw_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_readings_received_at
  ON readings (received_at);

CREATE TABLE IF NOT EXISTS alert_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fired_at INTEGER NOT NULL,
  type TEXT NOT NULL,
  value REAL,
  threshold REAL,
  message TEXT
);
```

- Agregación: 1 min (1 h), 5 min (24 h) y 30 min (7 días).
- Purga al iniciar y al guardar ajustes: lecturas anteriores a `now − retention_days`.

---

## 10. Diseño UI/UX

### 10.1 Principios

1. **Un vistazo:** la temperatura y el estado de conexión se entienden sin scroll.
2. **Jerarquía clara:** dato principal grande, secundarios en tarjetas.
3. **Moderna pero sobria:** fondos suaves, tarjetas con radios amplios, acento celeste.
4. **Legible en exterior:** contraste alto y modo oscuro real.
5. **Sin ruido:** nada de gráficas en el dashboard; el detalle vive en Histórico.

### 10.2 Tokens

| Token | Claro | Oscuro |
|---|---|---|
| `bg` | `#F8FAFC` | `#0B1220` |
| `surface` | `#FFFFFF` | `#111A2B` |
| `surfaceAlt` | `#F1F5F9` | `#16213A` |
| `text` | `#0F172A` | `#E2E8F0` |
| `textMuted` | `#64748B` | `#94A3B8` |
| `primary` | `#0EA5E9` | `#38BDF8` |
| `success` | `#22C55E` | `#4ADE80` |
| `warning` | `#F59E0B` | `#FBBF24` |
| `danger` | `#EF4444` | `#F87171` |

- Radios: tarjetas 20, chips 999, botones 14.
- Espaciado: escala 4 (`4, 8, 12, 16, 24, 32`).
- Tipografía: fuente del sistema (Roboto) o Inter; display 48/56, H1 28, H2 20, body 15, caption 12.
- Iconografía: `@expo/vector-icons` (Ionicons) o SVG propio.
- Animaciones: transiciones de 150–200 ms; sin animaciones decorativas largas.

### 10.3 Pantallas

#### Dashboard (tab 1)

```
┌───────────────────────────────────┐
│ Estación Chuwi        ● Conectado │
│ Vevor-7in1 · hace 12 s            │
│                                   │
│ ┌───────────────────────────────┐ │
│ │            21.3°              │ │
│ │        Sensación 21.0°        │ │
│ │        Parcialmente nublado   │ │
│ └───────────────────────────────┘ │
│                                   │
│ ┌─────────────┐ ┌───────────────┐ │
│ │ Humedad 46% │ │ Rocío 9.1°    │ │
│ └─────────────┘ └───────────────┘ │
│ ┌─────────────┐ ┌───────────────┐ │
│ │ Viento      │ │ Lluvia        │ │
│ │ 2.4 km/h    │ │ 125.1 mm      │ │
│ │ NO 322°     │ │ +0.0 mm hoy   │ │
│ │        ◔    │ │               │ │
│ └─────────────┘ └───────────────┘ │
│ ┌─────────────┐ ┌───────────────┐ │
│ │ UV 0 Bajo   │ │ Luz 5 695 lx  │ │
│ └─────────────┘ └───────────────┘ │
│ ┌───────────────────────────────┐ │
│ │ Batería OK · actualizado 16:03│ │
│ └───────────────────────────────┘ │
└───────────────────────────────────┘
```

- Chip de conexión con color semántico.
- Tarjetas pulsables que abren detalle (futuro).
- Pull-to-refresh para forzar reconexión.

#### Histórico (tab 2)

- Selector segmentado: `1 h | 24 h | 7 d`.
- Gráfica de línea: temperatura y humedad.
- Gráfica de línea/área: viento medio y máximo.
- Barras: lluvia por intervalo.
- Estado vacío: "Aún no hay datos históricos".

#### Ajustes (tab 3)

- **Conexión:** host, puerto, usuario, password (campo seguro), topic, botón "Probar conexión".
- **Unidades:** °C/°F, km/h / m/s / mph.
- **Tema:** sistema / claro / oscuro.
- **Alertas:** switches y umbrales numéricos.
- **Datos:** retención (días), borrar histórico.
- **Acerca de:** versión, estado del build, enlace a documentación.

### 10.4 Estados transversales

| Estado | Comportamiento |
|---|---|
| Cargando | Skeletons con la forma de las tarjetas |
| Sin datos | Mensaje + icono + botón "Reconectar" |
| Offline | Banner superior persistente con última hora de dato |
| Dato obsoleto | Chip ámbar "Sin datos recientes" |
| Error de credenciales | Snackbar con acción "Revisar ajustes" |
| JSON inválido | Se descarta, se registra en diagnóstico y no se notifica al usuario |

### 10.5 Accesibilidad

- Etiquetas `accessibilityLabel` en tarjetas y brújula (p. ej. "Viento del noroeste, 322 grados, 2.4 kilómetros por hora").
- Soporte de lector de pantalla y tamaño de fuente del sistema.
- No depender solo del color para el estado: incluir texto e icono.
- Objetivos táctiles mínimos de 44×44 dp.

---

## 11. Criterios de aceptación

### CA-01 — Conexión exitosa

```gherkin
Dado que el dispositivo tiene red y credenciales válidas
Cuando abro la app
Entonces el estado muestra "Conectado" en menos de 5 segundos
Y el dashboard muestra la última lectura recibida
```

### CA-02 — Actualización en tiempo real

```gherkin
Dado que la app está conectada y suscrita
Cuando llega un mensaje válido a rtl_433/chuwi/events
Entonces las métricas se actualizan en menos de 500 ms
Y la hora de "última actualización" se refresca
```

### CA-03 — Payload inválido

```gherkin
Dado que llega un mensaje con JSON malformado o campos desconocidos
Cuando la app lo procesa
Entonces no se produce ningún crash
Y la última lectura válida permanece visible
```

### CA-04 — Campos ausentes

```gherkin
Dado un payload sin humidity ni uvi
Cuando se muestra en el dashboard
Entonces esas tarjetas muestran "—"
Y el resto de métricas se muestran con normalidad
```

### CA-05 — Reconexión

```gherkin
Dado que la app está conectada
Cuando se pierde la red durante 30 segundos
Entonces el estado pasa a "Reconectando"
Y al volver la red se reconecta y se resuscribe automáticamente
```

### CA-06 — Persistencia

```gherkin
Dado que la app lleva recibiendo datos
Cuando cierro y vuelvo a abrir la app
Entonces el histórico sigue disponible
Y el dashboard muestra el último dato conocido
```

### CA-07 — Alertas

```gherkin
Dado un umbral de viento máximo de 40 km/h
Cuando wind_max_km_h supera 40
Entonces se muestra una notificación local
Y no se repite hasta pasar el cooldown configurado
```

### CA-08 — Seguridad

```gherkin
Dado que el usuario guarda el password
Cuando se inspecciona el almacenamiento y los logs
Entonces el password no aparece en texto plano ni en logs
Y se almacena en SecureStore
```

### CA-09 — Responsive

```gherkin
Dado un dispositivo de 360 dp de ancho
Cuando se muestra el dashboard
Entonces las tarjetas se distribuyen en 2 columnas sin desbordar
Y en tablets se muestran hasta 3–4 columnas
```

---

## 12. Plan de pruebas

| Tipo | Alcance | Herramientas |
|---|---|---|
| Unitarias | Parser, derivadas (rocío, wind chill, cardinal, UV), unidades | Jest |
| Unitarias | Umbrales, cooldown y deduplicación de alertas | Jest |
| Integración | WSS y TCP contra el broker real: conexión, suscripción y recepción | `npm run test:mqtt:ws`, `npm run test:mqtt` |
| Integración | SQLite: inserción, consultas, agregación y purga | Jest + expo-sqlite |
| Manual | Reconexión, modo avión, credenciales erróneas, payload corrupto | Dispositivo Android |
| UI | Layout 360 dp, tablet, modo oscuro, fuente grande | Dispositivo / emulador |
| Build | Generación de APK/AAB y arranque en dispositivo limpio | EAS Build |
| Rendimiento | Arranque en frío y scroll con 30 días de datos | Perfilado Android Studio |

---

## 13. Hitos

| Hito | Entregable | Criterio de salida |
|---|---|---|
| M0 — Setup | Proyecto Expo + TS + router + dev client compilado | La app arranca en dispositivo |
| M1 — MQTT | Conexión WSS (Expo Go) y TCP, auth, suscripción y parser | Datos reales visibles en consola/UI básica |
| M2 — Dashboard | Diseño final, tarjetas, estados y brújula | CA-01, CA-02, CA-04 y CA-09 |
| M3 — Histórico | SQLite, gráficas y retención | CA-06 |
| M4 — Alertas | Umbrales, notificaciones y cooldown | CA-07 |
| M5 — Calidad | Tests, accesibilidad, build EAS y documentación | Resto de criterios de aceptación |

---

## 14. Riesgos y mitigaciones

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| TCP nativo no funciona en Expo Go | Alta | Alto | Resuelto: WebSocket por defecto y TCP solo en development build |
| Compatibilidad del cliente MQTT propio con el broker | Media | Medio | Smoke tests reales WSS/TCP y codec cubierto por pruebas |
| Credenciales en claro si se usa TCP 1883 | Media | Alto | WSS por defecto; aviso visible al elegir TCP |
| Android limita MQTT en segundo plano | Alta | Medio | Alertas con app abierta en MVP; foreground service en v2 |
| Broker sin WebSocket/TLS | **Resuelto** | — | WSS validado en `wss://mqtt.benicolo.com/mqtt` |
| `time` sin zona horaria | Media | Medio | Interpretar como hora local del dispositivo; guardar `received_at` |
| `rain_mm` acumulado con reinicios | Media | Bajo | Detección de decremento y delta acotado |
| Payload cambia de modelo/campos | Media | Medio | Parser tolerante y diagnóstico de campos desconocidos |
| Histórico crece sin control | Baja | Medio | Retención y purga automática con índice |
| Estación deja de publicar | Media | Medio | Estado "dato obsoleto" y alerta de conexión |

---

## 15. Métricas y analítica

Sin telemetría remota en v1 (privacidad). Se registrarán métricas locales de diagnóstico:

- Uptime de conexión por sesión.
- Número de reconexiones.
- Mensajes recibidos / descartados.
- Latencia entre `received_at` y pintado en UI.
- Alertas disparadas por tipo.

---

## 16. Preguntas abiertas

| ID | Pregunta | Impacto | Responsable |
|---|---|---|---|
| Q-01 | ~~¿Se puede habilitar TLS en 8883 o WSS en 443?~~ **Resuelto: WSS disponible en 443** | Seguridad / release | Infraestructura |
| Q-02 | ¿`time` es hora local o UTC? | Histórico | Propietario |
| Q-03 | ¿Frecuencia real de publicación? | Umbral de obsolescencia | Propietario |
| Q-04 | ¿Se necesita alerta con app cerrada? | Foreground service | Producto |
| Q-05 | ¿Umbrales por defecto adecuados? | UX alertas | Propietario |
| Q-06 | ¿El APK se distribuye fuera de la red local? | Distribución | Producto |

---

## 17. Anexos

### A. Parámetros del broker (referencia)

| Parámetro | Valor |
|---|---|
| URL WSS (por defecto) | `wss://mqtt.benicolo.com/mqtt` |
| Host TCP (opcional) | `mqtt.benicolo.com` |
| Puerto TCP (opcional) | `1883` (sin TLS) |
| Usuario | `toni` |
| Password | `palomo69` |
| Topic | `rtl_433/chuwi/events` |
| Subprotocolo WS | `mqtt` |
| QoS | `0` |
| Client ID | `estacio-android-<random>` |

> Estos valores son la configuración por defecto de desarrollo. En la app se guardan en SecureStore y son editables. Nunca deben incluirse en el APK de producción ni en el repositorio.

### B. Skills recomendados (`find-skills`)

Búsqueda realizada con `npx skills find expo`, `npx skills find "react native"` y `npx skills find mqtt`.

| Skill | Instalaciones | Uso |
|---|---|---|
| `expo/skills@expo-ui` | 36.4K | Componentes y patrones de UI Expo |
| `expo/skills@expo-native-ui` | 37.1K | UI nativa y navegación |
| `expo/skills@expo-router` | 32.6K | Estructura de rutas y tabs |
| `expo/skills@expo-project-structure` | 25.8K | Organización del proyecto |
| `expo/skills@expo-data-fetching` | 32.3K | Patrones de datos y estado |
| `expo/skills@expo-deployment` | 40.2K | Builds y distribución EAS |
| `vercel-labs/agent-skills@vercel-react-native-skills` | 274.9K | Rendimiento y buenas prácticas RN |
| `callstackincubator/agent-skills@react-native-best-practices` | 32.2K | Buenas prácticas RN |
| `mindrally/skills@mqtt-development` | 1.1K | Referencia MQTT (calidad moderada) |

Ya instalados en el repositorio (`skills-lock.json`): `expo/skills@expo-dev-client` y `vercel-labs/skills@find-skills`.

Instalación sugerida:

```bash
npx skills add expo/skills@expo-ui -g -y
npx skills add expo/skills@expo-native-ui -g -y
npx skills add expo/skills@expo-router -g -y
npx skills add expo/skills@expo-project-structure -g -y
npx skills add vercel-labs/agent-skills@vercel-react-native-skills -g -y
```

### C. Comandos de referencia

```bash
# Instalar dependencias
npm install

# Ejecutar en Expo Go (WSS)
npm run start:go

# Development build (TCP opcional)
npx expo prebuild
npx expo run:android
eas build --profile development --platform android

# Pruebas
npm test
npm run test:mqtt:ws
npm run test:mqtt
```

### D. Definición de terminado (DoD)

- Todos los requisitos `Must` implementados y verificados.
- Criterios de aceptación CA-01 a CA-09 en verde.
- Sin crashes en las pruebas manuales.
- Credenciales fuera de logs y del código fuente.
- Build de desarrollo instalable en un dispositivo limpio.
- `README` con instrucciones de build y configuración.
- WSS activo por defecto y advertencia visible si se selecciona TCP 1883.

---

*Fin del documento.*
