import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { STALE_AFTER_MS } from '../../src/config/defaults';
import {
  cardinalFromDeg,
  dewPointC,
  feelsLikeC,
  luxCategory,
  uvCategory,
} from '../../src/lib/derived';
import { formatClock, formatDateTime, formatRelative } from '../../src/lib/time';
import {
  formatNumber,
  formatRain,
  formatRainRate,
  formatTemperature,
  formatWind,
} from '../../src/lib/units';
import { stationService } from '../../src/station/stationService';
import { useSettingsStore } from '../../src/store/settingsStore';
import { useWeatherStore } from '../../src/store/weatherStore';
import { AppText, Button, Card, EmptyState, Screen, Skeleton } from '../../src/ui/components/base';
import { Compass, ConnectionChip, MetricCard } from '../../src/ui/components/weather';
import { spacing, useTheme } from '../../src/ui/theme';
import type { Reading } from '../../src/types/weather';

function useNow(intervalMs = 10_000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function conditionFor(reading: Reading): {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
} {
  const lux = reading.lightLux;
  if ((reading.rainDeltaMm ?? 0) > 0) {
    return { icon: 'rainy', label: 'Lluvia' };
  }
  if (lux !== null && lux < 20) {
    return { icon: 'moon', label: 'Noche despejada' };
  }
  if (lux !== null && lux < 1_000) {
    return { icon: 'cloudy', label: 'Nublado' };
  }
  if ((reading.uvi ?? 0) >= 6) {
    return { icon: 'sunny', label: 'Soleado' };
  }
  return { icon: 'partly-sunny', label: 'Parcialmente nublado' };
}

export default function DashboardScreen() {
  const { colors, isDark } = useTheme();
  const latest = useWeatherStore((state) => state.latest);
  const status = useWeatherStore((state) => state.status);
  const statusDetail = useWeatherStore((state) => state.statusDetail);
  const error = useWeatherStore((state) => state.error);
  const lastMessageAt = useWeatherStore((state) => state.lastMessageAt);
  const receivedCount = useWeatherStore((state) => state.receivedCount);
  const discardedCount = useWeatherStore((state) => state.discardedCount);
  const rainTodayMm = useWeatherStore((state) => state.rainTodayMm);
  const rainMaxRateMmH = useWeatherStore((state) => state.rainMaxRateMmH);
  const settings = useSettingsStore((state) => state.settings);
  const now = useNow();
  const [refreshing, setRefreshing] = useState(false);

  const stale =
    lastMessageAt !== null && now - lastMessageAt > STALE_AFTER_MS;
  const units = settings.units;

  const handleRetry = () => {
    void stationService.restart();
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await stationService.restart();
    setTimeout(() => setRefreshing(false), 900);
  };

  const heroGradient = isDark
    ? (['#0C4A6E', '#082F49'] as const)
    : (['#0284C7', '#0EA5E9'] as const);

  return (
    <Screen refreshing={refreshing} onRefresh={handleRefresh}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <AppText variant="title">Estación</AppText>
          <AppText variant="caption">
            {latest?.model ?? 'Vevor-7in1'}
            {latest?.stationId !== null && latest?.stationId !== undefined
              ? ` · ID ${latest.stationId}`
              : ''}
          </AppText>
        </View>
        <ConnectionChip status={status} detail={statusDetail} />
      </View>

      {error && status === 'error' ? (
        <Card
          style={[
            styles.banner,
            { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
          ]}
        >
          <View style={styles.bannerRow}>
            <Ionicons name="alert-circle" size={20} color={colors.danger} />
            <View style={styles.flex}>
              <AppText variant="bodyStrong" color={colors.danger}>
                No se puede conectar
              </AppText>
              <AppText variant="caption" style={{ marginTop: 2 }}>
                {error}
              </AppText>
            </View>
          </View>
          <Button
            title="Reintentar"
            variant="secondary"
            onPress={handleRetry}
            style={{ marginTop: spacing.md }}
          />
        </Card>
      ) : null}

      {stale && status === 'connected' ? (
        <Card
          style={[
            styles.banner,
            { backgroundColor: colors.warningSoft, borderColor: colors.warning },
          ]}
        >
          <View style={styles.bannerRow}>
            <Ionicons name="time" size={20} color={colors.warning} />
            <View style={styles.flex}>
              <AppText variant="bodyStrong" color={colors.warning}>
                Sin datos recientes
              </AppText>
              <AppText variant="caption" style={{ marginTop: 2 }}>
                Último mensaje {formatRelative(lastMessageAt, now)}.
              </AppText>
            </View>
          </View>
        </Card>
      ) : null}

      {status === 'reconnecting' && statusDetail ? (
        <AppText variant="caption" style={styles.reconnectText}>
          {statusDetail}
        </AppText>
      ) : null}

      {!latest ? (
        status === 'connecting' || status === 'reconnecting' ? (
          <View style={{ gap: spacing.md }}>
            <Skeleton height={190} />
            <View style={styles.row}>
              <Skeleton height={112} width="48%" />
              <Skeleton height={112} width="48%" />
            </View>
            <Skeleton height={150} />
          </View>
        ) : (
          <EmptyState
            icon="cloud-offline-outline"
            title="Esperando datos de la estación"
            message="Comprueba la conexión con el broker MQTT y vuelve a intentarlo."
            actionLabel="Reconectar"
            onAction={handleRetry}
          />
        )
      ) : (
        <>
          <LinearGradient
            colors={heroGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroTop}>
              <View style={styles.flex}>
                <AppText variant="label" color="rgba(255,255,255,0.72)">
                  Temperatura
                </AppText>
                <AppText variant="display" color="#FFFFFF" style={{ marginTop: 2 }}>
                  {formatTemperature(latest.temperatureC, units)}
                </AppText>
              </View>
              <Ionicons
                name={conditionFor(latest).icon}
                size={64}
                color="rgba(255,255,255,0.9)"
              />
            </View>
            <View style={styles.heroBottom}>
              <AppText variant="bodyStrong" color="#FFFFFF">
                {conditionFor(latest).label}
              </AppText>
              <AppText variant="caption" color="rgba(255,255,255,0.82)">
                Sensación {formatTemperature(feelsLikeC(latest), units)}
              </AppText>
            </View>
          </LinearGradient>

          <View style={styles.row}>
            <MetricCard
              icon="water-outline"
              label="Humedad"
              value={`${formatNumber(latest.humidity, 0)}%`}
              subtitle={`Rocío ${formatTemperature(
                dewPointC(latest.temperatureC, latest.humidity),
                units,
              )}`}
              accent="#0EA5E9"
            />
            <MetricCard
              icon="thermometer-outline"
              label="Sensación"
              value={formatTemperature(feelsLikeC(latest), units)}
              subtitle={
                latest.micValid ? 'Lectura verificada' : 'Checksum dudoso'
              }
              accent="#8B5CF6"
            />
          </View>

          <Card style={styles.windCard}>
            <View style={styles.flex}>
              <AppText variant="label">Viento</AppText>
              <AppText variant="heading" style={{ marginTop: 4 }}>
                {formatWind(latest.windAvgKmh, units)}
              </AppText>
              <AppText variant="caption" style={{ marginTop: 2 }}>
                Máx. {formatWind(latest.windMaxKmh, units)}
              </AppText>
              <AppText variant="bodyStrong" style={{ marginTop: spacing.sm }}>
                {cardinalFromDeg(latest.windDirDeg).label}
              </AppText>
            </View>
            <Compass degrees={latest.windDirDeg} size={104} />
          </Card>

          <View style={styles.row}>
            <MetricCard
              icon="rainy-outline"
              label="Lluvia hoy"
              value={formatRain(rainTodayMm, units, 2)}
              subtitle="Desde las 00:00"
              accent="#2563EB"
            />
            <MetricCard
              icon="speedometer-outline"
              label="Intensidad máx."
              value={formatRainRate(rainMaxRateMmH, units)}
              subtitle="Máx. entre lecturas"
              accent="#1D4ED8"
            />
          </View>

          <View style={styles.row}>
            <MetricCard
              icon="water-outline"
              label="Lluvia total"
              value={formatRain(latest.rainMm, units)}
              subtitle="Acumulado de la estación"
              accent="#0EA5E9"
            />
            <MetricCard
              icon="sunny-outline"
              label="Índice UV"
              value={formatNumber(latest.uvi, 1)}
              subtitle={uvCategory(latest.uvi).label}
              accent="#F59E0B"
            />
          </View>

          <View style={styles.row}>
            <MetricCard
              icon="bulb-outline"
              label="Luminosidad"
              value={
                latest.lightLux !== null
                  ? `${latest.lightLux.toLocaleString('es-ES', {
                      maximumFractionDigits: 0,
                    })} lx`
                  : '—'
              }
              subtitle={luxCategory(latest.lightLux)}
              accent="#FBBF24"
            />
            <MetricCard
              icon={
                latest.batteryOk === 0 ? 'battery-dead' : 'battery-full-outline'
              }
              label="Batería"
              value={
                latest.batteryOk === 1
                  ? 'OK'
                  : latest.batteryOk === 0
                    ? 'Baja'
                    : '—'
              }
              subtitle="Estación exterior"
              accent={latest.batteryOk === 0 ? colors.danger : colors.success}
            />
          </View>

          <Card style={{ marginTop: spacing.md }}>
            <View style={styles.footerGrid}>
              <View style={styles.footerItem}>
                <AppText variant="label">Última actualización</AppText>
                <AppText variant="bodyStrong">
                  {formatClock(latest.stationTimeMs ?? latest.receivedAt)}
                </AppText>
                <AppText variant="caption">
                  {formatRelative(lastMessageAt, now)}
                </AppText>
              </View>
              <View style={styles.footerItem}>
                <AppText variant="label">Recibido</AppText>
                <AppText variant="bodyStrong">
                  {formatDateTime(latest.receivedAt)}
                </AppText>
                <AppText variant="caption">
                  {receivedCount} mensajes · {discardedCount} descartados
                </AppText>
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.footerRow}>
              <AppText variant="caption">Modelo</AppText>
              <AppText variant="caption">{latest.model ?? '—'}</AppText>
            </View>
            <View style={styles.footerRow}>
              <AppText variant="caption">Canal</AppText>
              <AppText variant="caption">{latest.channel ?? '—'}</AppText>
            </View>
            <View style={styles.footerRow}>
              <AppText variant="caption">Checksum</AppText>
              <AppText
                variant="caption"
                color={latest.micValid ? colors.success : colors.warning}
              >
                {latest.micValid ? 'Válido' : 'Inválido'}
              </AppText>
            </View>
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.sm,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  flex: { flex: 1 },
  banner: {
    marginBottom: spacing.md,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  reconnectText: {
    marginBottom: spacing.md,
  },
  hero: {
    borderRadius: 24,
    padding: spacing.xl,
    marginBottom: spacing.md,
    minHeight: 190,
    justifyContent: 'space-between',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  heroBottom: {
    marginTop: spacing.lg,
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  windCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  footerGrid: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  footerItem: {
    flex: 1,
    gap: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.md,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
});
