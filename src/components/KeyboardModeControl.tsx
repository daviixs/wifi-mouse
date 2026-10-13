import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Keyboard as KeyboardIcon, X } from 'lucide-react-native';

import { COLORS, RADIUS, SPACE } from '../theme/tokens';
import { diffKeyboardText, splitKeyboardText } from '../services/keyboard/textDiff';
import type { MouseCommand } from '../types/protocol';

type KeyboardModeControlProps = { onCommand: (command: MouseCommand) => void };

export function KeyboardModeControl({ onCommand }: KeyboardModeControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);
  const previousText = useRef('');

  useEffect(() => {
    if (isOpen) {
      const frame = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(frame);
    }
  }, [isOpen]);

  const closeKeyboard = useCallback(() => setIsOpen(false), []);
  const toggleKeyboard = useCallback(() => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    setText('');
    previousText.current = '';
    setIsOpen(true);
  }, [isOpen]);

  const handleTextChange = useCallback(
    (nextText: string) => {
      const edit = diffKeyboardText(previousText.current, nextText);
      for (let index = 0; index < edit.backspaces; index += 1) {
        onCommand({ version: 1, type: 'keyboard.key', payload: { key: 'backspace' } });
      }
      splitKeyboardText(edit.insertedText).forEach((chunk) => {
        onCommand({ version: 1, type: 'keyboard.text', payload: { text: chunk } });
      });
      previousText.current = nextText;
      setText(nextText);
    },
    [onCommand],
  );

  const handleSubmit = useCallback(() => {
    onCommand({ version: 1, type: 'keyboard.key', payload: { key: 'enter' } });
  }, [onCommand]);

  return (
    <>
      {isOpen && (
        <View style={styles.inputWrap}>
          <TextInput
            ref={inputRef}
            accessibilityLabel="Texto enviado ao computador"
            autoCorrect={false}
            autoCapitalize="none"
            enterKeyHint="enter"
            keyboardAppearance="dark"
            onBlur={closeKeyboard}
            onChangeText={handleTextChange}
            onSubmitEditing={handleSubmit}
            placeholder="Digite no computador"
            placeholderTextColor={COLORS.muted}
            selectionColor={COLORS.accent}
            submitBehavior="submit"
            style={styles.input}
            value={text}
          />
        </View>
      )}
      <Pressable
        accessibilityLabel={isOpen ? 'Fechar teclado' : 'Abrir teclado'}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        onPress={toggleKeyboard}
        style={[styles.button, isOpen && styles.activeButton]}
      >
        {isOpen ? (
          <X color={COLORS.text} size={19} />
        ) : (
          <KeyboardIcon color={COLORS.text} size={19} />
        )}
        <Text style={styles.buttonLabel}>{isOpen ? 'FECHAR' : 'TECLADO'}</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  inputWrap: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    left: 14,
    paddingHorizontal: SPACE.sm,
    position: 'absolute',
    right: 14,
    top: 14,
    zIndex: 3,
  },
  input: { color: COLORS.text, fontSize: 15, height: 48 },
  button: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: RADIUS.large,
    borderWidth: 1,
    bottom: 14,
    flexDirection: 'row',
    gap: SPACE.xs,
    height: 48,
    justifyContent: 'center',
    minWidth: 112,
    paddingHorizontal: 13,
    position: 'absolute',
    right: 14,
    zIndex: 3,
  },
  activeButton: { backgroundColor: COLORS.highlight, borderColor: COLORS.border },
  buttonLabel: { color: COLORS.text, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
});
