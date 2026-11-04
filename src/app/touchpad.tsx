import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenBackground } from '../components/ui/ScreenBackground';
import { COLORS, RADIUS, SHADOWS, SPACE } from '../theme/tokens';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { MouseButton } from '../components/MouseButton';
import { KeyboardModeControl } from '../components/KeyboardModeControl';
import { MediaBar, MediaPanel } from '../components/MediaControls';
import { ShortcutsControl } from '../components/ShortcutsControl';
import { SensitivityControl } from '../components/SensitivityControl';
import { Touchpad } from '../components/Touchpad';
import { useComputerVolumeKeys } from '../hooks/useComputerVolumeKeys';
import { useConnectionStore } from '../stores/connection.store';
import { usePreferencesStore } from '../stores/preferences.store';
import type { MouseCommand } from '../types/protocol';

export default function TouchpadScreen() {
  const { teclado } = useLocalSearchParams<{ teclado?: string }>();
  const sendCommand = useConnectionStore((state) => state.sendCommand);
  const disconnect = useConnectionStore((state) => state.disconnect);
  const status = useConnectionStore((state) => state.status);
  const connectionError = useConnectionStore((state) => state.error);
  const isOffline = status === 'reconnecting' || status === 'error' || status === 'disconnected';
  const sensitivity = usePreferencesStore((state) => state.sensitivity);
  const setSensitivity = usePreferencesStore((state) => state.setSensitivity);
  const hydratePreferences = usePreferencesStore((state) => state.hydrate);
  const useVolumeKeys = usePreferencesStore((state) => state.useVolumeKeys);
  const setUseVolumeKeys = usePreferencesStore((state) => state.setUseVolumeKeys);
  const [isMediaOpen, setIsMediaOpen] = useState(false);

  useComputerVolumeKeys();

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

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/conectado');
  };

  const leave = () => {
    disconnect();
    if (router.canDismiss()) router.dismissTo('/');
    else router.replace('/');
  };

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.screen}>
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voltar para a tela de conexão"
              onPress={goBack}
              style={styles.backButton}
            >
              <ArrowLeft color={COLORS.text} size={18} />
            </Pressable>
            <View style={styles.connectionBlock}>
              <ConnectionStatus />
            </View>
            <View style={styles.headerSpacer} />
          </View>

          {isOffline && (
            <View accessibilityLiveRegion="polite" style={styles.offlineBanner}>
              <Text style={styles.offlineTitle}>
                {status === 'reconnecting' ? 'Conexão perdida' : 'Sem conexão com o computador'}
              </Text>
              <Text style={styles.offlineText}>
                {status === 'reconnecting'
                  ? 'Tentando reconectar… Verifique a rede Wi-Fi e se o agente continua aberto.'
                  : (connectionError ?? 'A conexão foi encerrada.')}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={leave}
                style={({ pressed }) => [styles.offlineButton, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.offlineButtonLabel}>Voltar e conectar novamente</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.touchArea}>
            <Touchpad onCommand={sendCommand} sensitivity={sensitivity} />
            <SensitivityControl sensitivity={sensitivity} onChange={setSensitivity} />
            <KeyboardModeControl initialOpen={teclado === '1'} onCommand={sendCommand} />
            <ShortcutsControl onCommand={sendCommand} />
          </View>

          <View style={styles.controls}>
            <MediaBar onCommand={sendCommand} onOpenPanel={() => setIsMediaOpen(true)} />
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
      <MediaPanel
        onClose={() => setIsMediaOpen(false)}
        onCommand={sendCommand}
        onUseVolumeKeysChange={setUseVolumeKeys}
        useVolumeKeys={useVolumeKeys}
        visible={isMediaOpen}
      />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  screen: {
    flex: 1,
    paddingBottom: SPACE.sm,
    paddingHorizontal: SPACE.md,
    paddingTop: SPACE.xs,
  },
  header: { alignItems: 'center', flexDirection: 'row', gap: SPACE.sm, minHeight: 52 },
  backButton: {
    alignItems: 'center',
    backgroundColor: COLORS.surfaceGlass,
    borderColor: COLORS.border,
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
    ...SHADOWS.floating,
  },
  connectionBlock: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  headerSpacer: { height: 42, width: 42 },
  offlineBanner: {
    backgroundColor: COLORS.dangerSurface,
    borderColor: COLORS.danger,
    borderRadius: RADIUS.medium,
    borderWidth: StyleSheet.hairlineWidth,
    gap: SPACE.xxs,
    marginTop: SPACE.xs,
    padding: SPACE.sm,
  },
  offlineTitle: { color: COLORS.danger, fontSize: 13, fontWeight: '800' },
  offlineText: { color: COLORS.text, fontSize: 12, lineHeight: 17 },
  offlineButton: { alignSelf: 'flex-start', marginTop: SPACE.xxs, paddingVertical: SPACE.xxs },
  offlineButtonLabel: { color: COLORS.accent, fontSize: 13, fontWeight: '800' },
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
