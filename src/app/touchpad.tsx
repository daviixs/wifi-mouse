import { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS, RADIUS, SHADOWS, SPACE } from '../theme/tokens';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { MouseButton } from '../components/MouseButton';
import { KeyboardModeControl } from '../components/KeyboardModeControl';
import { SensitivityControl } from '../components/SensitivityControl';
import { Touchpad } from '../components/Touchpad';
import { useConnectionStore } from '../stores/connection.store';
import { usePreferencesStore } from '../stores/preferences.store';
import type { MouseCommand } from '../types/protocol';

export default function TouchpadScreen() {
  const deviceName = useConnectionStore((state) => state.deviceName);
  const sendCommand = useConnectionStore((state) => state.sendCommand);
  const disconnect = useConnectionStore((state) => state.disconnect);
  const sensitivity = usePreferencesStore((state) => state.sensitivity);
  const setSensitivity = usePreferencesStore((state) => state.setSensitivity);
  const hydratePreferences = usePreferencesStore((state) => state.hydrate);

  useEffect(() => {
    void hydratePreferences();
  }, [hydratePreferences]);

  const sendClick = useCallback(
    (button: 'left' | 'right') => {
      const command: MouseCommand = { version: 1, type: 'mouse.click', payload: { button } };
      sendCommand(command);
    },
    [sendCommand],
  );

  const leave = () => {
    disconnect();
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar aos dispositivos"
            onPress={leave}
            style={styles.backButton}
          >
            <ArrowLeft color={COLORS.text} size={18} />
          </Pressable>
          <View style={styles.connectionBlock}>
            <ConnectionStatus />
            <Text style={styles.deviceName} numberOfLines={1}>
              {deviceName ?? 'Computador'}
            </Text>
          </View>
        </View>

        <View style={styles.touchArea}>
          <Touchpad onCommand={sendCommand} sensitivity={sensitivity} />
          <SensitivityControl sensitivity={sensitivity} onChange={setSensitivity} />
          <KeyboardModeControl onCommand={sendCommand} />
        </View>

        <View style={styles.controls}>
          <View style={styles.controlHint}>
            <Text style={styles.controlEyebrow}>BOTÕES DO MOUSE</Text>
            <Text style={styles.controlDescription}>Pressione para clicar</Text>
          </View>
          <View style={styles.buttonRow}>
            <MouseButton label="Clique esquerdo" side="left" onPress={() => sendClick('left')} />
            <View style={styles.buttonDivider} />
            <MouseButton label="Clique direito" side="right" onPress={() => sendClick('right')} />
          </View>
          <Text style={styles.gestureHint}>
            TOQUE PARA CLICAR <Text style={styles.hintDot}>·</Text> SEGURE PARA CLIQUE DIREITO
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: COLORS.background, flex: 1 },
  screen: {
    flex: 1,
    paddingBottom: SPACE.sm,
    paddingHorizontal: SPACE.md,
    paddingTop: SPACE.xs,
  },
  header: { alignItems: 'center', flexDirection: 'row', gap: SPACE.sm, minHeight: 52 },
  backButton: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
    ...SHADOWS.floating,
  },
  connectionBlock: { flex: 1, gap: SPACE.xxs },
  deviceName: { color: COLORS.muted, fontSize: 11, maxWidth: 210 },
  touchArea: { flex: 1, paddingBottom: SPACE.xl, paddingTop: SPACE.md, position: 'relative' },
  controls: { gap: SPACE.sm, paddingBottom: SPACE.xxs },
  controlHint: { alignItems: 'center', gap: SPACE.xxs, marginBottom: SPACE.xxs },
  controlEyebrow: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.7 },
  controlDescription: { color: COLORS.muted, fontSize: 12 },
  buttonRow: { flexDirection: 'row', position: 'relative' },
  buttonDivider: {
    backgroundColor: COLORS.border,
    height: 34,
    left: '50%',
    position: 'absolute',
    top: SPACE.sm,
    width: 1,
    zIndex: 1,
  },
  gestureHint: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
    paddingTop: SPACE.xxs,
    textAlign: 'center',
  },
  hintDot: { color: COLORS.primary },
});
