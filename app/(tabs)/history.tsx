import { useFocusEffect } from 'expo-router';
import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { HISTORY_RANGES } from '../../src/db/database';
import { formatShortDate, formatShortTime } from '../../src/lib/time';
import {
  convertTemperature,
  formatNumber,
  formatRain,
  formatTemperature,
  formatWind,
  temperatureUnit,
  windUnit,
} from '../../src/lib/units';
import { useHistoryStore } from '../../src/store/historyStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import {
  AppText,
  Card,
  EmptyState,
  Screen,
  SectionHeader,
  Skeleton,
} from '../../src/ui/components/base';
import { SegmentedControl } from '../../src/ui/components/inputs';
import { BarChart, LineChart } from '../../src/ui/components/charts';
import { spacing, useTheme } from '../../src/ui/theme';
import type { HistoryPoint, HistoryRange } from '../../src/types/weather';

const RANGE_OPTIONS: { value: HistoryRange; label: string }[] = [
  { value: '1h', label: '1 h' },
  { value: '24h', label: '24 h' },
  { value: '7d', label: '7 días' },
];

function valuesOf(
  points: HistoryPoint[],
  key: keyof HistoryPoint,
): number[] {
  return points
    .map((point) => point[key])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
}

export default function HistoryScreen() {
  const { colors } = useTheme();
  const range = useHistoryStore((state) => state.range);
  const points = useHistoryStore((state) => state.points);
  const loading = useHistoryStore((state) => state.loading);
  const error = useHistoryStore((state) => state.error);
  const load = useHistoryStore((state) => state.load);
  const setRange = useHistoryStore((state) => state.setRange);
  const units = useSettingsStore((state) => state.settings.units);

  useFocusEffect(
    useCallback(() => {
      void load(range);
      const id = setInterval(() => {
        void load(range);
      }, 60_000);
      return () => clearInterval(id);
    }, [load, range]),
  );

  const temps = valuesOf(points, 'temperatureC');
  const winds = valuesOf(points, 'windMaxKmh');
  const rains = valuesOf(points, 'rainDeltaMm');
  const maxTemp = temps.length > 0 ? Math.max(...temps) : null;
  const minTemp = temps.length > 0 ? Math.min(...temps) : null;
  const maxWind = winds.length > 0 ? Math.max(...winds) : null;
  const rainTotal = rains.reduce((sum, value) => sum + value, 0);

  const formatX = range === '7d' ? formatShortDate : formatShortTime;
  const unitLabel = temperatureUnit(units);

  const temperatureData = points.map((point) => ({
    x: point.t,
    y: convertTemperature(point.temperatureC, units),
  }));
  const humidityData = points.map((point) => ({ x: point.t, y: point.humidity }));
  const windData = points.map((point) => ({ x: point.t, y: point.windMaxKmh }));
  const rainData = points.map((point) => ({ x: point.t, y: point.rainDeltaMm }));

  const empty = !loading && points.length === 0;

  return (
    <Screen refreshing={loading} onRefresh={() => void load(range)}>
      <View style={styles.header}>
        <AppText variant="title">Histórico</AppText>
        <AppText variant="caption">Datos guardados en el dispositivo</AppText>
      </View>

      <SegmentedControl
        options={RANGE_OPTIONS}
        value={range}
        onChange={(next) => setRange(next)}
      />

      <AppText variant="caption" style={{ marginTop: 6 }}>
        {HISTORY_RANGES[range].label} · guardado local
      </AppText>

      {error ? (
        <Card style={[styles.error, { borderColor: colors.danger }]}>
          <AppText variant="bodyStrong" color={colors.danger}>
            No se pudo cargar el histórico
          </AppText>
          <AppText variant="caption" style={{ marginTop: 2 }}>
            {error}
          </AppText>
        </Card>
      ) : null}

      {empty ? (
        <EmptyState
          icon="bar-chart-outline"
          title="Aún no hay datos históricos"
          message="Cuando la app reciba lecturas de la estación aparecerán aquí."
        />
      ) : loading && points.length === 0 ? (
        <View style={{ gap: spacing.md, marginTop: spacing.md }}>
          <Skeleton height={150} />
          <Skeleton height={150} />
          <Skeleton height={150} />
        </View>
      ) : (
        <>
          <View style={styles.statsRow}>
            <Card style={styles.statCard}>
              <AppText variant="label">Temp. máx.</AppText>
              <AppText variant="heading" style={{ marginTop: 2 }}>
                {formatTemperature(maxTemp, units, 0)}
              </AppText>
            </Card>
            <Card style={styles.statCard}>
              <AppText variant="label">Temp. mín.</AppText>
              <AppText variant="heading" style={{ marginTop: 2 }}>
                {formatTemperature(minTemp, units, 0)}
              </AppText>
            </Card>
          </View>
          <View style={styles.statsRow}>
            <Card style={styles.statCard}>
              <AppText variant="label">Viento máx.</AppText>
              <AppText variant="heading" style={{ marginTop: 2 }}>
                {formatWind(maxWind, units, 0)}
              </AppText>
            </Card>
            <Card style={styles.statCard}>
              <AppText variant="label">Lluvia</AppText>
              <AppText variant="heading" style={{ marginTop: 2 }}>
                {formatRain(rainTotal, units)}
              </AppText>
            </Card>
          </View>

          <SectionHeader title="Temperatura" subtitle={`En ${unitLabel}`} />
          <Card style={styles.chartCard}>
            <LineChart
              data={temperatureData}
              color={colors.primary}
              formatX={formatX}
              formatY={(value) => value.toFixed(0)}
            />
          </Card>

          <SectionHeader title="Humedad" subtitle="Porcentaje relativo" />
          <Card style={styles.chartCard}>
            <LineChart
              data={humidityData}
              color="#14B8A6"
              formatX={formatX}
              formatY={(value) => `${value.toFixed(0)}%`}
            />
          </Card>

          <SectionHeader
            title="Viento máximo"
            subtitle={`En ${windUnit(units)}`}
          />
          <Card style={styles.chartCard}>
            <LineChart
              data={windData}
              color="#F59E0B"
              formatX={formatX}
              formatY={(value) => value.toFixed(0)}
            />
          </Card>

          <SectionHeader title="Lluvia" subtitle="Acumulada por intervalo" />
          <Card style={styles.chartCard}>
            {rainTotal > 0 ? (
              <BarChart
                data={rainData}
                color="#2563EB"
                formatX={formatX}
                formatY={(value) => value.toFixed(1)}
              />
            ) : (
              <AppText variant="caption" align="center" style={{ paddingVertical: 24 }}>
                Sin lluvia registrada en este periodo
              </AppText>
            )}
          </Card>

          <AppText variant="caption" align="center" style={{ marginTop: spacing.lg }}>
            {formatNumber(points.length, 0)} puntos ·{' '}
            {HISTORY_RANGES[range].label}
          </AppText>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.sm,
    marginBottom: spacing.lg,
    gap: 2,
  },
  error: {
    marginTop: spacing.md,
    backgroundColor: 'transparent',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  statCard: {
    flex: 1,
    padding: spacing.md,
  },
  chartCard: {
    padding: spacing.sm,
  },
});
