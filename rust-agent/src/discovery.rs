//! mDNS / DNS-SD advertisement so the phone app finds this computer
//! automatically (`_remotemouse._tcp.local.`). Every failure here is reported
//! as a warning by the caller; the WebSocket server keeps running without it.

use std::{error::Error, time::Duration};

use mdns_sd::{ServiceDaemon, ServiceInfo};

pub const SERVICE_TYPE: &str = "_remotemouse._tcp.local.";
pub const PROTOCOL_VERSION: &str = "1";

/// Value of the `os` TXT record for the platform this binary was built for.
pub fn os_tag() -> &'static str {
    if cfg!(target_os = "macos") {
        "macos"
    } else if cfg!(target_os = "windows") {
        "windows"
    } else {
        "linux"
    }
}

/// Human readable computer name (used as the DNS-SD instance name and `name` TXT).
pub fn computer_name() -> String {
    let raw = hostname::get()
        .ok()
        .and_then(|name| name.into_string().ok())
        .unwrap_or_default();
    let trimmed = raw.trim().trim_end_matches(".local").trim_end_matches('.');
    if trimmed.is_empty() {
        "Computador".to_owned()
    } else {
        trimmed.chars().take(63).collect()
    }
}

/// Converts a computer name into a valid single DNS label for the `.local.` host name.
pub fn host_label(name: &str) -> String {
    let mut label: String = name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() {
                c.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect();
    while label.contains("--") {
        label = label.replace("--", "-");
    }
    let label = label.trim_matches('-');
    let label: String = label.chars().take(63).collect();
    if label.is_empty() {
        "remote-mouse".to_owned()
    } else {
        label
    }
}

pub fn txt_records(name: &str) -> Vec<(&'static str, String)> {
    vec![
        ("version", PROTOCOL_VERSION.to_owned()),
        ("os", os_tag().to_owned()),
        ("name", name.to_owned()),
    ]
}

/// A registered advertisement; call [`Advertisement::shutdown`] to send goodbye packets.
pub struct Advertisement {
    daemon: ServiceDaemon,
    fullname: String,
    pub instance_name: String,
}

impl Advertisement {
    pub fn start(port: u16) -> Result<Self, Box<dyn Error>> {
        let name = computer_name();
        let host = format!("{}.local.", host_label(&name));
        let daemon = ServiceDaemon::new()?;
        let info = ServiceInfo::new(
            SERVICE_TYPE,
            &name,
            &host,
            "",
            port,
            &txt_records(&name)[..],
        )?
        .enable_addr_auto();
        let fullname = info.get_fullname().to_owned();
        daemon.register(info)?;
        Ok(Self {
            daemon,
            fullname,
            instance_name: name,
        })
    }

    /// Unregisters the service (goodbye packets) and stops the mDNS daemon.
    pub fn shutdown(self) {
        if let Ok(receiver) = self.daemon.unregister(&self.fullname) {
            let _ = receiver.recv_timeout(Duration::from_secs(1));
        }
        if let Ok(receiver) = self.daemon.shutdown() {
            let _ = receiver.recv_timeout(Duration::from_secs(1));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn host_label_is_a_valid_dns_label() {
        assert_eq!(host_label("MacBook Pro de Carlos"), "macbook-pro-de-carlos");
        assert_eq!(host_label("DESKTOP_ABC.lan"), "desktop-abc-lan");
        assert_eq!(host_label("  çã  "), "remote-mouse");
        assert_eq!(host_label(&"a".repeat(80)).len(), 63);
    }

    #[test]
    fn txt_records_include_version_os_and_name() {
        let txt = txt_records("PC");
        assert_eq!(txt[0], ("version", "1".to_owned()));
        assert!(["macos", "windows", "linux"].contains(&txt[1].1.as_str()));
        assert_eq!(txt[2], ("name", "PC".to_owned()));
    }

    #[test]
    fn computer_name_is_never_empty() {
        assert!(!computer_name().is_empty());
    }

    #[test]
    fn service_info_builds_for_the_service_type() {
        let name = "Meu PC";
        let info = ServiceInfo::new(
            SERVICE_TYPE,
            name,
            "meu-pc.local.",
            "",
            8765,
            &txt_records(name)[..],
        )
        .unwrap();
        assert_eq!(info.get_fullname(), "Meu PC._remotemouse._tcp.local.");
        assert_eq!(info.get_property_val_str("os"), Some(os_tag()));
    }
}
