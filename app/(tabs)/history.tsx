import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { INFLUX_RANGES } from '../../src/influx/client';
import {
  formatDateInput,
  formatDateTimeRange,
  formatTimeInput,
  validateCustomRange,
} from '../../src/lib/dateRange';
import { formatShortDate, formatShortTime } from '../../src/lib/time';
import {
  convertTemperature,
  formatNumber,
  formatRain,
  formatTemperature,
  formatWind,
  rainUnit,
  temperatureUnit,
  windUnit,
} from '../../src/lib/units';
import { useHistoryStore } from '../../src/store/historyStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  Screen,
  SectionHeader,
  Skeleton,
} from '../../src/ui/components/base';
import { SegmentedControl } from '../../src/ui/components/inputs';
import { BarChart, LineChart } from '../../src/ui/components/charts';
import { radius, spacing, useTheme } from '../../src/ui/theme';
import type {
  HistoryPoint,
  HistorySelection,
} from '../../src/types/weather';

const DAY_MS = 24 * 60 * 60 * 1000;

const RANGE_OPTIONS: { value: HistorySelection; label: string }[] = [
  { value: '1h', label: '1 h' },
  { value: '24h', label: '24 h' },
  { value: '7d', label: '7 días' },
  { value: 'custom', label: 'Fechas' },
];

function valuesOf(
  points: HistoryPoint[],
  key: keyof HistoryPoint,
): number[] {
  return points
    .map((point) => point[key])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
}

function RangePickerRow({
  label,
  value,
  onPickDate,
  onPickTime,
}: {
  label: string;
  value: number;
  onPickDate: () => void;
  onPickTime: () => void;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.rangeField}>
      <AppText variant="label" style={{ marginBottom: 6 }}>
        {label}
      </AppText>
      <View style={styles.rangeControls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${formatDateInput(value)}. Abrir calendario.`}
          onPress={onPickDate}
          style={[
            styles.pickerButton,
            { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
          ]}
        >
          <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
          <AppText variant="bodyStrong">{formatDateInput(value)}</AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${formatTimeInput(value)}. Cambiar hora.`}
          onPress={onPickTime}
          style={[
            styles.pickerButton,
            styles.timeButton,
            { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
          ]}
        >
          <Ionicons name="time-outline" size={18} color={colors.textMuted} />
          <AppText variant="bodyStrong">{formatTimeInput(value)}</AppText>
        </Pressable>
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const { colors } = useTheme();
  const range = useHistoryStore((state) => state.range);
  const points = useHistoryStore((state) => state.points);
  const loading = useHistoryStore((state) => state.loading);
  const error = useHistoryStore((state) => state.error);
  const load = useHistoryStore((state) => state.load);
  const setRange = useHistoryStore((state) => state.setRange);
  const customRange = useHistoryStore((state) => state.customRange);
  const applyCustomRange = useHistoryStore((state) => state.applyCustomRange);
  const loadedSource = useHistoryStore((state) => state.source);
  const units = useSettingsStore((state) => state.settings.units);
  const configuredSource = useSettingsStore(
    (state) => state.settings.historySource,
  );
  const activeSource = loadedSource ?? configuredSource;

  const [startMs, setStartMs] = useState(() => {
    if (customRange) return customRange.start;
    const date = new Date();
    date.setDate(date.getDate() - 6);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  });
  const [endMs, setEndMs] = useState(() => {
    if (customRange) return customRange.end;
    const date = new Date();
    date.setHours(23, 59, 59, 999);
    return date.getTime();
  });
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [pickerField, setPickerField] = useState<'start' | 'end' | null>(null);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');

  useEffect(() => {
    if (!customRange) return;
    setStartMs(customRange.start);
    setEndMs(customRange.end);
    setRangeError(null);
  }, [customRange]);

  useFocusEffect(
    useCallback(() => {
      if (range === 'custom' && !customRange) return;
      void load(range);
      const id = setInterval(() => {
        if (range !== 'custom' || customRange) {
          void load(range);
        }
      }, 60_000);
      return () => clearInterval(id);
    }, [load, range, customRange]),
  );

  const openPicker = (field: 'start' | 'end', mode: 'date' | 'time') => {
    setPickerField(field);
    setPickerMode(mode);
  };

  const handlePickerChange = (
    event: DateTimePickerEvent,
    selected?: Date,
  ) => {
    const field = pickerField;
    const mode = pickerMode;
    setPickerField(null);
    if (!field || event.type === 'dismissed' || !selected) return;

    const current = new Date(field === 'start' ? startMs : endMs);
    if (mode === 'date') {
      current.setFullYear(
        selected.getFullYear(),
        selected.getMonth(),
        selected.getDate(),
      );
    } else {
      current.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    }

    if (field === 'start') {
      setStartMs(current.getTime());
    } else {
      setEndMs(current.getTime());
    }
    setRangeError(null);
  };

  const handleApplyRange = async () => {
    const validation = validateCustomRange(startMs, endMs);
    if (validation) {
      setRangeError(validation);
      return;
    }
    setRangeError(null);
    setApplying(true);
    try {
      await applyCustomRange({ start: startMs, end: endMs });
    } finally {
      setApplying(false);
    }
  };

  const rangeLabel =
    range === 'custom'
      ? customRange
        ? formatDateTimeRange(customRange)
        : 'Rango personalizado'
      : INFLUX_RANGES[range].label;
  const customDuration = customRange
    ? customRange.end - customRange.start
    : 0;
  const useDateAxis =
    range === '7d' ||
    (range === 'custom' && customDuration > 2 * DAY_MS);

  const temps = valuesOf(points, 'temperatureC');
  const winds = valuesOf(points, 'windMaxKmh');
  const rains = valuesOf(points, 'rainDeltaMm');
  const maxTemp = temps.length > 0 ? Math.max(...temps) : null;
  const minTemp = temps.length > 0 ? Math.min(...temps) : null;
  const maxWind = winds.length > 0 ? Math.max(...winds) : null;
  const rainTotal = rains.reduce((sum, value) => sum + value, 0);

  const formatX = useDateAxis ? formatShortDate : formatShortTime;
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
        <AppText variant="caption">
          {activeSource === 'influx'
            ? 'Serie histórica desde InfluxDB'
            : 'Datos guardados en el dispositivo'}
        </AppText>
      </View>

      <SegmentedControl
        options={RANGE_OPTIONS}
        value={range}
        onChange={(next) => setRange(next)}
      />

      <AppText variant="caption" style={{ marginTop: 6 }}>
        {rangeLabel} ·{' '}
        {activeSource === 'influx' ? 'InfluxDB' : 'guardado local'}
      </AppText>

      {range === 'custom' ? (
        <Card style={styles.rangeCard}>
          <RangePickerRow
            label="Desde"
            value={startMs}
            onPickDate={() => openPicker('start', 'date')}
            onPickTime={() => openPicker('start', 'time')}
          />
          <RangePickerRow
            label="Hasta"
            value={endMs}
            onPickDate={() => openPicker('end', 'date')}
            onPickTime={() => openPicker('end', 'time')}
          />
          {rangeError ? (
            <AppText variant="caption" color={colors.danger}>
              {rangeError}
            </AppText>
          ) : null}
          <Button
            title="Aplicar rango"
            icon="calendar-outline"
            onPress={() => void handleApplyRange()}
            loading={applying}
            style={{ marginTop: spacing.sm }}
          />
          <AppText variant="caption" style={{ marginTop: spacing.sm }}>
            Formato DD-MM-AAAA. Pulsa la fecha para abrir el calendario o la
            hora para cambiarla.
          </AppText>
        </Card>
      ) : null}

      {pickerField ? (
        <DateTimePicker
          value={new Date(pickerField === 'start' ? startMs : endMs)}
          mode={pickerMode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          is24Hour
          onChange={handlePickerChange}
        />
      ) : null}

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

          <SectionHeader
            title="Lluvia"
            subtitle={`Acumulada por intervalo · ${rainUnit(units)}`}
          />
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
            {formatNumber(points.length, 0)} puntos · {rangeLabel}
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
  rangeCard: {
    marginTop: spacing.md,
  },
  rangeField: {
    marginBottom: spacing.md,
  },
  rangeControls: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pickerButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timeButton: {
    flex: 0,
    width: 112,
  },
});
