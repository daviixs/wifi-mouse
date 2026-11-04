import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { COLORS, GRADIENTS, RADIUS, SHADOWS } from '../../theme/tokens';

type GlassCardProps = { children: ReactNode; style?: StyleProp<ViewStyle>; radius?: number };

/** Translucent card with a subtle top-to-bottom sheen and a light border. */
export function GlassCard({ children, style, radius = RADIUS.large }: GlassCardProps) {
  return (
    <View style={[styles.shadow, { borderRadius: radius }]}>
      <LinearGradient
        colors={GRADIENTS.card}
        end={{ x: 0.8, y: 1 }}
        start={{ x: 0.2, y: 0 }}
        style={[styles.card, { borderRadius: radius }, style]}
      >
        {children}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { ...SHADOWS.card },
  card: {
    borderColor: COLORS.border,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
