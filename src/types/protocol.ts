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

export type MouseCommand = MouseMoveCommand | MouseClickCommand | MouseScrollCommand;
