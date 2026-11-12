import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { useTheme } from '../theme';

export interface SeriesPoint {
  x: number;
  y: number | null;
}

interface LineChartProps {
  data: SeriesPoint[];
  height?: number;
  color?: string;
  digits?: number;
  formatX: (value: number) => string;
  formatY?: (value: number) => string;
}

const PAD_LEFT = 38;
const PAD_RIGHT = 10;
const PAD_TOP = 10;
const PAD_BOTTOM = 22;

export function LineChart({
  data,
  height = 170,
  color,
  digits = 1,
  formatX,
  formatY,
}: LineChartProps) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const strokeColor = color ?? colors.primary;

  const values = data
    .map((point) => point.y)
    .filter((value): value is number => value !== null && Number.isFinite(value));

  if (values.length === 0) {
    return (
      <View style={[styles.emptyChart, { height }]}>
        <View style={[styles.emptyLine, { backgroundColor: colors.chartGrid }]} />
      </View>
    );
  }

  let minY = Math.min(...values);
  let maxY = Math.max(...values);
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }
  const padding = (maxY - minY) * 0.12;
  minY -= padding;
  maxY += padding;

  const xs = data.map((point) => point.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const plotWidth = Math.max(1, width - PAD_LEFT - PAD_RIGHT);
  const plotHeight = Math.max(1, height - PAD_TOP - PAD_BOTTOM);

  const xFor = (value: number) =>
    PAD_LEFT +
    (maxX === minX ? plotWidth / 2 : ((value - minX) / (maxX - minX)) * plotWidth);
  const yFor = (value: number) =>
    PAD_TOP + ((maxY - value) / (maxY - minY)) * plotHeight;

  let path = '';
  let penDown = false;
  for (const point of data) {
    if (point.y === null || !Number.isFinite(point.y)) {
      penDown = false;
      continue;
    }
    const command = penDown ? 'L' : 'M';
    path += `${command}${xFor(point.x).toFixed(1)},${yFor(point.y).toFixed(1)} `;
    penDown = true;
  }

  const tickValues = [maxY, (maxY + minY) / 2, minY];
  const yFormatter = formatY ?? ((value: number) => value.toFixed(digits));
  const xTicks =
    maxX === minX
      ? [{ value: minX, anchor: 'middle' as const }]
      : [
          { value: minX, anchor: 'start' as const },
          { value: (minX + maxX) / 2, anchor: 'middle' as const },
          { value: maxX, anchor: 'end' as const },
        ];

  return (
    <View
      style={{ height }}
      onLayout={(event) => {
        const next = event.nativeEvent.layout.width;
        if (next !== width) setWidth(next);
      }}
    >
      {width > 0 ? (
        <Svg width={width} height={height}>
          {tickValues.map((tick, index) => {
            const y = yFor(tick);
            return (
              <React.Fragment key={`tick-${index}`}>
                <Line
                  x1={PAD_LEFT}
                  y1={y}
                  x2={width - PAD_RIGHT}
                  y2={y}
                  stroke={colors.chartGrid}
                  strokeWidth={1}
                  strokeDasharray={index === 2 ? undefined : '3 5'}
                />
                <SvgText
                  x={PAD_LEFT - 6}
                  y={y + 3}
                  fontSize={9}
                  fill={colors.textMuted}
                  textAnchor="end"
                >
                  {yFormatter(tick)}
                </SvgText>
              </React.Fragment>
            );
          })}

          {xTicks.map((tick, index) => (
            <SvgText
              key={`x-${index}`}
              x={xFor(tick.value)}
              y={height - 6}
              fontSize={9}
              fill={colors.textMuted}
              textAnchor={tick.anchor}
            >
              {formatX(tick.value)}
            </SvgText>
          ))}

          {path ? (
            <Path
              d={path.trim()}
              stroke={strokeColor}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}

export interface BarPoint {
  x: number;
  y: number | null;
}

interface BarChartProps {
  data: BarPoint[];
  height?: number;
  color?: string;
  formatX: (value: number) => string;
  formatY?: (value: number) => string;
}

export function BarChart({
  data,
  height = 150,
  color,
  formatX,
  formatY,
}: BarChartProps) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const fillColor = color ?? colors.primary;

  const values = data
    .map((point) => point.y)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const maxY = values.length > 0 ? Math.max(...values) : 0;

  const plotWidth = Math.max(1, width - PAD_LEFT - PAD_RIGHT);
  const plotHeight = Math.max(1, height - PAD_TOP - PAD_BOTTOM);
  const slot = data.length > 0 ? plotWidth / data.length : plotWidth;
  const barWidth = Math.max(1, slot * 0.62);

  const yFormatter = formatY ?? ((value: number) => value.toFixed(1));
  const xs = data.map((point) => point.x);
  const minX = xs.length > 0 ? Math.min(...xs) : 0;
  const maxX = xs.length > 0 ? Math.max(...xs) : 1;

  return (
    <View
      style={{ height }}
      onLayout={(event) => {
        const next = event.nativeEvent.layout.width;
        if (next !== width) setWidth(next);
      }}
    >
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Line
            x1={PAD_LEFT}
            y1={height - PAD_BOTTOM}
            x2={width - PAD_RIGHT}
            y2={height - PAD_BOTTOM}
            stroke={colors.chartGrid}
            strokeWidth={1}
          />
          <Line
            x1={PAD_LEFT}
            y1={PAD_TOP}
            x2={width - PAD_RIGHT}
            y2={PAD_TOP}
            stroke={colors.chartGrid}
            strokeWidth={1}
            strokeDasharray="3 5"
          />
          <SvgText
            x={PAD_LEFT - 6}
            y={PAD_TOP + 3}
            fontSize={9}
            fill={colors.textMuted}
            textAnchor="end"
          >
            {yFormatter(maxY)}
          </SvgText>
          <SvgText
            x={PAD_LEFT - 6}
            y={height - PAD_BOTTOM + 3}
            fontSize={9}
            fill={colors.textMuted}
            textAnchor="end"
          >
            0
          </SvgText>

          {data.map((point, index) => {
            if (point.y === null || point.y <= 0 || maxY <= 0) return null;
            const barHeight = (point.y / maxY) * plotHeight;
            const x = PAD_LEFT + index * slot + (slot - barWidth) / 2;
            return (
              <Rect
                key={`bar-${point.x}-${index}`}
                x={x}
                y={height - PAD_BOTTOM - barHeight}
                width={barWidth}
                height={Math.max(1, barHeight)}
                rx={2}
                fill={fillColor}
              />
            );
          })}

          {data.length > 0 ? (
            <>
              <SvgText
                x={PAD_LEFT}
                y={height - 6}
                fontSize={9}
                fill={colors.textMuted}
                textAnchor="start"
              >
                {formatX(minX)}
              </SvgText>
              <SvgText
                x={width - PAD_RIGHT}
                y={height - 6}
                fontSize={9}
                fill={colors.textMuted}
                textAnchor="end"
              >
                {formatX(maxX)}
              </SvgText>
            </>
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyChart: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyLine: {
    height: 1,
    width: '100%',
  },
});
