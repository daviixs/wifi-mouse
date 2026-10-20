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

export const SHADOWS = {
  card: {
    shadowColor: '#31566B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.09,
    shadowRadius: 18,
    elevation: 4,
  },
  floating: {
    shadowColor: '#31566B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
} as const;
