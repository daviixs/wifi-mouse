use enigo::{Axis, Button, Coordinate, Direction, Enigo, InputResult, Mouse};

use crate::protocol::{MouseButton, MouseCommand};

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
        }
    }
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
