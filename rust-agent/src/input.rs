use enigo::{Axis, Button, Coordinate, Direction, Enigo, InputResult, Key, Keyboard, Mouse};

use crate::protocol::{
    KeyboardKey, KeyboardShortcutPayload, MouseButton, MouseCommand, ShortcutKey, ShortcutModifier,
};

const MAX_DELTA: f64 = 4096.0;
#[cfg(target_os = "windows")]
const WINDOWS_PIXELS_PER_SCROLL_STEP: f64 = 24.0;

#[cfg(target_os = "windows")]
pub struct ScrollRemainder {
    horizontal: f64,
    vertical: f64,
}

#[cfg(target_os = "windows")]
impl Default for ScrollRemainder {
    fn default() -> Self {
        Self {
            horizontal: 0.0,
            vertical: 0.0,
        }
    }
}

pub struct MouseController {
    mouse: Enigo,
    #[cfg(target_os = "windows")]
    scroll_remainder: ScrollRemainder,
}

impl MouseController {
    pub fn new(mouse: Enigo) -> Self {
        Self {
            mouse,
            #[cfg(target_os = "windows")]
            scroll_remainder: ScrollRemainder::default(),
        }
    }

    pub fn apply(&mut self, command: MouseCommand) -> InputResult<()> {
        match command {
            MouseCommand::Move { payload, .. } => {
                self.mouse
                    .move_mouse(to_delta(payload.dx), to_delta(payload.dy), Coordinate::Rel)
            }
            MouseCommand::Click { payload, .. } => {
                let button = match payload.button {
                    MouseButton::Left => Button::Left,
                    MouseButton::Right => Button::Right,
                    MouseButton::Middle => Button::Middle,
                };
                self.mouse.button(button, Direction::Click)
            }
            MouseCommand::Scroll { payload, .. } => {
                let dx = to_bounded(payload.dx);
                let dy = to_bounded(payload.dy);
                #[cfg(target_os = "macos")]
                {
                    scroll(&mut self.mouse, dx, dy)
                }
                #[cfg(target_os = "windows")]
                {
                    scroll(&mut self.mouse, &mut self.scroll_remainder, dx, dy)
                }
            }
            MouseCommand::KeyboardText { payload, .. } => {
                apply_keyboard_text(&mut self.mouse, &payload.text)
            }
            MouseCommand::KeyboardKey { payload, .. } => {
                apply_keyboard_key(&mut self.mouse, payload.key)
            }
            MouseCommand::KeyboardShortcut { payload, .. } => {
                apply_keyboard_shortcut(&mut self.mouse, &payload)
            }
        }
    }
}

fn apply_keyboard_text(keyboard: &mut impl Keyboard, text: &str) -> InputResult<()> {
    keyboard.text(text)
}

fn apply_keyboard_key(keyboard: &mut impl Keyboard, key: KeyboardKey) -> InputResult<()> {
    let key = match key {
        KeyboardKey::Backspace => Key::Backspace,
        KeyboardKey::Enter => Key::Return,
    };
    keyboard.key(key, Direction::Click)
}

fn modifier_key(modifier: ShortcutModifier) -> Key {
    match modifier {
        ShortcutModifier::Ctrl => Key::Control,
        ShortcutModifier::Alt => Key::Alt,
        ShortcutModifier::Shift => Key::Shift,
        ShortcutModifier::Meta => Key::Meta,
    }
}

fn shortcut_key(key: ShortcutKey) -> Key {
    match key {
        ShortcutKey::Tab => Key::Tab,
        ShortcutKey::Escape => Key::Escape,
        ShortcutKey::Enter => Key::Return,
        ShortcutKey::Space => Key::Space,
        ShortcutKey::Backspace => Key::Backspace,
        ShortcutKey::Delete => Key::Delete,
        ShortcutKey::F4 => Key::F4,
        ShortcutKey::F5 => Key::F5,
        ShortcutKey::Left => Key::LeftArrow,
        ShortcutKey::Right => Key::RightArrow,
        ShortcutKey::Up => Key::UpArrow,
        ShortcutKey::Down => Key::DownArrow,
        ShortcutKey::A => Key::Unicode('a'),
        ShortcutKey::C => Key::Unicode('c'),
        ShortcutKey::D => Key::Unicode('d'),
        ShortcutKey::N => Key::Unicode('n'),
        ShortcutKey::Q => Key::Unicode('q'),
        ShortcutKey::R => Key::Unicode('r'),
        ShortcutKey::S => Key::Unicode('s'),
        ShortcutKey::T => Key::Unicode('t'),
        ShortcutKey::V => Key::Unicode('v'),
        ShortcutKey::W => Key::Unicode('w'),
        ShortcutKey::X => Key::Unicode('x'),
        ShortcutKey::Z => Key::Unicode('z'),
    }
}

/// Presses the modifiers in order, clicks the key and releases every pressed
/// modifier in reverse order, even if an earlier step failed.
fn apply_keyboard_shortcut(
    keyboard: &mut impl Keyboard,
    shortcut: &KeyboardShortcutPayload,
) -> InputResult<()> {
    let mut pressed = Vec::with_capacity(shortcut.modifiers.len());
    let mut result = Ok(());
    for modifier in &shortcut.modifiers {
        let key = modifier_key(*modifier);
        if let Err(error) = keyboard.key(key, Direction::Press) {
            result = Err(error);
            break;
        }
        pressed.push(key);
    }
    if result.is_ok() {
        result = keyboard.key(shortcut_key(shortcut.key), Direction::Click);
    }
    for key in pressed.into_iter().rev() {
        let released = keyboard.key(key, Direction::Release);
        if result.is_ok() {
            result = released;
        }
    }
    result
}

fn to_delta(value: f64) -> i32 {
    to_bounded(value).round() as i32
}

fn to_bounded(value: f64) -> f64 {
    value.clamp(-MAX_DELTA, MAX_DELTA)
}

#[cfg(target_os = "macos")]
fn scroll(mouse: &mut Enigo, dx: f64, dy: f64) -> InputResult<()> {
    if dx != 0.0 {
        mouse.smooth_scroll(dx.round() as i32, Axis::Horizontal)?;
    }
    if dy != 0.0 {
        mouse.smooth_scroll(dy.round() as i32, Axis::Vertical)?;
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn scroll(mouse: &mut Enigo, remainder: &mut ScrollRemainder, dx: f64, dy: f64) -> InputResult<()> {
    remainder.horizontal += dx;
    remainder.vertical += dy;
    let horizontal_steps = (remainder.horizontal / WINDOWS_PIXELS_PER_SCROLL_STEP).trunc() as i32;
    let vertical_steps = (remainder.vertical / WINDOWS_PIXELS_PER_SCROLL_STEP).trunc() as i32;
    remainder.horizontal -= f64::from(horizontal_steps) * WINDOWS_PIXELS_PER_SCROLL_STEP;
    remainder.vertical -= f64::from(vertical_steps) * WINDOWS_PIXELS_PER_SCROLL_STEP;

    if horizontal_steps != 0 {
        mouse.scroll(horizontal_steps, Axis::Horizontal)?;
    }
    if vertical_steps != 0 {
        mouse.scroll(vertical_steps, Axis::Vertical)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use enigo::{Direction, InputError, InputResult, Key, Keyboard};

    use super::{apply_keyboard_key, apply_keyboard_shortcut, apply_keyboard_text};
    use crate::protocol::{KeyboardKey, KeyboardShortcutPayload, ShortcutKey, ShortcutModifier};

    #[derive(Default)]
    struct RecordingKeyboard {
        text: Vec<String>,
        keys: Vec<Key>,
        events: Vec<(Key, Direction)>,
        fail_on: Option<Key>,
    }

    impl Keyboard for RecordingKeyboard {
        fn key(&mut self, key: Key, direction: Direction) -> InputResult<()> {
            self.events.push((key, direction));
            if self.fail_on == Some(key) {
                return Err(InputError::Simulate("falha simulada"));
            }
            self.keys.push(key);
            Ok(())
        }

        fn raw(&mut self, _keycode: u16, _direction: Direction) -> InputResult<()> {
            Ok(())
        }

        fn fast_text(&mut self, text: &str) -> Result<Option<()>, InputError> {
            self.text.push(text.to_owned());
            Ok(Some(()))
        }
    }

    #[test]
    fn applies_unicode_text_and_special_keys_to_keyboard() {
        let mut keyboard = RecordingKeyboard::default();
        apply_keyboard_text(&mut keyboard, "Olá 👋").unwrap();
        apply_keyboard_key(&mut keyboard, KeyboardKey::Backspace).unwrap();
        apply_keyboard_key(&mut keyboard, KeyboardKey::Enter).unwrap();

        assert_eq!(keyboard.text, ["Olá 👋"]);
        assert_eq!(keyboard.keys, [Key::Backspace, Key::Return]);
    }

    #[test]
    fn shortcut_presses_modifiers_and_releases_in_reverse() {
        let mut keyboard = RecordingKeyboard::default();
        let shortcut = KeyboardShortcutPayload {
            modifiers: vec![ShortcutModifier::Ctrl, ShortcutModifier::Shift],
            key: ShortcutKey::Tab,
        };
        apply_keyboard_shortcut(&mut keyboard, &shortcut).unwrap();
        assert_eq!(
            keyboard.events,
            [
                (Key::Control, Direction::Press),
                (Key::Shift, Direction::Press),
                (Key::Tab, Direction::Click),
                (Key::Shift, Direction::Release),
                (Key::Control, Direction::Release),
            ]
        );
    }

    #[test]
    fn shortcut_releases_modifiers_when_key_fails() {
        let mut keyboard = RecordingKeyboard {
            fail_on: Some(Key::F4),
            ..Default::default()
        };
        let shortcut = KeyboardShortcutPayload {
            modifiers: vec![ShortcutModifier::Alt],
            key: ShortcutKey::F4,
        };
        assert!(apply_keyboard_shortcut(&mut keyboard, &shortcut).is_err());
        assert_eq!(
            keyboard.events.last(),
            Some(&(Key::Alt, Direction::Release))
        );
    }
}
