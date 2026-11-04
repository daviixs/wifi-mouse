import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

type LaptopIllustrationProps = {
  width: number;
  /** Hero variant: concentric rings + wifi waves. Compact variant: orbit ring only. */
  variant?: 'hero' | 'compact';
};

/** Vector laptop with cursor over a glowing platform (drawn, no bitmap assets). */
export function LaptopIllustration({ width, variant = 'hero' }: LaptopIllustrationProps) {
  const isHero = variant === 'hero';
  const height = width * (isHero ? 0.72 : 0.5);
  const viewBox = isHero ? '0 0 300 216' : '0 40 300 150';

  return (
    <Svg height={height} viewBox={viewBox} width={width}>
      <Defs>
        <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#3D7BFF" stopOpacity="0.55" />
          <Stop offset="0.6" stopColor="#2F5BFF" stopOpacity="0.15" />
          <Stop offset="1" stopColor="#2F5BFF" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="platform" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#5FA8FF" stopOpacity="0.9" />
          <Stop offset="0.55" stopColor="#2F6BFF" stopOpacity="0.45" />
          <Stop offset="1" stopColor="#1B2AA8" stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="screen" x1="0" x2="1" y1="0" y2="1">
          <Stop offset="0" stopColor="#2C5BFF" />
          <Stop offset="1" stopColor="#1A2C9C" />
        </LinearGradient>
        <LinearGradient id="frame" x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0" stopColor="#8EC3FF" />
          <Stop offset="1" stopColor="#4C74FF" />
        </LinearGradient>
        <LinearGradient id="base" x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0" stopColor="#9CC8FF" />
          <Stop offset="1" stopColor="#4D6BF0" />
        </LinearGradient>
        <LinearGradient id="wifi" x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0" stopColor="#7FD0FF" />
          <Stop offset="1" stopColor="#3C8BFF" />
        </LinearGradient>
      </Defs>

      <Ellipse cx="150" cy="110" fill="url(#halo)" rx="150" ry="110" />
      {isHero ? (
        <G fill="none" stroke="#6E95FF">
          <Circle cx="150" cy="100" r="98" strokeOpacity={0.18} strokeWidth={1} />
          <Circle cx="150" cy="100" r="76" strokeOpacity={0.3} strokeWidth={1.2} />
        </G>
      ) : (
        <Ellipse
          cx="150"
          cy="118"
          fill="none"
          rx="140"
          ry="44"
          stroke="#8C8CFF"
          strokeOpacity={0.35}
          transform="rotate(-8 150 118)"
        />
      )}

      {/* platform */}
      <Ellipse cx="150" cy="168" fill="url(#platform)" rx="128" ry="24" />
      <Ellipse
        cx="150"
        cy="168"
        fill="none"
        rx="112"
        ry="17"
        stroke="#9CC4FF"
        strokeOpacity={0.7}
      />
      <Ellipse
        cx="150"
        cy="168"
        fill="none"
        rx="128"
        ry="24"
        stroke="#6E95FF"
        strokeOpacity={0.35}
      />

      {/* laptop */}
      <Rect fill="url(#frame)" height="88" rx="8" width="138" x="81" y="70" />
      <Rect fill="url(#screen)" height="76" rx="4" width="126" x="87" y="76" />
      <Path d="M87 76 h126 v20 L87 140 Z" fill="#FFFFFF" opacity={0.06} />
      <Path d="M62 158 h176 l-8 10 a6 6 0 0 1 -5 2 H75 a6 6 0 0 1 -5 -2 Z" fill="url(#base)" />
      <Rect fill="#2D3FB8" height="3" rx="1.5" width="34" x="133" y="159" />

      {/* cursor */}
      <Path
        d="M168 104 L168 136 L176 128 L182 141 L188 138 L182 125 L193 125 Z"
        fill="#FFFFFF"
        stroke="#C9DAFF"
        strokeLinejoin="round"
        strokeWidth={1.5}
      />

      {isHero && (
        <G fill="none" stroke="url(#wifi)" strokeLinecap="round" strokeWidth={6}>
          <Path d="M126 42 a34 34 0 0 1 48 0" />
          <Path d="M135 52 a21 21 0 0 1 30 0" />
          <Circle cx="150" cy="62" fill="#7FD0FF" r="4" stroke="none" />
        </G>
      )}
    </Svg>
  );
}
