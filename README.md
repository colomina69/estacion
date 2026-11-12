# Estación Meteorológica — Android / Expo

App Android desarrollada con Expo para visualizar en tiempo real la estación **Vevor-7in1** publicada por `rtl_433` en el broker MQTT `mqtt.benicolo.com`.

Dashboard en vivo, histórico local con gráficas y alertas por umbral. Usa **MQTT sobre WebSocket seguro (WSS)**, por lo que funciona directamente en **Expo Go**; el transporte TCP queda disponible para development builds. El diseño, requisitos y criterios de aceptación están en [`PRD.md`](./PRD.md).

## Funcionalidad

- Conexión MQTT 3.1.1 por WebSocket seguro (WSS) o TCP, con autenticación y reconexión exponencial.
- Suscripción a `rtl_433/chuwi/events` y parseo tolerante del payload.
- Dashboard con temperatura, sensación térmica, humedad, punto de rocío, viento, brújula, lluvia de hoy, intensidad máxima, lluvia acumulada, UV, luminosidad y batería.
- Estado de conexión, última actualización y aviso de dato obsoleto.
- Histórico en SQLite con gráficas de 1 h, 24 h y 7 días.
- Alertas locales configurables: viento, lluvia, temperatura, UV, batería y pérdida de datos.
- Ajustes de broker, credenciales, unidades, tema y retención.
- Modo claro/oscuro y diseño responsive para móvil y tablet.

## Requisitos

- Node.js 20+ (probado con Node 24).
- Android 7.0+ y un dispositivo o emulador.
- **Expo Go con SDK 58** para la ejecución rápida por WSS.
- Development build solo si quieres usar el transporte TCP nativo.

## Ejecutar en Expo Go

```bash
npm install
npm run start:go
```

Escanea el QR con Expo Go en Android. La app detecta Expo Go y usa automáticamente:

```
wss://mqtt.benicolo.com/mqtt
```

No hace falta instalar nada nativo ni ejecutar un bridge.

Si usas el **emulador de Android** y la carga por LAN falla, arranca con localhost y `adb reverse`:

```bash
npx expo start --go --localhost --android
```

> Si Expo Go muestra un error de versión, actualízalo desde Play Store: el proyecto usa **Expo SDK 58**.

## Development build (opcional, para TCP)

```bash
npx expo prebuild
npx expo run:android
```

También puedes generar un development build con EAS:

```bash
npx eas build --profile development --platform android
```

## Comandos

| Comando | Descripción |
|---|---|
| `npm run start:go` | Inicia Metro para **Expo Go** |
| `npm start` | Inicia Metro para development build |
| `npm run android` | Compila e instala el development build |
| `npm run prebuild` | Genera las carpetas nativas (`android/`) |
| `npm run typecheck` | TypeScript en modo estricto |
| `npm test` | Pruebas de parser, derivadas y unidades |
| `npm run test:mqtt:ws` | Prueba real WSS (la que usa Expo Go) |
| `npm run test:mqtt` | Prueba real TCP 1883 |

## Configuración

Los valores por defecto son:

| Parámetro | Valor |
|---|---|
| Transporte | WebSocket seguro `wss://mqtt.benicolo.com/mqtt` |
| Host TCP (opcional) | `mqtt.benicolo.com` |
| Puerto TCP (opcional) | `1883` |
| Usuario | `toni` |
| Password | `palomo69` |
| Topic | `rtl_433/chuwi/events` |

Se pueden cambiar desde **Ajustes**. Las credenciales se guardan con `expo-secure-store`, nunca en logs ni en el código de la pantalla.

> **Seguridad:** WSS cifra la conexión con TLS y es el valor por defecto. El transporte TCP 1883 no cifra las credenciales; úsalo solo en una red de confianza.

## Arquitectura

```
app/                      Rutas de expo-router
  (tabs)/index.tsx        Dashboard
  (tabs)/history.tsx      Histórico y gráficas
  (tabs)/settings.tsx     Ajustes
src/
  mqtt/codec.ts           Codec MQTT 3.1.1 (CONNECT, SUBSCRIBE, PUBLISH, PING)
  mqtt/transport.ts       Transporte WebSocket (Expo Go) y TCP (dev build)
  mqtt/client.ts          Cliente, reconexión y keepalive
  mqtt/parser.ts          Normalización del payload de rtl_433
  db/database.ts          SQLite, consultas y agregaciones
  station/                Servicio que conecta MQTT con los stores
  alerts/                 Evaluación de umbrales y notificaciones
  store/                  Zustand (weather, history, settings)
  ui/                     Tema y componentes reutilizables
scripts/                  Pruebas de lógica y smoke test MQTT
```

El cliente MQTT es una implementación mínima de MQTT 3.1.1, con QoS 0, keepalive, reconexión con backoff y validación de `CONNACK`/`SUBACK`. Usa el `WebSocket` global de React Native (compatible con Expo Go) o `react-native-tcp-socket` en development builds. Esto evita los polyfills de Node que requiere `mqtt.js` en React Native.

## Limitaciones conocidas

- TCP requiere un development build; Expo Go usa WSS automáticamente.
- En Expo Go las notificaciones locales pueden estar limitadas; para alertas fiables usa un development build.
- Las alertas en segundo plano requieren la app abierta o reciente; no hay foreground service en esta versión.
- iOS no se ha probado.
- `rain_mm` se interpreta como contador acumulado; los reinicios del contador se detectan como delta no negativo.
- La hora `time` del payload se interpreta como hora local del dispositivo.

## Documentación

- [`PRD.md`](./PRD.md) — producto, requisitos, diseño, criterios de aceptación y riesgos.
