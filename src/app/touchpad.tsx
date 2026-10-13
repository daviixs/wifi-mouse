import { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '../constants/config';
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
  screen: { flex: 1, paddingBottom: 14, paddingHorizontal: 18, paddingTop: 8 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 52 },
  backButton: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  connectionBlock: { flex: 1, gap: 4 },
  deviceName: { color: COLORS.muted, fontSize: 11, maxWidth: 210 },
  touchArea: { flex: 1, paddingBottom: 24, paddingTop: 18, position: 'relative' },
  controls: { gap: 13, paddingBottom: 4 },
  controlHint: { alignItems: 'center', gap: 5, marginBottom: 2 },
  controlEyebrow: { color: COLORS.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.7 },
  controlDescription: { color: '#656e67', fontSize: 10 },
  buttonRow: { flexDirection: 'row', position: 'relative' },
  buttonDivider: {
    backgroundColor: COLORS.border,
    height: 34,
    left: '50%',
    position: 'absolute',
    top: 14,
    width: 1,
    zIndex: 1,
  },
  gestureHint: {
    color: '#6e776f',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.1,
    paddingTop: 3,
    textAlign: 'center',
  },
  hintDot: { color: COLORS.accent },
});
