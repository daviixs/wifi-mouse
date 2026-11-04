import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';

import { GRADIENTS } from '../../theme/tokens';

/** Deep navy gradient with soft blue glows, shared by every screen. */
export function ScreenBackground({ children }: { children: ReactNode }) {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={GRADIENTS.screen}
        end={{ x: 0.7, y: 1 }}
        start={{ x: 0.2, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <Svg
        height="100%"
        pointerEvents="none"
        preserveAspectRatio="xMidYMid slice"
        style={StyleSheet.absoluteFill}
        viewBox="0 0 390 844"
        width="100%"
      >
        <Defs>
          <RadialGradient id="glowTop" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#2F6BFF" stopOpacity="0.45" />
            <Stop offset="1" stopColor="#2F6BFF" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="glowBottom" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#5B3DF5" stopOpacity="0.35" />
            <Stop offset="1" stopColor="#5B3DF5" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Ellipse cx="195" cy="230" fill="url(#glowTop)" rx="260" ry="230" />
        <Ellipse cx="390" cy="760" fill="url(#glowBottom)" rx="260" ry="220" />
        <Path d="M0 300 C 120 220, 260 140, 390 160 L390 0 L0 0 Z" fill="#3A6BFF" opacity={0.06} />
        <Path
          d="M0 620 C 140 560, 260 520, 390 420 L390 844 L0 844 Z"
          fill="#1B2A8F"
          opacity={0.18}
        />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ root: { backgroundColor: GRADIENTS.screen[2], flex: 1 } });
