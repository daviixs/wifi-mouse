import { Platform, type ViewStyle } from 'react-native';

export const COLORS = {
  background: '#060B2E',
  backgroundDeep: '#030620',
  surface: '#111A4A',
  surfaceGlass: '#111A4A',
  surfaceSubtle: '#0C1438',
  surfaceActive: '#1D2B66',
  /*
   * Android paints a translucent border with a rounded radius as a separate layer over
   * the card edge (and, with elevation, over the shadow underneath), so it reads as a
   * second, lighter rim/inner panel. Use the same color pre-blended over `surface`
   * there; iOS/web keep the translucent original.
   */
  border: Platform.OS === 'android' ? '#313E7D' : 'rgba(130, 155, 255, 0.28)',
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

/*
 * Shadows are painted only OUTSIDE each surface.
 *
 * Android's native `elevation` was the cause of the lighter inner rectangle on every
 * card: HWUI renders the elevation shadow under the view's whole outline, and React
 * Native builds that outline as a path whose corner radius includes the border width,
 * so it never matches the painted background/translucent border on these dark cards.
 * CSS `boxShadow` (New Architecture, Android 9+) is drawn by OutsetBoxShadowDrawable,
 * which clips out the surface's own rounded border box, so nothing can show inside a
 * card, tile, sheet or button. Below Android 9 the shadow is simply omitted.
 */
function softShadow(offsetY: number, blur: number, opacity: number): ViewStyle {
  if (Platform.OS === 'ios') {
    return {
      shadowColor: '#000622',
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: blur,
    };
  }

  return { boxShadow: `0px ${offsetY}px ${blur}px rgba(0, 6, 34, ${opacity})` };
}

function glow(color: string, blur: number, opacity: number): ViewStyle {
  if (Platform.OS === 'ios') {
    return {
      shadowColor: color,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: opacity,
      shadowRadius: blur,
    };
  }
  return { boxShadow: `0px 6px ${blur}px ${withAlpha(color, opacity)}` };
}

/** `#RRGGBB` + alpha -> `rgba(r, g, b, a)` so Android/web glow matches iOS shadowOpacity. */
function withAlpha(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

export const SHADOWS = {
  glow: glow('#2F6BFF', 18, 0.55),
  card: softShadow(10, 24, 0.45),
  floating: softShadow(4, 12, 0.35),
} as const;
