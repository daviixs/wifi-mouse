export type MouseMoveCommand = {
  version: 1;
  type: 'mouse.move';
  payload: { dx: number; dy: number };
};

export type MouseClickCommand = {
  version: 1;
  type: 'mouse.click';
  payload: { button: 'left' | 'right' | 'middle' };
};

export type MouseScrollCommand = {
  version: 1;
  type: 'mouse.scroll';
  payload: { dx: number; dy: number };
};

export type KeyboardTextCommand = {
  version: 1;
  type: 'keyboard.text';
  payload: { text: string };
};

export type KeyboardKey = 'backspace' | 'enter';

export type KeyboardKeyCommand = {
  version: 1;
  type: 'keyboard.key';
  payload: { key: KeyboardKey };
};

export const SHORTCUT_MODIFIERS = ['ctrl', 'alt', 'shift', 'meta'] as const;
export type ShortcutModifier = (typeof SHORTCUT_MODIFIERS)[number];

export const SHORTCUT_KEYS = [
  'tab',
  'escape',
  'enter',
  'space',
  'backspace',
  'delete',
  'f4',
  'f5',
  'left',
  'right',
  'up',
  'down',
  'a',
  'c',
  'd',
  'n',
  'q',
  'r',
  's',
  't',
  'v',
  'w',
  'x',
  'z',
] as const;
export type ShortcutKey = (typeof SHORTCUT_KEYS)[number];

export type KeyboardShortcutCommand = {
  version: 1;
  type: 'keyboard.shortcut';
  payload: { modifiers: ShortcutModifier[]; key: ShortcutKey };
};

export type MouseCommand =
  | MouseMoveCommand
  | MouseClickCommand
  | MouseScrollCommand
  | KeyboardTextCommand
  | KeyboardKeyCommand
  | KeyboardShortcutCommand;
