import Constants from 'expo-constants';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { DEFAULT_SETTINGS } from '../../src/config/defaults';
import { clearReadings, countReadings } from '../../src/db/database';
import {
  influxConfigFromSettings,
  testInfluxConnection,
} from '../../src/influx/client';
import { isExpoGo } from '../../src/lib/environment';
import { stationService } from '../../src/station/stationService';
import { useSettingsStore } from '../../src/store/settingsStore';
import { useHistoryStore } from '../../src/store/historyStore';
import { useWeatherStore } from '../../src/store/weatherStore';
import { AppText, Button, Card, Screen, SectionHeader } from '../../src/ui/components/base';
import { SegmentedControl, SwitchRow, TextField } from '../../src/ui/components/inputs';
import { spacing, useTheme } from '../../src/ui/theme';
import type {
  HistorySource,
  MqttTransportType,
  Settings,
  ThemePreference,
  UnitSystem,
} from '../../src/types/weather';

interface FormState {
  host: string;
  port: string;
  transport: MqttTransportType;
  wsUrl: string;
  username: string;
  password: string;
  topic: string;
  units: UnitSystem;
  theme: ThemePreference;
  retentionDays: string;
  alertsEnabled: boolean;
  windMaxKmh: string;
  rainDeltaMm: string;
  tempHighC: string;
  tempLowC: string;
  uvi: string;
  cooldownMinutes: string;
  offlineMinutes: string;
  battery: boolean;
  historySource: HistorySource;
  influxUrl: string;
  influxOrg: string;
  influxBucket: string;
  influxMeasurement: string;
  influxDevice: string;
  influxToken: string;
}

function fromSettings(settings: Settings): FormState {
  return {
    host: settings.host,
    port: String(settings.port),
    transport: settings.transport,
    wsUrl: settings.wsUrl,
    username: settings.username,
    password: settings.password,
    topic: settings.topic,
    units: settings.units,
    theme: settings.theme,
    retentionDays: String(settings.retentionDays),
    alertsEnabled: settings.alertsEnabled,
    windMaxKmh: String(settings.thresholds.windMaxKmh),
    rainDeltaMm: String(settings.thresholds.rainDeltaMm),
    tempHighC: String(settings.thresholds.tempHighC),
    tempLowC: String(settings.thresholds.tempLowC),
    uvi: String(settings.thresholds.uvi),
    cooldownMinutes: String(settings.thresholds.cooldownMinutes),
    offlineMinutes: String(settings.thresholds.offlineMinutes),
    battery: settings.thresholds.battery,
    historySource: settings.historySource,
    influxUrl: settings.influxUrl,
    influxOrg: settings.influxOrg,
    influxBucket: settings.influxBucket,
    influxMeasurement: settings.influxMeasurement,
    influxDevice: settings.influxDevice,
    influxToken: settings.influxToken,
  };
}

function parseNumber(value: string, fallback: number): number {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toSettings(form: FormState): Settings {
  const port = Math.round(parseNumber(form.port, DEFAULT_SETTINGS.port));
  return {
    host: form.host.trim(),
    port,
    transport: form.transport,
    wsUrl: form.wsUrl.trim(),
    username: form.username.trim(),
    password: form.password,
    topic: form.topic.trim(),
    units: form.units,
    theme: form.theme,
    retentionDays: Math.max(1, Math.round(parseNumber(form.retentionDays, 30))),
    alertsEnabled: form.alertsEnabled,
    thresholds: {
      windMaxKmh: parseNumber(form.windMaxKmh, 40),
      rainDeltaMm: parseNumber(form.rainDeltaMm, 2),
      tempHighC: parseNumber(form.tempHighC, 35),
      tempLowC: parseNumber(form.tempLowC, 2),
      uvi: parseNumber(form.uvi, 8),
      cooldownMinutes: Math.max(1, parseNumber(form.cooldownMinutes, 30)),
      offlineMinutes: Math.max(1, parseNumber(form.offlineMinutes, 10)),
      battery: form.battery,
    },
    historySource: form.historySource,
    influxUrl: form.influxUrl.trim(),
    influxOrg: form.influxOrg.trim(),
    influxBucket: form.influxBucket.trim(),
    influxMeasurement: form.influxMeasurement.trim(),
    influxDevice: form.influxDevice.trim(),
    influxToken: form.influxToken.trim(),
  };
}

export default function SettingsScreen() {
  const { colors } = useTheme();
  const settings = useSettingsStore((state) => state.settings);
  const loaded = useSettingsStore((state) => state.loaded);
  const update = useSettingsStore((state) => state.update);
  const reset = useSettingsStore((state) => state.reset);
  const [form, setForm] = useState<FormState>(() => fromSettings(settings));
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingInflux, setTestingInflux] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: 'ok' | 'error';
    text: string;
  } | null>(null);
  const [influxFeedback, setInfluxFeedback] = useState<{
    kind: 'ok' | 'error';
    text: string;
  } | null>(null);
  const [readings, setReadings] = useState<number | null>(null);

  useEffect(() => {
    if (loaded) setForm(fromSettings(settings));
    // Only resynchronize when the persisted settings finish loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  useEffect(() => {
    void countReadings().then(setReadings);
  }, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const usingWebSocket = isExpoGo() || form.transport === 'ws';

  const validateInflux = (): string | null => {
    if (form.historySource !== 'influx') return null;
    if (!/^https?:\/\//i.test(form.influxUrl.trim())) {
      return 'La URL de InfluxDB debe empezar por http:// o https://.';
    }
    if (!form.influxOrg.trim()) {
      return 'La organización de InfluxDB no puede estar vacía.';
    }
    if (!form.influxBucket.trim()) {
      return 'El bucket de InfluxDB no puede estar vacío.';
    }
    if (!form.influxMeasurement.trim()) {
      return 'El measurement de InfluxDB no puede estar vacío.';
    }
    if (!form.influxToken.trim()) {
      return 'El token de InfluxDB no puede estar vacío.';
    }
    return null;
  };

  const validate = (): string | null => {
    if (usingWebSocket) {
      if (!/^wss?:\/\//i.test(form.wsUrl.trim())) {
        return 'La URL WebSocket debe empezar por ws:// o wss://.';
      }
    } else {
      if (!form.host.trim()) return 'El host no puede estar vacío.';
      const port = Math.round(parseNumber(form.port, 0));
      if (port < 1 || port > 65535) {
        return 'El puerto debe estar entre 1 y 65535.';
      }
    }
    if (!form.topic.trim()) return 'El topic no puede estar vacío.';
    return validateInflux();
  };

  const handleSave = async () => {
    const validation = validate();
    if (validation) {
      setFeedback({ kind: 'error', text: validation });
      return;
    }
    setSaving(true);
    try {
      await update(toSettings(form));
      await stationService.restart();
      void useHistoryStore.getState().load();
      setFeedback({ kind: 'ok', text: 'Ajustes guardados y conexión reiniciada.' });
    } catch (error) {
      setFeedback({
        kind: 'error',
        text: error instanceof Error ? error.message : 'No se pudieron guardar los ajustes.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    const validation = validate();
    if (validation) {
      setFeedback({ kind: 'error', text: validation });
      return;
    }
    setTesting(true);
    setFeedback(null);
    try {
      const result = await stationService.testConnection(toSettings(form));
      setFeedback({ kind: result.ok ? 'ok' : 'error', text: result.message });
    } finally {
      setTesting(false);
    }
  };

  const handleTestInflux = async () => {
    const validation = validateInflux();
    if (validation) {
      setFeedback({ kind: 'error', text: validation });
      return;
    }
    setTestingInflux(true);
    setInfluxFeedback(null);
    try {
      const result = await testInfluxConnection(
        influxConfigFromSettings(toSettings(form)),
      );
      setInfluxFeedback({
        kind: result.ok ? 'ok' : 'error',
        text: result.message,
      });
    } finally {
      setTestingInflux(false);
    }
  };

  const handleUnits = async (units: UnitSystem) => {
    set('units', units);
    await update({ units });
  };

  const handleTheme = async (theme: ThemePreference) => {
    set('theme', theme);
    await update({ theme });
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Borrar histórico',
      'Se eliminarán todas las lecturas y alertas guardadas en este dispositivo. La conexión MQTT continuará activa.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            await clearReadings();
            setReadings(0);
            useWeatherStore.getState().setRainStats({ totalMm: 0, maxRateMmH: null });
            await useHistoryStore.getState().load();
            setFeedback({ kind: 'ok', text: 'Histórico eliminado.' });
          },
        },
      ],
    );
  };

  const runtimeVersion = Constants.expoConfig?.runtimeVersion;
  const buildLabel =
    typeof runtimeVersion === 'string' ? runtimeVersion : 'development';

  const handleReset = () => {
    Alert.alert(
      'Restablecer ajustes',
      'Se restaurarán el broker, las credenciales y los umbrales por defecto.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restablecer',
          style: 'destructive',
          onPress: async () => {
            await reset();
            setForm(fromSettings(DEFAULT_SETTINGS));
            await stationService.restart();
            setFeedback({ kind: 'ok', text: 'Ajustes restablecidos.' });
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title">Ajustes</AppText>
        <AppText variant="caption">Broker MQTT, unidades y alertas</AppText>
      </View>

      {feedback ? (
        <Card
          style={[
            styles.feedback,
            {
              backgroundColor:
                feedback.kind === 'ok' ? colors.successSoft : colors.dangerSoft,
              borderColor:
                feedback.kind === 'ok' ? colors.success : colors.danger,
            },
          ]}
        >
          <AppText
            variant="bodyStrong"
            color={feedback.kind === 'ok' ? colors.success : colors.danger}
          >
            {feedback.text}
          </AppText>
        </Card>
      ) : null}

      <SectionHeader title="Conexión MQTT" subtitle="Broker y topic de la estación" />
      <Card>
        {isExpoGo() ? (
          <View style={{ marginBottom: spacing.md }}>
            <AppText variant="label">Transporte</AppText>
            <AppText variant="caption" style={{ marginTop: 4 }}>
              Expo Go conecta por WebSocket seguro (WSS). TCP requiere un
              development build.
            </AppText>
          </View>
        ) : (
          <>
            <AppText variant="label" style={{ marginBottom: 6 }}>
              Transporte
            </AppText>
            <SegmentedControl
              options={[
                { value: 'ws', label: 'WebSocket (WSS)' },
                { value: 'tcp', label: 'TCP' },
              ]}
              value={form.transport}
              onChange={(value) => set('transport', value)}
            />
            <View style={{ height: spacing.md }} />
          </>
        )}

        {usingWebSocket ? (
          <TextField
            label="URL WebSocket"
            value={form.wsUrl}
            onChangeText={(value) => set('wsUrl', value)}
            placeholder="wss://mqtt.benicolo.com/mqtt"
            hint="Conexión cifrada por TLS. El broker acepta el subprotocolo mqtt."
          />
        ) : (
          <>
            <TextField
              label="Host"
              value={form.host}
              onChangeText={(value) => set('host', value)}
              placeholder="mqtt.benicolo.com"
            />
            <TextField
              label="Puerto"
              value={form.port}
              onChangeText={(value) => set('port', value)}
              keyboardType="number-pad"
              placeholder="1883"
              hint="TCP 1883 no cifra las credenciales."
            />
          </>
        )}

        <TextField
          label="Usuario"
          value={form.username}
          onChangeText={(value) => set('username', value)}
        />
        <TextField
          label="Contraseña"
          value={form.password}
          onChangeText={(value) => set('password', value)}
          secure
        />
        <TextField
          label="Topic"
          value={form.topic}
          onChangeText={(value) => set('topic', value)}
          placeholder="rtl_433/chuwi/events"
        />
        <View style={styles.buttonRow}>
          <Button
            title="Probar conexión"
            variant="secondary"
            icon="wifi-outline"
            onPress={handleTest}
            loading={testing}
            style={styles.flex}
          />
          <Button
            title="Guardar"
            icon="save-outline"
            onPress={handleSave}
            loading={saving}
            style={styles.flex}
          />
        </View>
      </Card>

      <SectionHeader title="Unidades y tema" />
      <Card>
        <AppText variant="label" style={{ marginBottom: 6 }}>
          Unidades
        </AppText>
        <SegmentedControl
          options={[
            { value: 'metric', label: 'Métrico' },
            { value: 'imperial', label: 'Imperial' },
          ]}
          value={form.units}
          onChange={handleUnits}
        />
        <AppText variant="label" style={{ marginTop: spacing.lg, marginBottom: 6 }}>
          Tema
        </AppText>
        <SegmentedControl
          options={[
            { value: 'system', label: 'Sistema' },
            { value: 'light', label: 'Claro' },
            { value: 'dark', label: 'Oscuro' },
          ]}
          value={form.theme}
          onChange={handleTheme}
        />
      </Card>

      <SectionHeader title="Alertas" subtitle="Notificaciones locales por umbral" />
      <Card>
        <SwitchRow
          label="Activar alertas"
          description="Viento, lluvia, temperatura, UV, batería y pérdida de datos"
          icon="notifications-outline"
          value={form.alertsEnabled}
          onValueChange={(value) => set('alertsEnabled', value)}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.numberGrid}>
          <TextField
            label="Viento máx. (km/h)"
            value={form.windMaxKmh}
            onChangeText={(value) => set('windMaxKmh', value)}
            keyboardType="decimal-pad"
            style={styles.flex}
          />
          <TextField
            label="Lluvia (L)"
            value={form.rainDeltaMm}
            onChangeText={(value) => set('rainDeltaMm', value)}
            keyboardType="decimal-pad"
            style={styles.flex}
          />
        </View>
        <View style={styles.numberGrid}>
          <TextField
            label="Temp. máx. (°C)"
            value={form.tempHighC}
            onChangeText={(value) => set('tempHighC', value)}
            keyboardType="decimal-pad"
            style={styles.flex}
          />
          <TextField
            label="Temp. mín. (°C)"
            value={form.tempLowC}
            onChangeText={(value) => set('tempLowC', value)}
            keyboardType="decimal-pad"
            style={styles.flex}
          />
        </View>
        <View style={styles.numberGrid}>
          <TextField
            label="Índice UV"
            value={form.uvi}
            onChangeText={(value) => set('uvi', value)}
            keyboardType="decimal-pad"
            style={styles.flex}
          />
          <TextField
            label="Cooldown (min)"
            value={form.cooldownMinutes}
            onChangeText={(value) => set('cooldownMinutes', value)}
            keyboardType="number-pad"
            style={styles.flex}
          />
        </View>
        <TextField
          label="Avisar si no hay datos (min)"
          value={form.offlineMinutes}
          onChangeText={(value) => set('offlineMinutes', value)}
          keyboardType="number-pad"
        />
        <SwitchRow
          label="Avisar de batería baja"
          icon="battery-half-outline"
          value={form.battery}
          onValueChange={(value) => set('battery', value)}
        />
        <AppText variant="caption" style={{ marginTop: spacing.sm }}>
          Los umbrales se expresan siempre en unidades métricas. Las alertas en
          segundo plano requieren la app abierta o reciente.
        </AppText>
        <Button
          title="Guardar alertas"
          onPress={handleSave}
          loading={saving}
          style={{ marginTop: spacing.md }}
        />
      </Card>

      <SectionHeader
        title="Histórico (InfluxDB)"
        subtitle="Fuente de los datos de las gráficas"
      />
      <Card>
        <AppText variant="label" style={{ marginBottom: 6 }}>
          Fuente del histórico
        </AppText>
        <SegmentedControl
          options={[
            { value: 'influx', label: 'InfluxDB' },
            { value: 'local', label: 'Local' },
          ]}
          value={form.historySource}
          onChange={(value) => set('historySource', value)}
        />

        {form.historySource === 'influx' ? (
          <>
            <View style={{ height: spacing.md }} />
            <TextField
              label="URL"
              value={form.influxUrl}
              onChangeText={(value) => set('influxUrl', value)}
              placeholder="https://influx.benicolo.com"
            />
            <View style={styles.numberGrid}>
              <TextField
                label="Organización"
                value={form.influxOrg}
                onChangeText={(value) => set('influxOrg', value)}
                style={styles.flex}
              />
              <TextField
                label="Bucket"
                value={form.influxBucket}
                onChangeText={(value) => set('influxBucket', value)}
                style={styles.flex}
              />
            </View>
            <View style={styles.numberGrid}>
              <TextField
                label="Measurement"
                value={form.influxMeasurement}
                onChangeText={(value) => set('influxMeasurement', value)}
                style={styles.flex}
              />
              <TextField
                label="Device (tag)"
                value={form.influxDevice}
                onChangeText={(value) => set('influxDevice', value)}
                hint="Vacío para todos"
                style={styles.flex}
              />
            </View>
            <TextField
              label="Token API"
              value={form.influxToken}
              onChangeText={(value) => set('influxToken', value)}
              secure
              hint="Se guarda cifrado con SecureStore."
            />
            <Button
              title="Probar InfluxDB"
              variant="secondary"
              icon="server-outline"
              onPress={handleTestInflux}
              loading={testingInflux}
            />
            {influxFeedback ? (
              <AppText
                variant="bodyStrong"
                color={
                  influxFeedback.kind === 'ok' ? colors.success : colors.danger
                }
                style={{ marginTop: spacing.sm }}
              >
                {influxFeedback.text}
              </AppText>
            ) : null}
            <AppText variant="caption" style={{ marginTop: spacing.sm }}>
              Consultas Flux agregadas: 1 min (1 h), 5 min (24 h) y 30 min
              (7 días).
            </AppText>
          </>
        ) : (
          <AppText variant="caption" style={{ marginTop: spacing.sm }}>
            Se usarán las lecturas guardadas localmente en SQLite.
          </AppText>
        )}

        <Button
          title="Guardar y recargar histórico"
          onPress={handleSave}
          loading={saving}
          style={{ marginTop: spacing.md }}
        />
      </Card>

      <SectionHeader title="Datos" subtitle="Caché local para vivo y alertas" />
      <Card>
        <TextField
          label="Retención (días)"
          value={form.retentionDays}
          onChangeText={(value) => set('retentionDays', value)}
          keyboardType="number-pad"
        />
        <AppText variant="caption">
          {readings === null
            ? 'Calculando lecturas…'
            : `${readings.toLocaleString('es-ES')} lecturas guardadas`}
        </AppText>
        <Button
          title="Borrar histórico"
          variant="danger"
          icon="trash-outline"
          onPress={handleClearHistory}
          style={{ marginTop: spacing.md }}
        />
        <Button
          title="Guardar retención"
          variant="secondary"
          onPress={handleSave}
          loading={saving}
          style={{ marginTop: spacing.sm }}
        />
      </Card>

      <SectionHeader title="Acerca de" />
      <Card>
        <View style={styles.aboutRow}>
          <AppText variant="caption">Versión</AppText>
          <AppText variant="caption">
            {Constants.expoConfig?.version ?? '1.0.0'}
          </AppText>
        </View>
        <View style={styles.aboutRow}>
          <AppText variant="caption">Build</AppText>
          <AppText variant="caption">{buildLabel}</AppText>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.warningRow}>
          <AppText variant="bodyStrong" color={colors.warning}>
            Transporte y cifrado
          </AppText>
          <AppText variant="caption" style={{ marginTop: 2 }}>
            WebSocket usa TLS (wss) y es el transporte recomendado, compatible
            con Expo Go. Si eliges TCP 1883, el usuario y la contraseña viajan
            sin cifrar.
          </AppText>
        </View>
        <Button
          title="Restablecer ajustes"
          variant="ghost"
          icon="refresh-outline"
          onPress={handleReset}
          style={{ marginTop: spacing.md }}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.sm,
    marginBottom: spacing.lg,
    gap: 2,
  },
  feedback: {
    marginBottom: spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  numberGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  flex: { flex: 1 },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.md,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  warningRow: {
    paddingVertical: spacing.sm,
  },
});
