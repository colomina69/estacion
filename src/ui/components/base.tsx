import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  type StyleProp,
  type TextProps,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius, spacing, useTheme } from '../theme';

type TextVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'bodyStrong'
  | 'caption'
  | 'label'
  | 'mono';

interface AppTextProps extends TextProps {
  variant?: TextVariant;
  color?: string;
  align?: 'left' | 'center' | 'right';
}

export function AppText({
  variant = 'body',
  color,
  align,
  style,
  children,
  ...rest
}: AppTextProps) {
  const { colors } = useTheme();

  const variantStyle = (() => {
    switch (variant) {
      case 'display':
        return { fontSize: 56, fontWeight: '700' as const, letterSpacing: -1.5 };
      case 'title':
        return { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 };
      case 'heading':
        return { fontSize: 20, fontWeight: '600' as const };
      case 'bodyStrong':
        return { fontSize: 15, fontWeight: '600' as const };
      case 'caption':
        return { fontSize: 12, fontWeight: '500' as const };
      case 'label':
        return {
          fontSize: 12,
          fontWeight: '700' as const,
          letterSpacing: 0.6,
          textTransform: 'uppercase' as const,
        };
      case 'mono':
        return { fontSize: 13, fontWeight: '500' as const, fontVariant: ['tabular-nums' as const] };
      default:
        return { fontSize: 15, fontWeight: '400' as const };
    }
  })();

  const defaultColor =
    variant === 'caption' || variant === 'label' ? colors.textMuted : colors.text;

  return (
    <Text
      {...rest}
      allowFontScaling
      style={[
        variantStyle,
        { color: color ?? defaultColor, textAlign: align },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentContainerStyle?: ViewStyle;
}

export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  contentContainerStyle,
}: ScreenProps) {
  const { colors } = useTheme();

  if (!scroll) {
    return (
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={[styles.screen, { backgroundColor: colors.background }]}
      >
        <View style={[styles.flex, contentContainerStyle]}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={Boolean(refreshing)}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          ) : undefined
        }
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

export function Card({ children, style, onPress }: CardProps) {
  const { colors } = useTheme();
  const baseStyle = [
    styles.card,
    {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          baseStyle,
          pressed && { opacity: 0.85 },
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={baseStyle}>{children}</View>;
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function SectionHeader({ title, subtitle, right }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.flex}>
        <AppText variant="heading">{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" style={{ marginTop: 2 }}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  style,
}: ButtonProps) {
  const { colors } = useTheme();

  const palette = (() => {
    switch (variant) {
      case 'secondary':
        return { bg: colors.surfaceAlt, fg: colors.text, border: colors.border };
      case 'danger':
        return { bg: colors.dangerSoft, fg: colors.danger, border: colors.danger };
      case 'ghost':
        return { bg: 'transparent', fg: colors.primary, border: 'transparent' };
      default:
        return { bg: colors.primary, fg: colors.onPrimary, border: colors.primary };
    }
  })();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} size="small" />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={palette.fg} /> : null}
          <AppText variant="bodyStrong" color={palette.fg}>
            {title}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

interface EmptyStateProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <Card style={styles.emptyCard}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={26} color={colors.primary} />
      </View>
      <AppText variant="heading" align="center" style={{ marginTop: spacing.md }}>
        {title}
      </AppText>
      <AppText variant="body" align="center" color={colors.textMuted} style={{ marginTop: 4 }}>
        {message}
      </AppText>
      {actionLabel && onAction ? (
        <Button
          title={actionLabel}
          onPress={onAction}
          style={{ marginTop: spacing.lg, alignSelf: 'stretch' }}
        />
      ) : null}
    </Card>
  );
}

interface SkeletonProps {
  height?: number;
  width?: number | `${number}%`;
  style?: ViewStyle;
}

export function Skeleton({ height = 16, width = '100%', style }: SkeletonProps) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { height, width, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, opacity },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: 120,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
