import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import {
  Music2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Square,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isVolumeKeysAvailable } from '../../modules/volume-keys/src';
import { buildMediaKeyCommand } from '../services/media/mediaKeys';
import { COLORS, RADIUS, SHADOWS, SPACE } from '../theme/tokens';
import type { MediaKey, MouseCommand } from '../types/protocol';

type SendMedia = (key: MediaKey) => void;

export function useSendMedia(onCommand: (command: MouseCommand) => void): SendMedia {
  return (key) => {
    const command = buildMediaKeyCommand(key);
    if (command) onCommand(command);
  };
}

type RoundButtonProps = {
  label: string;
  icon: ReactNode;
  onPress: () => void;
  size?: number;
  primary?: boolean;
};

function RoundButton({ label, icon, onPress, size = 56, primary }: RoundButtonProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.round,
        { borderRadius: size / 2, height: size, width: size },
        primary && styles.roundPrimary,
        pressed && styles.pressed,
      ]}
    >
      {icon}
    </Pressable>
  );
}

type VolumeKeysToggleProps = { value: boolean; onChange: (value: boolean) => void };

export function VolumeKeysToggle({ value, onChange }: VolumeKeysToggleProps) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>Usar botões de volume do celular</Text>
        <Text style={styles.toggleHint}>
          {isVolumeKeysAvailable
            ? 'Com o touchpad aberto, os botões físicos mudam o volume do computador.'
            : 'Disponível apenas no app instalado (Android/iOS).'}
        </Text>
      </View>
      <Switch
        accessibilityLabel="Usar botões de volume do celular"
        ios_backgroundColor={COLORS.border}
        onValueChange={onChange}
        thumbColor={value ? COLORS.onPrimary : COLORS.muted}
        trackColor={{ false: COLORS.border, true: COLORS.primary }}
        value={value}
      />
    </View>
  );
}

type MediaPanelProps = {
  visible: boolean;
  onClose: () => void;
  onCommand: (command: MouseCommand) => void;
  useVolumeKeys: boolean;
  onUseVolumeKeysChange: (value: boolean) => void;
};

/** Bottom sheet with media transport and computer volume controls. */
export function MediaPanel({
  visible,
  onClose,
  onCommand,
  useVolumeKeys,
  onUseVolumeKeysChange,
}: MediaPanelProps) {
  const insets = useSafeAreaInsets();
  const send = useSendMedia(onCommand);

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.root}>
        <Pressable accessibilityLabel="Fechar" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View
          accessibilityViewIsModal
          style={[styles.sheet, { paddingBottom: insets.bottom + SPACE.md }]}
        >
          <View style={styles.grabber} />
          <View style={styles.titleRow}>
            <View style={styles.headingBlock}>
              <Text style={styles.eyebrow}>CONTROLE DO COMPUTADOR</Text>
              <Text style={styles.heading}>Mídia</Text>
            </View>
            <Pressable
              accessibilityLabel="Fechar"
              accessibilityRole="button"
              hitSlop={10}
              onPress={onClose}
            >
              <X color={COLORS.text} size={22} />
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.eyebrow}>REPRODUÇÃO</Text>
            <View style={styles.transport}>
              <RoundButton
                icon={<SkipBack color={COLORS.text} fill={COLORS.text} size={22} />}
                label="Faixa anterior"
                onPress={() => send('previous')}
              />
              <RoundButton
                icon={
                  <View style={styles.playPause}>
                    <Play color={COLORS.onPrimary} fill={COLORS.onPrimary} size={20} />
                    <Pause color={COLORS.onPrimary} fill={COLORS.onPrimary} size={20} />
                  </View>
                }
                label="Reproduzir ou pausar"
                onPress={() => send('play_pause')}
                primary
                size={76}
              />
              <RoundButton
                icon={<SkipForward color={COLORS.text} fill={COLORS.text} size={22} />}
                label="Próxima faixa"
                onPress={() => send('next')}
              />
            </View>
            <Pressable
              accessibilityLabel="Parar reprodução"
              accessibilityRole="button"
              onPress={() => send('stop')}
              style={({ pressed }) => [styles.stop, pressed && styles.pressed]}
            >
              <Square color={COLORS.muted} fill={COLORS.muted} size={12} />
              <Text style={styles.stopLabel}>Parar</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.eyebrow}>VOLUME DO COMPUTADOR</Text>
            <View style={styles.volumeRow}>
              <VolumePill
                icon={<Volume1 color={COLORS.text} size={22} />}
                label="Diminuir"
                onPress={() => send('volume_down')}
              />
              <VolumePill
                icon={<VolumeX color={COLORS.text} size={22} />}
                label="Mudo"
                onPress={() => send('volume_mute')}
              />
              <VolumePill
                icon={<Volume2 color={COLORS.text} size={22} />}
                label="Aumentar"
                onPress={() => send('volume_up')}
              />
            </View>
          </View>

          <VolumeKeysToggle onChange={onUseVolumeKeysChange} value={useVolumeKeys} />
        </View>
      </View>
    </Modal>
  );
}

function VolumePill({
  icon,
  label,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${label} volume do computador`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
    >
      {icon}
      <Text style={styles.pillLabel}>{label}</Text>
    </Pressable>
  );
}

type MediaBarProps = { onCommand: (command: MouseCommand) => void; onOpenPanel: () => void };

/** Compact media/volume bar for the touchpad screen. */
export function MediaBar({ onCommand, onOpenPanel }: MediaBarProps) {
  const send = useSendMedia(onCommand);
  const items: { key: MediaKey; label: string; icon: ReactNode }[] = [
    {
      key: 'volume_down',
      label: 'Diminuir volume',
      icon: <Volume1 color={COLORS.text} size={18} />,
    },
    { key: 'volume_mute', label: 'Mudo', icon: <VolumeX color={COLORS.text} size={18} /> },
    { key: 'previous', label: 'Faixa anterior', icon: <SkipBack color={COLORS.text} size={18} /> },
    {
      key: 'play_pause',
      label: 'Reproduzir ou pausar',
      icon: <Play color={COLORS.accent} fill={COLORS.accent} size={18} />,
    },
    { key: 'next', label: 'Próxima faixa', icon: <SkipForward color={COLORS.text} size={18} /> },
    { key: 'volume_up', label: 'Aumentar volume', icon: <Volume2 color={COLORS.text} size={18} /> },
  ];
  return (
    <View style={styles.bar}>
      {items.map((item) => (
        <Pressable
          key={item.key}
          accessibilityLabel={item.label}
          accessibilityRole="button"
          hitSlop={4}
          onPress={() => send(item.key)}
          style={({ pressed }) => [styles.barButton, pressed && styles.pillPressed]}
        >
          {item.icon}
        </Pressable>
      ))}
      <View style={styles.barDivider} />
      <Pressable
        accessibilityLabel="Abrir painel de mídia"
        accessibilityRole="button"
        hitSlop={4}
        onPress={onOpenPanel}
        style={({ pressed }) => [styles.barButton, pressed && styles.pillPressed]}
      >
        <Music2 color={COLORS.accent} size={18} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: 'rgba(2, 5, 25, 0.72)', flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderTopLeftRadius: RADIUS.large,
    borderTopRightRadius: RADIUS.large,
    borderWidth: 1,
    gap: SPACE.md,
    maxHeight: '90%',
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.sm,
    ...SHADOWS.card,
  },
  grabber: {
    alignSelf: 'center',
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.pill,
    height: 5,
    width: 44,
  },
  titleRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headingBlock: { gap: 4 },
  heading: { color: COLORS.text, fontSize: 20, fontWeight: '700' },
  eyebrow: { color: COLORS.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  card: {
    backgroundColor: COLORS.surfaceSubtle,
    borderColor: COLORS.border,
    borderRadius: RADIUS.medium + 4,
    borderWidth: 1,
    gap: SPACE.md,
    padding: SPACE.md,
  },
  transport: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACE.xl,
    justifyContent: 'center',
  },
  round: {
    alignItems: 'center',
    backgroundColor: COLORS.surfaceGlass,
    borderColor: COLORS.border,
    borderWidth: 1,
    justifyContent: 'center',
  },
  roundPrimary: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.secondary,
    ...SHADOWS.floating,
  },
  playPause: { flexDirection: 'row', gap: 0 },
  stop: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: SPACE.xs,
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xxs,
  },
  stopLabel: { color: COLORS.muted, fontSize: 13, fontWeight: '700' },
  volumeRow: { flexDirection: 'row', gap: SPACE.sm },
  pill: {
    alignItems: 'center',
    backgroundColor: COLORS.surfaceGlass,
    borderColor: COLORS.border,
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    flex: 1,
    gap: SPACE.xxs,
    justifyContent: 'center',
    minHeight: 72,
  },
  pillPressed: { backgroundColor: COLORS.highlight },
  pillLabel: { color: COLORS.text, fontSize: 12, fontWeight: '600' },
  toggleRow: { alignItems: 'center', flexDirection: 'row', gap: SPACE.sm },
  toggleText: { flex: 1, gap: 2 },
  toggleLabel: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
  toggleHint: { color: COLORS.muted, fontSize: 12, lineHeight: 16 },
  bar: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 2,
    paddingHorizontal: SPACE.xs,
    paddingVertical: SPACE.xxs,
    ...SHADOWS.floating,
  },
  barButton: {
    alignItems: 'center',
    borderRadius: RADIUS.pill,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  barDivider: { backgroundColor: COLORS.border, height: 22, marginHorizontal: 2, width: 1 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.96 }] },
});
