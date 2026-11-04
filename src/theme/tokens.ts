import { Platform, type ViewStyle } from 'react-native';

export const COLORS = {
  background: '#060B2E',
  backgroundDeep: '#030620',
  surface: '#111A4A',
  surfaceGlass: 'rgba(40, 56, 150, 0.28)',
  surfaceSubtle: 'rgba(90, 120, 255, 0.12)',
  border: 'rgba(130, 155, 255, 0.28)',
  text: '#F4F7FF',
  muted: '#A9B6E6',
  primary: '#3D7BFF',
  secondary: '#5A8CFF',
  accent: '#8CC8FF',
  highlight: 'rgba(80, 130, 255, 0.28)',
  danger: '#FF6B6B',
  dangerSurface: 'rgba(255, 90, 90, 0.12)',
  success: '#2FD07A',
  onPrimary: '#FFFFFF',
} as const;

export const GRADIENTS = {
  screen: ['#0B1A6B', '#071046', '#050A2C'] as const,
  button: ['#3FA0FF', '#2F6BFF', '#4B3DF5'] as const,
  card: ['rgba(48, 66, 170, 0.45)', 'rgba(22, 30, 92, 0.55)'] as const,
  appIcon: ['#4AA8FF', '#2457F5'] as const,
};

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

function softShadow(offsetY: number, blur: number, opacity: number, elevation: number): ViewStyle {
  if (Platform.OS === 'ios') {
    return {
      shadowColor: '#000622',
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: blur,
    };
  }

  if (Platform.OS === 'android') return { elevation };

  return { boxShadow: `0px ${offsetY}px ${blur}px rgba(0, 6, 34, ${opacity})` };
}

function glow(color: string, blur: number, opacity: number, elevation: number): ViewStyle {
  if (Platform.OS === 'ios') {
    return {
      shadowColor: color,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: opacity,
      shadowRadius: blur,
    };
  }
  if (Platform.OS === 'android') return { elevation, shadowColor: color };
  return { boxShadow: `0px 6px ${blur}px ${color}` };
}

export const SHADOWS = {
  glow: glow('#2F6BFF', 18, 0.55, 8),
  card: softShadow(10, 24, 0.45, 6),
  floating: softShadow(4, 12, 0.35, 3),
} as const;
