import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { COLORS } from '../constants/config';
import type { MouseCommand } from '../types/protocol';

/* eslint-disable react-hooks/immutability -- Reanimated shared values mutate inside UI-thread gesture worklets. */

type TouchpadProps = { onCommand: (command: MouseCommand) => void };

export function Touchpad({ onCommand }: TouchpadProps) {
  const pressed = useSharedValue(0);
  const animatedSurface = useAnimatedStyle(() => ({
    borderColor: pressed.value ? COLORS.accentDark : COLORS.border,
    backgroundColor: pressed.value ? '#1d241b' : COLORS.surface,
    transform: [{ scale: withTiming(pressed.value ? 0.997 : 1, { duration: 140 }) }],
  }));

  const gestures = useMemo(() => {
    const leftClick = () =>
      onCommand({ version: 1, type: 'mouse.click', payload: { button: 'left' } });
    const rightClick = () =>
      onCommand({ version: 1, type: 'mouse.click', payload: { button: 'right' } });
    const tap = Gesture.Tap()
      .maxDuration(240)
      .maxDistance(12)
      .onEnd((_event, success) => {
        if (success) runOnJS(leftClick)();
      });
    const longPress = Gesture.LongPress()
      .minDuration(520)
      .maxDistance(14)
      .onBegin(() => {
        pressed.value = 1;
      })
      .onEnd((_event, success) => {
        pressed.value = 0;
        if (success) runOnJS(rightClick)();
      })
      .onFinalize(() => {
        pressed.value = 0;
      });
    const move = Gesture.Pan()
      .minPointers(1)
      .maxPointers(1)
      .onBegin(() => {
        pressed.value = 1;
      })
      .onChange((event) => {
        if (event.changeX || event.changeY) {
          runOnJS(onCommand)({
            version: 1,
            type: 'mouse.move',
            payload: { dx: event.changeX, dy: event.changeY },
          });
        }
      })
      .onFinalize(() => {
        pressed.value = 0;
      });
    const scroll = Gesture.Pan()
      .minPointers(2)
      .maxPointers(2)
      .onBegin(() => {
        pressed.value = 1;
      })
      .onChange((event) => {
        if (event.changeX || event.changeY) {
          runOnJS(onCommand)({
            version: 1,
            type: 'mouse.scroll',
            payload: { dx: -event.changeX, dy: -event.changeY },
          });
        }
      })
      .onFinalize(() => {
        pressed.value = 0;
      });

    return Gesture.Race(longPress, tap, scroll, move);
  }, [onCommand, pressed]);

  return (
    <GestureDetector gesture={gestures}>
      <Animated.View style={[styles.surface, animatedSurface]}>
        <View style={styles.topLine} />
        <View style={styles.labelBlock}>
          <View style={styles.gestureGlyph}>
            <View style={styles.finger} />
            <View style={[styles.finger, styles.secondFinger]} />
          </View>
          <Text style={styles.title}>TOUCHPAD</Text>
          <Text style={styles.hint}>Deslize para mover · dois dedos para rolar</Text>
        </View>
        <Text style={styles.cornerLabel}>01 — 02</Text>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  surface: {
    alignItems: 'center',
    borderColor: COLORS.border,
    borderRadius: 26,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 280,
    overflow: 'hidden',
    position: 'relative',
  },
  topLine: {
    backgroundColor: COLORS.accent,
    height: 2,
    left: 24,
    opacity: 0.6,
    position: 'absolute',
    right: 24,
    top: 0,
  },
  labelBlock: { alignItems: 'center', gap: 12 },
  gestureGlyph: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 36,
    justifyContent: 'center',
    gap: 5,
  },
  finger: { backgroundColor: COLORS.accent, borderRadius: 8, height: 29, opacity: 0.8, width: 9 },
  secondFinger: { height: 22, opacity: 0.45 },
  title: { color: COLORS.text, fontSize: 12, fontWeight: '800', letterSpacing: 3 },
  hint: { color: COLORS.muted, fontSize: 11, letterSpacing: 0.1 },
  cornerLabel: {
    bottom: 18,
    color: '#5d665f',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.4,
    position: 'absolute',
    right: 20,
  },
});
