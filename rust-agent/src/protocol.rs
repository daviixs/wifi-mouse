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
}

impl std::fmt::Display for ProtocolError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidJson(error) => write!(formatter, "JSON inválido: {error}"),
            Self::UnsupportedVersion(version) => {
                write!(formatter, "versão de protocolo não suportada: {version}")
            }
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
        | MouseCommand::KeyboardKey { version, .. } => *version,
    };

    if version != 1 {
        return Err(ProtocolError::UnsupportedVersion(version));
    }

    Ok(command)
}

#[cfg(test)]
mod tests {
    use super::{KeyboardKey, MouseCommand, parse_command};

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
