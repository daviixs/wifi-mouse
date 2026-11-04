import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Check, Keyboard, LayoutGrid, Laptop, Mouse, Music2, WifiOff } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FirstRunSetupNotice } from '../components/FirstRunSetupNotice';
import { MediaPanel } from '../components/MediaControls';
import { MoreSheet } from '../components/MoreSheet';
import { LaptopIllustration } from '../components/illustrations/LaptopIllustration';
import { AppHeader } from '../components/ui/AppHeader';
import { GlassCard } from '../components/ui/GlassCard';
import { ScreenBackground } from '../components/ui/ScreenBackground';
import { useComputerVolumeKeys } from '../hooks/useComputerVolumeKeys';
import { useConnectionStore } from '../stores/connection.store';
import { usePreferencesStore } from '../stores/preferences.store';
import { COLORS, RADIUS, SHADOWS, SPACE } from '../theme/tokens';

type TileProps = { label: string; icon: ReactNode; onPress: () => void; hint: string };

function Tile({ label, icon, onPress, hint }: TileProps) {
  return (
    <Pressable
      accessibilityHint={hint}
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.tileShell, pressed && styles.pressed]}
    >
      <GlassCard radius={RADIUS.medium + 4} style={styles.tile}>
        {icon}
        <Text style={styles.tileLabel}>{label}</Text>
      </GlassCard>
    </Pressable>
  );
}

export default function ConnectedScreen() {
  const { width } = useWindowDimensions();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isHelpVisible, setIsHelpVisible] = useState(false);
  const [isMediaOpen, setIsMediaOpen] = useState(false);
  const deviceName = useConnectionStore((state) => state.deviceName);
  const status = useConnectionStore((state) => state.status);
  const connectionError = useConnectionStore((state) => state.error);
  const sendCommand = useConnectionStore((state) => state.sendCommand);
  const disconnect = useConnectionStore((state) => state.disconnect);
  const sensitivity = usePreferencesStore((state) => state.sensitivity);
  const setSensitivity = usePreferencesStore((state) => state.setSensitivity);
  const hydratePreferences = usePreferencesStore((state) => state.hydrate);
  const useVolumeKeys = usePreferencesStore((state) => state.useVolumeKeys);
  const setUseVolumeKeys = usePreferencesStore((state) => state.setUseVolumeKeys);

  useComputerVolumeKeys();

  useEffect(() => {
    void hydratePreferences();
  }, [hydratePreferences]);

  const isOnline = status === 'connected';
  const isReconnecting = status === 'reconnecting';
  const isOffline = !isOnline && !isReconnecting && status !== 'connecting';
  const statusLabel = isOnline ? 'Online' : isReconnecting ? 'Reconectando' : 'Offline';
  const statusColor = isOnline ? COLORS.success : isReconnecting ? '#FFC24B' : COLORS.danger;

  const leave = () => {
    setIsMoreOpen(false);
    setIsMediaOpen(false);
    disconnect();
    if (router.canDismiss()) router.dismissTo('/');
    else router.replace('/');
  };

  return (
    <ScreenBackground>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
          <AppHeader onHelp={() => setIsHelpVisible(true)} />

          <GlassCard style={styles.heroCard}>
            <View>
              <LaptopIllustration variant="compact" width={Math.min(width - 80, 320)} />
              {isOnline && (
                <View style={styles.checkBadge}>
                  <Check color={COLORS.onPrimary} size={22} strokeWidth={3.2} />
                </View>
              )}
            </View>
          </GlassCard>

          <Text style={styles.title}>{isOnline ? 'Conectado!' : 'Conexão perdida'}</Text>
          <Text style={styles.subtitle}>
            {isOnline
              ? 'Seu computador está pronto\npara ser acessado.'
              : isReconnecting
                ? 'Tentando reconectar… Verifique a rede Wi-Fi e se o agente continua aberto.'
                : (connectionError ?? 'A conexão foi encerrada.')}
          </Text>

          <GlassCard radius={RADIUS.medium + 4} style={styles.deviceRow}>
            <Laptop color={COLORS.accent} size={24} strokeWidth={1.8} />
            <Text numberOfLines={1} style={styles.deviceName}>
              {deviceName ?? '—'}
            </Text>
            <View accessibilityLabel={`Status: ${statusLabel}`} style={styles.status}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </GlassCard>

          <View style={styles.tiles}>
            <Tile
              hint="Abre o touchpad"
              icon={<Mouse color={COLORS.text} size={30} strokeWidth={1.6} />}
              label="Controle"
              onPress={() => router.push('/touchpad')}
            />
            <Tile
              hint="Abre o touchpad com o teclado aberto"
              icon={<Keyboard color={COLORS.text} size={30} strokeWidth={1.6} />}
              label="Teclado"
              onPress={() => router.push({ pathname: '/touchpad', params: { teclado: '1' } })}
            />
            <Tile
              hint="Volume e controle de mídia do computador"
              icon={<Music2 color={COLORS.text} size={30} strokeWidth={1.6} />}
              label="Mídia"
              onPress={() => setIsMediaOpen(true)}
            />
            <Tile
              hint="Atalhos e sensibilidade"
              icon={
                <LayoutGrid color={COLORS.text} fill={COLORS.text} size={30} strokeWidth={1.4} />
              }
              label="Mais"
              onPress={() => setIsMoreOpen(true)}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={leave}
            style={({ pressed }) => [styles.disconnect, pressed && styles.pressed]}
          >
            <WifiOff color={COLORS.text} size={22} strokeWidth={1.8} />
            <Text style={styles.disconnectLabel}>
              {isOffline ? 'Voltar e conectar novamente' : 'Desconectar'}
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
      <MoreSheet
        onClose={() => setIsMoreOpen(false)}
        onCommand={sendCommand}
        onSensitivityChange={setSensitivity}
        onUseVolumeKeysChange={setUseVolumeKeys}
        sensitivity={sensitivity}
        useVolumeKeys={useVolumeKeys}
        visible={isMoreOpen}
      />
      <MediaPanel
        onClose={() => setIsMediaOpen(false)}
        onCommand={sendCommand}
        onUseVolumeKeysChange={setUseVolumeKeys}
        useVolumeKeys={useVolumeKeys}
        visible={isMediaOpen}
      />
      <FirstRunSetupNotice onDismiss={() => setIsHelpVisible(false)} visible={isHelpVisible} />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  screen: {
    alignSelf: 'center',
    flexGrow: 1,
    gap: SPACE.md,
    maxWidth: 480,
    paddingBottom: SPACE.lg,
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.xs,
    width: '100%',
  },
  heroCard: { alignItems: 'center', marginTop: SPACE.sm, paddingVertical: SPACE.md },
  checkBadge: {
    alignItems: 'center',
    backgroundColor: COLORS.success,
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: RADIUS.pill,
    borderWidth: 2,
    height: 40,
    justifyContent: 'center',
    position: 'absolute',
    right: '22%',
    top: '6%',
    width: 40,
    ...SHADOWS.floating,
  },
  title: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: '800',
    marginTop: SPACE.xs,
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 16,
    lineHeight: 23,
    marginTop: -SPACE.xs,
    textAlign: 'center',
  },
  deviceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACE.md,
    marginTop: SPACE.xs,
    minHeight: 64,
    paddingHorizontal: SPACE.lg,
  },
  deviceName: { color: COLORS.text, flex: 1, fontSize: 18, fontWeight: '600' },
  status: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  statusDot: { borderRadius: RADIUS.pill, height: 9, width: 9 },
  statusLabel: { fontSize: 14, fontWeight: '600' },
  tiles: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.xs },
  tileShell: { flex: 1 },
  tile: {
    alignItems: 'center',
    gap: SPACE.sm,
    justifyContent: 'center',
    minHeight: 104,
    paddingHorizontal: 2,
  },
  tileLabel: { color: COLORS.text, fontSize: 13, fontWeight: '500' },
  disconnect: {
    alignItems: 'center',
    backgroundColor: 'rgba(40, 56, 150, 0.18)',
    borderColor: COLORS.border,
    borderRadius: RADIUS.medium + 4,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SPACE.sm,
    justifyContent: 'center',
    marginTop: SPACE.sm,
    minHeight: 60,
  },
  disconnectLabel: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
