import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Command, X } from 'lucide-react-native';

import { COLORS, RADIUS, SHADOWS, SPACE } from '../theme/tokens';
import {
  SHORTCUT_GROUPS,
  buildShortcutCommand,
  type ShortcutOption,
} from '../services/keyboard/shortcuts';
import type { MouseCommand } from '../types/protocol';

type ShortcutsControlProps = { onCommand: (command: MouseCommand) => void };

export function ShortcutsControl({ onCommand }: ShortcutsControlProps) {
  const [isOpen, setIsOpen] = useState(false);

  const sendShortcut = (option: ShortcutOption) => {
    const command = buildShortcutCommand(option.modifiers, option.key);
    if (command) onCommand(command);
    setIsOpen(false);
  };

  return (
    <>
      <View pointerEvents="box-none" style={styles.anchor}>
        <Pressable
          accessibilityLabel="Abrir atalhos de teclado"
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
          onPress={() => setIsOpen(true)}
          style={styles.button}
        >
          <Command color={COLORS.text} size={18} />
          <Text style={styles.buttonLabel}>ATALHOS</Text>
        </Pressable>
      </View>
      <Modal
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
        statusBarTranslucent
        transparent
        visible={isOpen}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Fechar atalhos"
            onPress={() => setIsOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View accessibilityViewIsModal style={styles.panel}>
            <View style={styles.titleRow}>
              <View style={styles.headingBlock}>
                <Text style={styles.eyebrow}>ENVIAR AO COMPUTADOR</Text>
                <Text style={styles.heading}>Atalhos</Text>
              </View>
              <Pressable
                accessibilityLabel="Fechar atalhos"
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => setIsOpen(false)}
              >
                <X color={COLORS.text} size={20} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.list}>
              {SHORTCUT_GROUPS.map((group) => (
                <View key={group.title} style={styles.group}>
                  <Text style={styles.groupTitle}>{group.title}</Text>
                  {group.options.map((option) => (
                    <Pressable
                      key={option.id}
                      accessibilityLabel={`${option.label}: ${option.description}`}
                      accessibilityRole="button"
                      onPress={() => sendShortcut(option)}
                      style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                    >
                      <Text style={styles.optionLabel}>{option.label}</Text>
                      <Text style={styles.optionDescription}>{option.description}</Text>
                    </Pressable>
                  ))}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  anchor: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: SPACE.md + 14,
    zIndex: 2,
  },
  button: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: RADIUS.large,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SPACE.xs,
    height: 48,
    justifyContent: 'center',
    minWidth: 112,
    paddingHorizontal: 13,
    ...SHADOWS.floating,
  },
  buttonLabel: { color: COLORS.text, fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  modalRoot: {
    alignItems: 'center',
    backgroundColor: 'rgba(23, 43, 54, 0.38)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  panel: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: RADIUS.large,
    borderWidth: 1,
    gap: SPACE.md,
    maxHeight: '80%',
    maxWidth: 420,
    padding: 22,
    width: '100%',
    ...SHADOWS.card,
  },
  titleRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headingBlock: { gap: 6 },
  eyebrow: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  heading: { color: COLORS.text, fontSize: 20, fontWeight: '700' },
  list: { gap: SPACE.md },
  group: { gap: SPACE.xs },
  groupTitle: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  option: {
    alignItems: 'center',
    borderColor: COLORS.border,
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 46,
    paddingHorizontal: SPACE.sm,
  },
  optionPressed: { backgroundColor: COLORS.highlight },
  optionLabel: { color: COLORS.text, fontSize: 14, fontWeight: '800' },
  optionDescription: { color: COLORS.muted, fontSize: 12 },
});
