use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(tag = "type", deny_unknown_fields)]
pub enum MouseCommand {
    #[serde(rename = "mouse.move")]
    Move { version: u8, payload: Delta },
    #[serde(rename = "mouse.click")]
    Click { version: u8, payload: ClickPayload },
    #[serde(rename = "mouse.scroll")]
    Scroll { version: u8, payload: Delta },
    #[serde(rename = "keyboard.text")]
    KeyboardText {
        version: u8,
        payload: KeyboardTextPayload,
    },
    #[serde(rename = "keyboard.key")]
    KeyboardKey {
        version: u8,
        payload: KeyboardKeyPayload,
    },
    #[serde(rename = "keyboard.shortcut")]
    KeyboardShortcut {
        version: u8,
        payload: KeyboardShortcutPayload,
    },
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Delta {
    pub dx: f64,
    pub dy: f64,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ClickPayload {
    pub button: MouseButton,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct KeyboardTextPayload {
    pub text: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct KeyboardKeyPayload {
    pub key: KeyboardKey,
}

#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum KeyboardKey {
    Backspace,
    Enter,
}

pub const MAX_SHORTCUT_MODIFIERS: usize = 4;

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct KeyboardShortcutPayload {
    pub modifiers: Vec<ShortcutModifier>,
    pub key: ShortcutKey,
}

#[derive(Debug, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ShortcutModifier {
    Ctrl,
    Alt,
    Shift,
    Meta,
}

#[derive(Debug, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ShortcutKey {
    Tab,
    Escape,
    Enter,
    Space,
    Backspace,
    Delete,
    F4,
    F5,
    Left,
    Right,
    Up,
    Down,
    A,
    C,
    D,
    N,
    Q,
    R,
    S,
    T,
    V,
    W,
    X,
    Z,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MouseButton {
    Left,
    Right,
    Middle,
}

#[derive(Debug)]
pub enum ProtocolError {
    InvalidJson(serde_json::Error),
    UnsupportedVersion(u8),
    InvalidShortcut(&'static str),
}

impl std::fmt::Display for ProtocolError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidJson(error) => write!(formatter, "JSON inválido: {error}"),
            Self::UnsupportedVersion(version) => {
                write!(formatter, "versão de protocolo não suportada: {version}")
            }
            Self::InvalidShortcut(reason) => write!(formatter, "atalho inválido: {reason}"),
        }
    }
}

impl std::error::Error for ProtocolError {}

pub fn parse_command(json: &str) -> Result<MouseCommand, ProtocolError> {
    let command: MouseCommand = serde_json::from_str(json).map_err(ProtocolError::InvalidJson)?;
    let version = match &command {
        MouseCommand::Move { version, .. }
        | MouseCommand::Click { version, .. }
        | MouseCommand::Scroll { version, .. }
        | MouseCommand::KeyboardText { version, .. }
        | MouseCommand::KeyboardKey { version, .. }
        | MouseCommand::KeyboardShortcut { version, .. } => *version,
    };

    if version != 1 {
        return Err(ProtocolError::UnsupportedVersion(version));
    }

    if let MouseCommand::KeyboardShortcut { payload, .. } = &command {
        validate_shortcut(payload)?;
    }

    Ok(command)
}

fn validate_shortcut(payload: &KeyboardShortcutPayload) -> Result<(), ProtocolError> {
    if payload.modifiers.len() > MAX_SHORTCUT_MODIFIERS {
        return Err(ProtocolError::InvalidShortcut("modificadores demais"));
    }
    for (index, modifier) in payload.modifiers.iter().enumerate() {
        if payload.modifiers[..index].contains(modifier) {
            return Err(ProtocolError::InvalidShortcut("modificador repetido"));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        KeyboardKey, MouseCommand, ProtocolError, ShortcutKey, ShortcutModifier, parse_command,
    };

    #[test]
    fn parses_alt_tab_and_alt_f4_shortcuts() {
        let alt_tab = parse_command(
            r#"{"version":1,"type":"keyboard.shortcut","payload":{"modifiers":["alt"],"key":"tab"}}"#,
        )
        .unwrap();
        assert!(
            matches!(alt_tab, MouseCommand::KeyboardShortcut { payload, .. }
            if payload.modifiers == [ShortcutModifier::Alt] && payload.key == ShortcutKey::Tab)
        );

        let alt_f4 = parse_command(
            r#"{"version":1,"type":"keyboard.shortcut","payload":{"modifiers":["alt"],"key":"f4"}}"#,
        )
        .unwrap();
        assert!(
            matches!(alt_f4, MouseCommand::KeyboardShortcut { payload, .. } if payload.key == ShortcutKey::F4)
        );

        let esc = parse_command(
            r#"{"version":1,"type":"keyboard.shortcut","payload":{"modifiers":[],"key":"escape"}}"#,
        )
        .unwrap();
        assert!(
            matches!(esc, MouseCommand::KeyboardShortcut { payload, .. } if payload.modifiers.is_empty())
        );
    }

    #[test]
    fn rejects_invalid_shortcuts() {
        for json in [
            r#"{"version":1,"type":"keyboard.shortcut","payload":{"modifiers":["alt","alt"],"key":"tab"}}"#,
            r#"{"version":1,"type":"keyboard.shortcut","payload":{"modifiers":["hyper"],"key":"tab"}}"#,
            r#"{"version":1,"type":"keyboard.shortcut","payload":{"modifiers":["ctrl"],"key":"f13"}}"#,
            r#"{"version":1,"type":"keyboard.shortcut","payload":{"modifiers":["ctrl"],"key":"c","extra":1}}"#,
            r#"{"version":1,"type":"keyboard.shortcut","payload":{"key":"c"}}"#,
        ] {
            assert!(parse_command(json).is_err(), "{json}");
        }
        assert!(matches!(
            parse_command(
                r#"{"version":1,"type":"keyboard.shortcut","payload":{"modifiers":["ctrl","ctrl"],"key":"c"}}"#
            ),
            Err(ProtocolError::InvalidShortcut(_))
        ));
    }

    #[test]
    fn unknown_command_is_an_error_not_a_panic() {
        assert!(matches!(
            parse_command(r#"{"version":1,"type":"future.thing","payload":{}}"#),
            Err(ProtocolError::InvalidJson(_))
        ));
    }

    #[test]
    fn parses_unicode_keyboard_text() {
        let command =
            parse_command(r#"{"version":1,"type":"keyboard.text","payload":{"text":"Olá 👋"}}"#)
                .unwrap();

        assert!(
            matches!(command, MouseCommand::KeyboardText { payload, .. } if payload.text == "Olá 👋")
        );
    }

    #[test]
    fn parses_backspace_and_enter_keys() {
        let backspace =
            parse_command(r#"{"version":1,"type":"keyboard.key","payload":{"key":"backspace"}}"#)
                .unwrap();
        let enter =
            parse_command(r#"{"version":1,"type":"keyboard.key","payload":{"key":"enter"}}"#)
                .unwrap();

        assert!(
            matches!(backspace, MouseCommand::KeyboardKey { payload, .. } if payload.key == KeyboardKey::Backspace)
        );
        assert!(
            matches!(enter, MouseCommand::KeyboardKey { payload, .. } if payload.key == KeyboardKey::Enter)
        );
    }
}
