import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

import type { ConnectionState } from '../../mqtt/client';
import { cardinalFromDeg } from '../../lib/derived';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';
import { AppText, Card } from './base';

interface MetricCardProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  subtitle?: string;
  accent?: string;
  onPress?: () => void;
  style?: ViewStyle;
}

export function MetricCard({
  icon,
  label,
  value,
  subtitle,
  accent,
  onPress,
  style,
}: MetricCardProps) {
  const { colors } = useTheme();
  const tint = accent ?? colors.primary;
  return (
    <Card onPress={onPress} style={[styles.metricCard, style]}>
      <View style={styles.metricHeader}>
        <View style={[styles.metricIcon, { backgroundColor: `${tint}22` }]}>
          <Ionicons name={icon} size={16} color={tint} />
        </View>
        <AppText variant="caption" numberOfLines={1} style={styles.metricLabel}>
          {label}
        </AppText>
      </View>
      <AppText variant="heading" numberOfLines={1} style={styles.metricValue}>
        {value}
      </AppText>
      {subtitle ? (
        <AppText variant="caption" numberOfLines={2}>
          {subtitle}
        </AppText>
      ) : null}
    </Card>
  );
}

const STATUS_MAP: Record<
  ConnectionState,
  { label: string; color: keyof ThemeColors; background: keyof ThemeColors }
> = {
  idle: { label: 'Inactivo', color: 'textMuted', background: 'surfaceAlt' },
  connecting: { label: 'Conectando', color: 'warning', background: 'warningSoft' },
  connected: { label: 'Conectado', color: 'success', background: 'successSoft' },
  reconnecting: { label: 'Reconectando', color: 'warning', background: 'warningSoft' },
  offline: { label: 'Offline', color: 'textMuted', background: 'surfaceAlt' },
  error: { label: 'Error', color: 'danger', background: 'dangerSoft' },
};

export function ConnectionChip({
  status,
  detail,
}: {
  status: ConnectionState;
  detail?: string | null;
}) {
  const { colors } = useTheme();
  const meta = STATUS_MAP[status];
  return (
    <View
      accessibilityLabel={`Estado de conexión: ${meta.label}${detail ? `, ${detail}` : ''}`}
      style={[styles.chip, { backgroundColor: colors[meta.background] }]}
    >
      <View style={[styles.dot, { backgroundColor: colors[meta.color] }]} />
      <AppText variant="caption" color={colors[meta.color]}>
        {meta.label}
      </AppText>
    </View>
  );
}

interface CompassProps {
  degrees: number | null;
  size?: number;
}

export function Compass({ degrees, size = 96 }: CompassProps) {
  const { colors } = useTheme();
  const cardinal = cardinalFromDeg(degrees);
  const rotation = degrees ?? 0;

  return (
    <View style={styles.compassWrap}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle
          cx={50}
          cy={50}
          r={46}
          stroke={colors.border}
          strokeWidth={1.5}
          fill={colors.surfaceAlt}
        />
        <Line x1={50} y1={10} x2={50} y2={16} stroke={colors.textMuted} strokeWidth={1.5} />
        <Line x1={50} y1={84} x2={50} y2={90} stroke={colors.textMuted} strokeWidth={1.5} />
        <Line x1={10} y1={50} x2={16} y2={50} stroke={colors.textMuted} strokeWidth={1.5} />
        <Line x1={84} y1={50} x2={90} y2={50} stroke={colors.textMuted} strokeWidth={1.5} />
        <SvgText x={50} y={26} fontSize={8} fill={colors.textMuted} textAnchor="middle">
          N
        </SvgText>
        <SvgText x={74} y={53} fontSize={8} fill={colors.textMuted} textAnchor="middle">
          E
        </SvgText>
        <SvgText x={50} y={79} fontSize={8} fill={colors.textMuted} textAnchor="middle">
          S
        </SvgText>
        <SvgText x={26} y={53} fontSize={8} fill={colors.textMuted} textAnchor="middle">
          O
        </SvgText>
        <G rotation={rotation} origin="50, 50">
          <Path
            d="M50 18 L57 50 L50 46 L43 50 Z"
            fill={colors.primary}
            stroke={colors.primary}
            strokeWidth={1}
          />
        </G>
        <Circle cx={50} cy={50} r={4} fill={colors.text} />
      </Svg>
      <AppText variant="bodyStrong" align="center" style={{ marginTop: 4 }}>
        {cardinal.abbreviation}
      </AppText>
      <AppText variant="caption" align="center">
        {degrees !== null ? `${Math.round(degrees)}°` : '—'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  metricCard: {
    flex: 1,
    minHeight: 112,
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    flex: 1,
  },
  metricValue: {
    marginTop: spacing.sm,
    fontSize: 22,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  compassWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
