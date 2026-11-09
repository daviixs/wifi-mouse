import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle, type ViewProps } from 'react-native';
import { COLORS, RADIUS, SHADOWS } from '../../theme/tokens';

type GlassCardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  onLayout?: ViewProps['onLayout'];
};

/** One coherent opaque surface: no brighter nested gradient rectangle. */
export function GlassCard({ children, style, radius = RADIUS.large, onLayout }: GlassCardProps) {
  return (
    <View onLayout={onLayout} style={[styles.card, { borderRadius: radius }, style]}>
      {children}
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    ...SHADOWS.card,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
