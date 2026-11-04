import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, RADIUS, SHADOWS, SPACE } from '../theme/tokens';
import {
  SENSITIVITY_MAX,
  SENSITIVITY_MIN,
  SENSITIVITY_STEP,
  normalizeSensitivity,
} from '../services/mouse/sensitivity';
import { buildShortcutCommand, type ShortcutOption } from '../services/keyboard/shortcuts';
import type { MouseCommand } from '../types/protocol';
import { VolumeKeysToggle } from './MediaControls';
import { ShortcutsList } from './ShortcutsControl';

type MoreSheetProps = {
  visible: boolean;
  onClose: () => void;
  onCommand: (command: MouseCommand) => void;
  sensitivity: number;
  onSensitivityChange: (value: number) => void;
  useVolumeKeys: boolean;
  onUseVolumeKeysChange: (value: boolean) => void;
};

function formatSensitivity(value: number): string {
  return `${normalizeSensitivity(value).toFixed(1).replace('.', ',')}×`;
}

/** Bottom sheet with cursor sensitivity, volume-key setting and keyboard shortcuts. */
export function MoreSheet({
  visible,
  onClose,
  onCommand,
  sensitivity,
  onSensitivityChange,
  useVolumeKeys,
  onUseVolumeKeysChange,
}: MoreSheetProps) {
  const insets = useSafeAreaInsets();

  const sendShortcut = (option: ShortcutOption) => {
    const command = buildShortcutCommand(option.modifiers, option.key);
    if (command) onCommand(command);
  };

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
            <Text style={styles.heading}>Mais opções</Text>
            <Pressable
              accessibilityLabel="Fechar"
              accessibilityRole="button"
              hitSlop={10}
              onPress={onClose}
            >
              <X color={COLORS.text} size={22} />
            </Pressable>
          </View>

          <View style={styles.section}>
            <View style={styles.sensitivityRow}>
              <Text style={styles.eyebrow}>SENSIBILIDADE DO CURSOR</Text>
              <Text style={styles.value}>{formatSensitivity(sensitivity)}</Text>
            </View>
            <Slider
              accessibilityLabel="Sensibilidade do cursor"
              maximumTrackTintColor={COLORS.border}
              maximumValue={SENSITIVITY_MAX}
              minimumTrackTintColor={COLORS.primary}
              minimumValue={SENSITIVITY_MIN}
              onValueChange={onSensitivityChange}
              step={SENSITIVITY_STEP}
              thumbTintColor={COLORS.accent}
              value={sensitivity}
            />
          </View>

          <VolumeKeysToggle onChange={onUseVolumeKeysChange} value={useVolumeKeys} />

          <Text style={styles.eyebrow}>ATALHOS</Text>
          <View style={styles.shortcuts}>
            <ShortcutsList onSelect={sendShortcut} />
          </View>
        </View>
      </View>
    </Modal>
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
    maxHeight: '85%',
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
  heading: { color: COLORS.text, fontSize: 20, fontWeight: '700' },
  section: { gap: SPACE.xs },
  sensitivityRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  eyebrow: { color: COLORS.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  value: { color: COLORS.accent, fontSize: 18, fontWeight: '800' },
  shortcuts: { flexShrink: 1 },
});
