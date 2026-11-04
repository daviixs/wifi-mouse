import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CircleHelp, Wifi } from 'lucide-react-native';

import { COLORS, GRADIENTS, RADIUS, SHADOWS, SPACE } from '../../theme/tokens';

type AppHeaderProps = { onHelp?: () => void };

export function AppHeader({ onHelp }: AppHeaderProps) {
  return (
    <View style={styles.topBar}>
      <View style={styles.brand}>
        <LinearGradient
          colors={GRADIENTS.appIcon}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.brandMark}
        >
          <Wifi color={COLORS.onPrimary} size={26} strokeWidth={2.6} />
        </LinearGradient>
        <Text style={styles.brandText}>
          REMOTE <Text style={styles.brandLight}>MOUSE</Text>
        </Text>
      </View>
      {onHelp && (
        <Pressable
          accessibilityLabel="Ajuda para configurar o computador"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onHelp}
          style={({ pressed }) => [styles.helpButton, pressed && styles.pressed]}
        >
          <CircleHelp color={COLORS.muted} size={34} strokeWidth={1.6} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 64,
    justifyContent: 'space-between',
  },
  brand: { alignItems: 'center', flexDirection: 'row', gap: SPACE.md },
  brandMark: {
    alignItems: 'center',
    borderRadius: RADIUS.medium,
    height: 54,
    justifyContent: 'center',
    width: 54,
    ...SHADOWS.glow,
  },
  brandText: { color: COLORS.text, fontSize: 15, fontWeight: '800', letterSpacing: 1.6 },
  brandLight: { color: COLORS.accent, fontWeight: '600' },
  helpButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
});
