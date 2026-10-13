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
        | MouseCommand::Scroll { version, .. } => *version,
    };

    if version != 1 {
        return Err(ProtocolError::UnsupportedVersion(version));
    }

    Ok(command)
}
