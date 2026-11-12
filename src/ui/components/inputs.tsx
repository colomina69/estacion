import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type ViewStyle,
} from 'react-native';

import { radius, spacing, useTheme } from '../theme';
import { AppText } from './base';

interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  secure?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  error?: string | null;
  hint?: string;
  editable?: boolean;
  style?: ViewStyle;
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  secure = false,
  autoCapitalize = 'none',
  error,
  hint,
  editable = true,
  style,
}: TextFieldProps) {
  const { colors } = useTheme();
  const [hidden, setHidden] = useState(secure);

  return (
    <View style={[styles.field, style]}>
      <AppText variant="label" style={{ marginBottom: 6 }}>
        {label}
      </AppText>
      <View
        style={[
          styles.inputWrap,
          {
            backgroundColor: colors.surfaceAlt,
            borderColor: error ? colors.danger : colors.border,
          },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType={keyboardType}
          secureTextEntry={secure ? hidden : false}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          editable={editable}
          selectionColor={colors.primary}
          style={[styles.input, { color: colors.text }]}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Mostrar contraseña' : 'Ocultar contraseña'}
            onPress={() => setHidden((current) => !current)}
            hitSlop={8}
            style={styles.eye}
          >
            <Ionicons
              name={hidden ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText variant="caption" color={colors.danger} style={{ marginTop: 4 }}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" style={{ marginTop: 4 }}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

interface SwitchRowProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  disabled?: boolean;
}

export function SwitchRow({
  label,
  description,
  value,
  onValueChange,
  icon,
  disabled = false,
}: SwitchRowProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={[styles.switchRow, { opacity: disabled ? 0.5 : 1 }]}
    >
      {icon ? (
        <View style={[styles.switchIcon, { backgroundColor: colors.surfaceAlt }]}>
          <Ionicons name={icon} size={18} color={colors.textMuted} />
        </View>
      ) : null}
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{label}</AppText>
        {description ? (
          <AppText variant="caption" style={{ marginTop: 2 }}>
            {description}
          </AppText>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.surface}
      />
    </Pressable>
  );
}

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const { colors } = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: colors.surfaceAlt }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[
              styles.segmentItem,
              selected && {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <AppText
              variant="bodyStrong"
              color={selected ? colors.text : colors.textMuted}
              align="center"
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.md },
  inputWrap: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  eye: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  switchIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  segment: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
});
