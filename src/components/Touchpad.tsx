import { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { COLORS } from '../constants/config';
import { addMotionDelta, createMotionCommand, type MotionKind } from '../services/mouse/motion';
import type { MouseCommand } from '../types/protocol';

type TouchpadProps = { onCommand: (command: MouseCommand) => void };

export function Touchpad({ onCommand }: TouchpadProps) {
  const pressed = useSharedValue(0);
  const pendingKind = useSharedValue<MotionKind | null>(null);
  const pendingDx = useSharedValue(0);
  const pendingDy = useSharedValue(0);
  const dispatchMotion = useCallback(
    (kind: MotionKind, dx: number, dy: number) => {
      if (dx || dy) onCommand(createMotionCommand(kind, dx, dy));
    },
    [onCommand],
  );
  const frameCallback = useFrameCallback(() => {
    const kind = pendingKind.get();
    if (!kind) return;

    const dx = pendingDx.get();
    const dy = pendingDy.get();
    pendingDx.set(0);
    pendingDy.set(0);
    if (dx || dy) scheduleOnRN(dispatchMotion, kind, dx, dy);
  }, false);
  const finishMotion = useCallback(
    (kind: MotionKind | null, dx: number, dy: number) => {
      if (kind && (dx || dy)) dispatchMotion(kind, dx, dy);
      frameCallback.setActive(false);
    },
    [dispatchMotion, frameCallback],
  );
  const activateFrameCallback = useCallback(() => frameCallback.setActive(true), [frameCallback]);
  const animatedSurface = useAnimatedStyle(() => ({
    borderColor: pressed.get() ? COLORS.accentDark : COLORS.border,
    backgroundColor: pressed.get() ? '#1d241b' : COLORS.surface,
    transform: [{ scale: withTiming(pressed.get() ? 0.997 : 1, { duration: 140 }) }],
  }));

  const gestures = useMemo(() => {
    const dispatchClick = (button: 'left' | 'right') => {
      onCommand({ version: 1, type: 'mouse.click', payload: { button } });
    };
    const flushPendingMotion = () => {
      const kind = pendingKind.get();
      if (!kind) return;
      const dx = pendingDx.get();
      const dy = pendingDy.get();
      pendingKind.set(null);
      pendingDx.set(0);
      pendingDy.set(0);
      scheduleOnRN(finishMotion, kind, dx, dy);
    };
    const tap = Gesture.Tap()
      .maxDuration(240)
      .maxDistance(12)
      .onEnd((_event, success) => {
        if (success) {
          flushPendingMotion();
          scheduleOnRN(dispatchClick, 'left');
        }
      });
    const longPress = Gesture.LongPress()
      .minDuration(520)
      .maxDistance(14)
      .onBegin(() => {
        pressed.set(1);
      })
      .onEnd((_event, success) => {
        pressed.set(0);
        if (success) {
          flushPendingMotion();
          scheduleOnRN(dispatchClick, 'right');
        }
      })
      .onFinalize(() => {
        pressed.set(0);
      });
    const move = Gesture.Pan()
      .minPointers(1)
      .maxPointers(1)
      .onBegin(() => {
        pressed.set(1);
      })
      .onStart(() => {
        const previousKind = pendingKind.get();
        if (previousKind && previousKind !== 'mouse.move') {
          scheduleOnRN(finishMotion, previousKind, pendingDx.get(), pendingDy.get());
          pendingDx.set(0);
          pendingDy.set(0);
        }
        pendingKind.set('mouse.move');
        scheduleOnRN(activateFrameCallback);
      })
      .onChange((event) => {
        if (event.changeX || event.changeY) {
          pendingDx.set(addMotionDelta(pendingDx.get(), event.changeX));
          pendingDy.set(addMotionDelta(pendingDy.get(), event.changeY));
        }
      })
      .onFinalize(() => {
        pressed.set(0);
        if (pendingKind.get() === 'mouse.move') {
          const dx = pendingDx.get();
          const dy = pendingDy.get();
          pendingKind.set(null);
          pendingDx.set(0);
          pendingDy.set(0);
          scheduleOnRN(finishMotion, 'mouse.move', dx, dy);
        }
      });
    const scroll = Gesture.Pan()
      .minPointers(2)
      .maxPointers(2)
      .onBegin(() => {
        pressed.set(1);
      })
      .onStart(() => {
        const previousKind = pendingKind.get();
        if (previousKind && previousKind !== 'mouse.scroll') {
          scheduleOnRN(finishMotion, previousKind, pendingDx.get(), pendingDy.get());
          pendingDx.set(0);
          pendingDy.set(0);
        }
        pendingKind.set('mouse.scroll');
        scheduleOnRN(activateFrameCallback);
      })
      .onChange((event) => {
        if (event.changeX || event.changeY) {
          pendingDx.set(addMotionDelta(pendingDx.get(), -event.changeX));
          pendingDy.set(addMotionDelta(pendingDy.get(), -event.changeY));
        }
      })
      .onFinalize(() => {
        pressed.set(0);
        if (pendingKind.get() === 'mouse.scroll') {
          const dx = pendingDx.get();
          const dy = pendingDy.get();
          pendingKind.set(null);
          pendingDx.set(0);
          pendingDy.set(0);
          scheduleOnRN(finishMotion, 'mouse.scroll', dx, dy);
        }
      });

    return Gesture.Race(longPress, tap, scroll, move);
  }, [activateFrameCallback, finishMotion, onCommand, pendingDx, pendingDy, pendingKind, pressed]);

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
