import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, RADIUS, SPACE } from '../theme/tokens';

type MouseButtonProps = {
  label: string;
  side: 'left' | 'right';
  onPress: () => void;
};

export function MouseButton({ label, side, onPress }: MouseButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        side === 'left' ? styles.left : styles.right,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.dot, side === 'left' ? styles.leftDot : styles.rightDot]} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: SPACE.xs,
    height: 62,
    justifyContent: 'center',
  },
  left: { borderBottomLeftRadius: RADIUS.large, borderTopLeftRadius: RADIUS.large },
  right: { borderBottomRightRadius: RADIUS.large, borderTopRightRadius: RADIUS.large },
  pressed: { backgroundColor: COLORS.surfaceSubtle, transform: [{ scale: 0.985 }] },
  dot: { backgroundColor: COLORS.muted, borderRadius: RADIUS.small, height: 5, width: 5 },
  leftDot: { backgroundColor: COLORS.primary },
  rightDot: { backgroundColor: COLORS.secondary },
  label: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
});
