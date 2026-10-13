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

export type MouseCommand =
  | MouseMoveCommand
  | MouseClickCommand
  | MouseScrollCommand
  | KeyboardTextCommand
  | KeyboardKeyCommand;
