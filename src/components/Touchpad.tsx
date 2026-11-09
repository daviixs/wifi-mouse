import { useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { COLORS, RADIUS, SHADOWS, SPACE } from '../theme/tokens';
import {
  addMotionDelta,
  applyMotionSensitivity,
  createMotionCommand,
  type MotionKind,
} from '../services/mouse/motion';
import { useInteractionLifetime } from '../hooks/useInteractionLifetime';
import { TOUCH_FEEDBACK, updateTouchFeedback } from '../services/mouse/touchFeedback';
import type { MouseCommand } from '../types/protocol';

type TouchpadProps = {
  onCommand: (command: MouseCommand) => void;
  sensitivity: number;
  enabled: boolean;
};

export function Touchpad({ onCommand, sensitivity, enabled }: TouchpadProps) {
  const activeGestures = useSharedValue(0);
  const isLive = useInteractionLifetime(enabled);
  const pendingKind = useSharedValue<MotionKind | null>(null);
  const pendingDx = useSharedValue(0);
  const pendingDy = useSharedValue(0);
  const dispatchMotion = useCallback(
    (kind: MotionKind, dx: number, dy: number) => {
      if (!isLive()) return;
      const scaled = applyMotionSensitivity(kind, dx, dy, sensitivity);
      if (scaled.dx || scaled.dy) onCommand(createMotionCommand(kind, scaled.dx, scaled.dy));
    },
    [onCommand, sensitivity, isLive],
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
  const activateFrameCallback = useCallback(() => {
    if (isLive()) frameCallback.setActive(true);
  }, [frameCallback, isLive]);
  useEffect(() => {
    const reset = () => {
      frameCallback.setActive(false);
      activeGestures.set(updateTouchFeedback(activeGestures.get(), 0, 'reset'));
      pendingKind.set(null);
      pendingDx.set(0);
      pendingDy.set(0);
    };
    if (!enabled) reset();
    return () => {
      reset(); // disconnect/disable and unmount discard unsent motion; never flush offline
    };
  }, [activeGestures, enabled, frameCallback, pendingDx, pendingDy, pendingKind]);
  const animatedSurface = useAnimatedStyle(() => ({
    borderColor: activeGestures.get() ? COLORS.primary : COLORS.border,
    backgroundColor: activeGestures.get() ? COLORS.surfaceActive : COLORS.surface,
    transform: [{ scale: withTiming(activeGestures.get() ? 0.997 : 1, { duration: 140 }) }],
  }));

  const gestures = useMemo(() => {
    const dispatchClick = (button: 'left' | 'right') => {
      if (isLive()) onCommand({ version: 1, type: 'mouse.click', payload: { button } });
    };
    const flushPendingMotion = () => {
      'worklet';
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
      .enabled(enabled)
      .maxDuration(240)
      .maxDistance(12)
      .onBegin(() => {
        activeGestures.set(updateTouchFeedback(activeGestures.get(), TOUCH_FEEDBACK.tap, 'begin'));
      })
      .onFinalize(() => {
        activeGestures.set(
          updateTouchFeedback(activeGestures.get(), TOUCH_FEEDBACK.tap, 'finalize'),
        );
      })
      .onEnd((_event, success) => {
        if (success) {
          flushPendingMotion();
          scheduleOnRN(dispatchClick, 'left');
        }
      });
    const longPress = Gesture.LongPress()
      .enabled(enabled)
      .minDuration(520)
      .maxDistance(14)
      .onBegin(() => {
        activeGestures.set(
          updateTouchFeedback(activeGestures.get(), TOUCH_FEEDBACK.longPress, 'begin'),
        );
      })
      .onEnd((_event, success) => {
        if (success) {
          flushPendingMotion();
          scheduleOnRN(dispatchClick, 'right');
        }
      })
      .onFinalize(() => {
        activeGestures.set(
          updateTouchFeedback(activeGestures.get(), TOUCH_FEEDBACK.longPress, 'finalize'),
        );
      });
    const move = Gesture.Pan()
      .enabled(enabled)
      .minPointers(1)
      .maxPointers(1)
      .onBegin(() => {
        activeGestures.set(updateTouchFeedback(activeGestures.get(), TOUCH_FEEDBACK.move, 'begin'));
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
        activeGestures.set(
          updateTouchFeedback(activeGestures.get(), TOUCH_FEEDBACK.move, 'finalize'),
        );
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
      .enabled(enabled)
      .minPointers(2)
      .maxPointers(2)
      .onBegin(() => {
        activeGestures.set(
          updateTouchFeedback(activeGestures.get(), TOUCH_FEEDBACK.scroll, 'begin'),
        );
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
        activeGestures.set(
          updateTouchFeedback(activeGestures.get(), TOUCH_FEEDBACK.scroll, 'finalize'),
        );
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
  }, [
    activateFrameCallback,
    finishMotion,
    onCommand,
    pendingDx,
    pendingDy,
    pendingKind,
    activeGestures,
    enabled,
    isLive,
  ]);

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
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  surface: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: RADIUS.large,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    justifyContent: 'center',
    minHeight: 280,
    overflow: 'hidden',
    position: 'relative',
    ...SHADOWS.card,
  },
  topLine: {
    backgroundColor: COLORS.accent,
    height: 2,
    left: SPACE.xl,
    opacity: 0.6,
    position: 'absolute',
    right: SPACE.xl,
    top: 0,
  },
  labelBlock: { alignItems: 'center', gap: SPACE.sm },
  gestureGlyph: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 36,
    justifyContent: 'center',
    gap: SPACE.xxs,
  },
  finger: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.small,
    height: 29,
    opacity: 0.8,
    width: 9,
  },
  secondFinger: { height: 22, opacity: 0.45 },
  title: { color: COLORS.text, fontSize: 12, fontWeight: '800', letterSpacing: 3 },
  hint: { color: COLORS.muted, fontSize: 11, letterSpacing: 0.1 },
});
