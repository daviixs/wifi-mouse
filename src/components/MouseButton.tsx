import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '../constants/config';

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
    backgroundColor: COLORS.surfaceRaised,
    borderColor: COLORS.border,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 9,
    height: 62,
    justifyContent: 'center',
  },
  left: { borderBottomLeftRadius: 22, borderTopLeftRadius: 22 },
  right: { borderBottomRightRadius: 22, borderTopRightRadius: 22 },
  pressed: { backgroundColor: '#2a302c', transform: [{ scale: 0.985 }] },
  dot: { backgroundColor: COLORS.muted, borderRadius: 3, height: 5, width: 5 },
  leftDot: { backgroundColor: COLORS.accent },
  rightDot: { backgroundColor: '#bac1bb' },
  label: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
});
