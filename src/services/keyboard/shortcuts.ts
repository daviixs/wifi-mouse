import {
  SHORTCUT_KEYS,
  SHORTCUT_MODIFIERS,
  type KeyboardShortcutCommand,
  type ShortcutKey,
  type ShortcutModifier,
} from '../../types/protocol';

export const MAX_SHORTCUT_MODIFIERS = 4;

export type ShortcutOption = {
  id: string;
  label: string;
  description: string;
  modifiers: ShortcutModifier[];
  key: ShortcutKey;
};

export type ShortcutGroup = { title: string; options: ShortcutOption[] };

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'WINDOWS / LINUX',
    options: [
      {
        id: 'alt-tab',
        label: 'Alt + Tab',
        description: 'Alternar janelas',
        modifiers: ['alt'],
        key: 'tab',
      },
      {
        id: 'alt-f4',
        label: 'Alt + F4',
        description: 'Fechar janela',
        modifiers: ['alt'],
        key: 'f4',
      },
      {
        id: 'win-d',
        label: 'Win + D',
        description: 'Mostrar área de trabalho',
        modifiers: ['meta'],
        key: 'd',
      },
      { id: 'ctrl-c', label: 'Ctrl + C', description: 'Copiar', modifiers: ['ctrl'], key: 'c' },
      { id: 'ctrl-v', label: 'Ctrl + V', description: 'Colar', modifiers: ['ctrl'], key: 'v' },
      { id: 'ctrl-z', label: 'Ctrl + Z', description: 'Desfazer', modifiers: ['ctrl'], key: 'z' },
      { id: 'ctrl-w', label: 'Ctrl + W', description: 'Fechar aba', modifiers: ['ctrl'], key: 'w' },
    ],
  },
  {
    title: 'MAC',
    options: [
      {
        id: 'cmd-tab',
        label: 'Cmd + Tab',
        description: 'Alternar apps',
        modifiers: ['meta'],
        key: 'tab',
      },
      { id: 'cmd-q', label: 'Cmd + Q', description: 'Encerrar app', modifiers: ['meta'], key: 'q' },
      {
        id: 'cmd-w',
        label: 'Cmd + W',
        description: 'Fechar janela',
        modifiers: ['meta'],
        key: 'w',
      },
      { id: 'cmd-c', label: 'Cmd + C', description: 'Copiar', modifiers: ['meta'], key: 'c' },
      { id: 'cmd-v', label: 'Cmd + V', description: 'Colar', modifiers: ['meta'], key: 'v' },
      { id: 'cmd-z', label: 'Cmd + Z', description: 'Desfazer', modifiers: ['meta'], key: 'z' },
    ],
  },
  {
    title: 'GERAL',
    options: [
      { id: 'esc', label: 'Esc', description: 'Cancelar / sair', modifiers: [], key: 'escape' },
      { id: 'f5', label: 'F5', description: 'Atualizar / apresentar', modifiers: [], key: 'f5' },
    ],
  },
];

export function isValidShortcut(modifiers: readonly string[], key: string): boolean {
  if (modifiers.length > MAX_SHORTCUT_MODIFIERS) return false;
  if (new Set(modifiers).size !== modifiers.length) return false;
  if (!modifiers.every((m) => (SHORTCUT_MODIFIERS as readonly string[]).includes(m))) return false;
  return (SHORTCUT_KEYS as readonly string[]).includes(key);
}

export function buildShortcutCommand(
  modifiers: readonly ShortcutModifier[],
  key: ShortcutKey,
): KeyboardShortcutCommand | null {
  if (!isValidShortcut(modifiers, key)) return null;
  return { version: 1, type: 'keyboard.shortcut', payload: { modifiers: [...modifiers], key } };
}
