import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { COLORS, GRADIENTS, RADIUS, SHADOWS } from '../../theme/tokens';

type GradientButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: ReactNode;
  accessibilityLabel?: string;
};

export function GradientButton({
  label,
  onPress,
  disabled,
  icon,
  accessibilityLabel,
}: GradientButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.shell,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <LinearGradient
        colors={GRADIENTS.button}
        end={{ x: 1, y: 0.5 }}
        start={{ x: 0, y: 0.5 }}
        style={styles.fill}
      >
        <Text style={styles.label}>{label}</Text>
        {icon}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: { borderRadius: RADIUS.pill, ...SHADOWS.glow },
  fill: {
    alignItems: 'center',
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 60,
    paddingHorizontal: 20,
  },
  label: { color: COLORS.onPrimary, fontSize: 18, fontWeight: '700' },
  pressed: { transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.65 },
});
