import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CircleHelp } from 'lucide-react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { COLORS, RADIUS, SHADOWS, SPACE } from '../../theme/tokens';

/** ConnectMouse logo, same artwork as website/public/favicon.svg and the app icon. */
function BrandMark({ size }: { size: number }) {
  return (
    <Svg height={size} viewBox="0 0 40 40" width={size}>
      <Defs>
        <LinearGradient id="connectmouse-logo" x1="0" x2="1" y1="0" y2="1">
          <Stop offset="0" stopColor="#6E8BFF" />
          <Stop offset="0.55" stopColor="#0031F4" />
          <Stop offset="1" stopColor="#0A1FB8" />
        </LinearGradient>
      </Defs>
      <Rect fill="url(#connectmouse-logo)" height="40" rx="12" width="40" />
      <Path d="M13 10.5 28.5 18l-6.6 2.2-3.1 6.6Z" fill="#fff" />
      <Path
        d="M12.5 30.5a5 5 0 0 1 5-5"
        fill="none"
        opacity={0.75}
        stroke="#fff"
        strokeLinecap="round"
        strokeWidth={2.2}
      />
    </Svg>
  );
}

type AppHeaderProps = { onHelp?: () => void };

export function AppHeader({ onHelp }: AppHeaderProps) {
  return (
    <View style={styles.topBar}>
      <View style={styles.brand}>
        <View accessibilityLabel="ConnectMouse" accessible style={styles.brandMark}>
          <BrandMark size={54} />
        </View>
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
    borderRadius: RADIUS.medium,
    height: 54,
    width: 54,
    ...SHADOWS.glow,
  },
  brandText: { color: COLORS.text, fontSize: 15, fontWeight: '800', letterSpacing: 1.6 },
  brandLight: { color: COLORS.accent, fontWeight: '600' },
  helpButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
});
