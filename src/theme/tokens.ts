import { Platform, type ViewStyle } from 'react-native';

export const COLORS = {
  background: '#F3F5F8',
  surface: '#FFFFFF',
  surfaceSubtle: '#EAF4FA',
  border: '#D9E3E8',
  text: '#172B36',
  muted: '#445968',
  primary: '#086288',
  secondary: '#4D8DBA',
  accent: '#97D7FF',
  highlight: '#FFEFC4',
  danger: '#AE2E24',
  success: '#216E4E',
} as const;

export const SPACE = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export const RADIUS = {
  small: 8,
  medium: 14,
  large: 28,
  pill: 999,
} as const;

function softShadow(
  offsetY: number,
  blur: number,
  opacity: number,
  elevation: number,
): ViewStyle {
  if (Platform.OS === 'ios') {
    return {
      shadowColor: '#31566B',
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: blur,
    };
  }

  if (Platform.OS === 'android') return { elevation };

  return { boxShadow: `0px ${offsetY}px ${blur}px rgba(49, 86, 107, ${opacity})` };
}

export const SHADOWS = {
  card: softShadow(8, 18, 0.09, 4),
  floating: softShadow(4, 10, 0.12, 3),
} as const;
