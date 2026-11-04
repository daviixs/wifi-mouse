use std::time::{Duration, Instant};

use crate::protocol::MouseCommand;

const REPORT_INTERVAL: Duration = Duration::from_secs(5);

#[derive(Clone, Copy)]
pub struct CommandMetrics {
    kind: CommandKind,
    dx: f64,
    dy: f64,
}

#[derive(Clone, Copy)]
enum CommandKind {
    Move,
    Click,
    Scroll,
    KeyboardText,
    KeyboardKey,
    KeyboardShortcut,
    MediaKey,
}

impl CommandMetrics {
    pub fn from_command(command: &MouseCommand) -> Self {
        match command {
            MouseCommand::Move { payload, .. } => Self {
                kind: CommandKind::Move,
                dx: payload.dx,
                dy: payload.dy,
            },
            MouseCommand::Click { .. } => Self {
                kind: CommandKind::Click,
                dx: 0.0,
                dy: 0.0,
            },
            MouseCommand::Scroll { payload, .. } => Self {
                kind: CommandKind::Scroll,
                dx: payload.dx,
                dy: payload.dy,
            },
            MouseCommand::KeyboardText { .. } => Self {
                kind: CommandKind::KeyboardText,
                dx: 0.0,
                dy: 0.0,
            },
            MouseCommand::KeyboardKey { .. } => Self {
                kind: CommandKind::KeyboardKey,
                dx: 0.0,
                dy: 0.0,
            },
            MouseCommand::KeyboardShortcut { .. } => Self {
                kind: CommandKind::KeyboardShortcut,
                dx: 0.0,
                dy: 0.0,
            },
            MouseCommand::MediaKey { .. } => Self {
                kind: CommandKind::MediaKey,
                dx: 0.0,
                dy: 0.0,
            },
        }
    }
}

#[derive(Default)]
struct Window {
    commands: u64,
    moves: u64,
    move_dx: f64,
    move_dy: f64,
    clicks: u64,
    scrolls: u64,
    scroll_dx: f64,
    scroll_dy: f64,
    keyboard_texts: u64,
    keyboard_keys: u64,
    apply_errors: u64,
    last_error: Option<String>,
    receive_to_apply: Duration,
    max_receive_to_apply: Duration,
    apply_time: Duration,
    max_apply_time: Duration,
}

pub struct AgentDiagnostics {
    started_at: Instant,
    window: Window,
}

impl Default for AgentDiagnostics {
    fn default() -> Self {
        let now = Instant::now();
        Self {
            started_at: now,
            window: Window::default(),
        }
    }
}

impl AgentDiagnostics {
    pub fn record(
        &mut self,
        command: CommandMetrics,
        receive_to_apply: Duration,
        apply_time: Duration,
        error: Option<String>,
    ) {
        self.window.commands += 1;
        self.window.receive_to_apply += receive_to_apply;
        self.window.max_receive_to_apply = self.window.max_receive_to_apply.max(receive_to_apply);
        self.window.apply_time += apply_time;
        self.window.max_apply_time = self.window.max_apply_time.max(apply_time);

        match command.kind {
            CommandKind::Move => {
                self.window.moves += 1;
                self.window.move_dx += command.dx;
                self.window.move_dy += command.dy;
            }
            CommandKind::Click => self.window.clicks += 1,
            CommandKind::Scroll => {
                self.window.scrolls += 1;
                self.window.scroll_dx += command.dx;
                self.window.scroll_dy += command.dy;
            }
            CommandKind::KeyboardText => self.window.keyboard_texts += 1,
            CommandKind::KeyboardKey | CommandKind::KeyboardShortcut | CommandKind::MediaKey => {
                self.window.keyboard_keys += 1
            }
        }

        if let Some(error) = error {
            self.window.apply_errors += 1;
            self.window.last_error = Some(error);
        }
    }

    pub fn report_if_due(&mut self) -> Option<String> {
        if self.started_at.elapsed() < REPORT_INTERVAL {
            return None;
        }

        Some(self.take_report())
    }

    pub fn take_report(&mut self) -> String {
        let window_ms = self.started_at.elapsed().as_millis();
        let window = std::mem::take(&mut self.window);
        self.started_at = Instant::now();
        let avg_apply_us = if window.commands == 0 {
            0
        } else {
            window.apply_time.as_micros() / u128::from(window.commands)
        };
        let avg_receive_to_apply_us = if window.commands == 0 {
            0
        } else {
            window.receive_to_apply.as_micros() / u128::from(window.commands)
        };

        format!(
            "[RemoteMouse][diag][agent] window_ms={window_ms} commands={} moves={} move_dx={:.2} move_dy={:.2} clicks={} scrolls={} scroll_dx={:.2} scroll_dy={:.2} keyboard_texts={} keyboard_keys={} receive_to_apply_avg_us={avg_receive_to_apply_us} receive_to_apply_max_us={} apply_avg_us={avg_apply_us} apply_max_us={} apply_errors={} last_error={}",
            window.commands,
            window.moves,
            window.move_dx,
            window.move_dy,
            window.clicks,
            window.scrolls,
            window.scroll_dx,
            window.scroll_dy,
            window.keyboard_texts,
            window.keyboard_keys,
            window.max_receive_to_apply.as_micros(),
            window.max_apply_time.as_micros(),
            window.apply_errors,
            window.last_error.as_deref().unwrap_or("none"),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::{AgentDiagnostics, CommandMetrics};
    use crate::protocol::{
        ClickPayload, Delta, KeyboardKey, KeyboardKeyPayload, KeyboardTextPayload, MouseButton,
        MouseCommand,
    };
    use std::time::Duration;

    #[test]
    fn reports_aggregated_commands_deltas_and_apply_errors() {
        let mut diagnostics = AgentDiagnostics::default();
        diagnostics.record(
            CommandMetrics::from_command(&MouseCommand::Move {
                version: 1,
                payload: Delta { dx: 1.5, dy: -2.0 },
            }),
            Duration::from_micros(120),
            Duration::from_micros(100),
            None,
        );
        diagnostics.record(
            CommandMetrics::from_command(&MouseCommand::Click {
                version: 1,
                payload: ClickPayload {
                    button: MouseButton::Left,
                },
            }),
            Duration::from_micros(280),
            Duration::from_micros(300),
            Some("synthetic error".to_owned()),
        );
        diagnostics.record(
            CommandMetrics::from_command(&MouseCommand::KeyboardText {
                version: 1,
                payload: KeyboardTextPayload {
                    text: "Olá".to_owned(),
                },
            }),
            Duration::from_micros(100),
            Duration::from_micros(80),
            None,
        );
        diagnostics.record(
            CommandMetrics::from_command(&MouseCommand::KeyboardKey {
                version: 1,
                payload: KeyboardKeyPayload {
                    key: KeyboardKey::Enter,
                },
            }),
            Duration::from_micros(100),
            Duration::from_micros(80),
            None,
        );

        let report = diagnostics.take_report();
        assert!(report.contains("commands=4 moves=1 move_dx=1.50 move_dy=-2.00 clicks=1"));
        assert!(report.contains("keyboard_texts=1 keyboard_keys=1"));
        assert!(report.contains("apply_avg_us=140"));
        assert!(report.contains("receive_to_apply_avg_us=150 receive_to_apply_max_us=280"));
        assert!(report.contains("apply_max_us=300 apply_errors=1 last_error=synthetic error"));
    }
}
