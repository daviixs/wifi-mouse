//! Platform-independent state machine of the tray app (mirrors the macOS
//! `AgentController`), kept free of Win32 so it is unit-tested on any host.

use std::net::Ipv4Addr;

use crate::l10n::{Strings, fill};

pub const DEFAULT_PORT: u16 = 8765;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Phase {
    Stopped,
    Starting,
    Running,
    Stopping,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Failure {
    PortInUse,
    PortDenied,
    Other(String),
}

/// Messages from the in-process server thread, in delivery order.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AgentMessage {
    Bound,
    Ready {
        port: u16,
        addresses: Vec<Ipv4Addr>,
        name: String,
        mdns: bool,
    },
    Client(bool),
    /// Always the last message of a server thread. `None` means a clean exit.
    Stopped(Option<Failure>),
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum Detail {
    Idle,
    Starting,
    Ready,
    Stopped,
    Failed(Failure),
    Exited,
}

#[derive(Debug, Clone)]
pub struct State {
    pub phase: Phase,
    pub client_connected: bool,
    pub addresses: Vec<Ipv4Addr>,
    pub port: u16,
    pub computer_name: Option<String>,
    pub mdns: bool,
    pub copied: bool,
    detail: Detail,
}

impl Default for State {
    fn default() -> Self {
        Self {
            phase: Phase::Stopped,
            client_connected: false,
            addresses: Vec::new(),
            port: DEFAULT_PORT,
            computer_name: None,
            mdns: false,
            copied: false,
            detail: Detail::Idle,
        }
    }
}

/// `host:port` exactly as typed in the phone app: no `ws://`, no digit grouping.
pub fn endpoint(host: Ipv4Addr, port: u16) -> String {
    format!("{host}:{port}")
}

impl State {
    pub fn busy(&self) -> bool {
        matches!(self.phase, Phase::Starting | Phase::Stopping)
    }

    pub fn online(&self) -> bool {
        self.phase == Phase::Running
    }

    /// Returns `true` when the caller must spawn a server thread.
    pub fn start(&mut self) -> bool {
        if !matches!(self.phase, Phase::Stopped | Phase::Failed) {
            return false;
        }
        self.phase = Phase::Starting;
        self.detail = Detail::Starting;
        self.client_connected = false;
        true
    }

    /// Returns `true` when the caller must signal the running server thread.
    pub fn stop(&mut self) -> bool {
        if !matches!(self.phase, Phase::Starting | Phase::Running) {
            return false;
        }
        self.phase = Phase::Stopping;
        true
    }

    pub fn apply(&mut self, message: AgentMessage) {
        match message {
            AgentMessage::Bound => {}
            AgentMessage::Ready {
                port,
                addresses,
                name,
                mdns,
            } => {
                self.port = port;
                self.addresses = addresses;
                self.computer_name = Some(name);
                self.mdns = mdns;
                if self.phase == Phase::Starting {
                    self.phase = Phase::Running;
                    self.detail = Detail::Ready;
                }
            }
            AgentMessage::Client(connected) => {
                self.client_connected = connected && self.phase == Phase::Running;
            }
            AgentMessage::Stopped(failure) => {
                let requested = self.phase == Phase::Stopping;
                (self.phase, self.detail) = match failure {
                    Some(failure) => (Phase::Failed, Detail::Failed(failure)),
                    None if requested => (Phase::Stopped, Detail::Stopped),
                    None => (Phase::Failed, Detail::Exited),
                };
                self.client_connected = false;
                self.mdns = false;
                self.addresses.clear();
                self.copied = false;
            }
        }
    }

    /// Refreshes the LAN addresses (Wi-Fi changes); returns whether they changed.
    pub fn update_addresses(&mut self, addresses: Vec<Ipv4Addr>) -> bool {
        if self.phase != Phase::Running || self.addresses == addresses {
            return false;
        }
        self.addresses = addresses;
        true
    }

    /// Value placed on the clipboard (the first LAN address, like macOS).
    pub fn address(&self) -> Option<String> {
        if self.phase != Phase::Running {
            return None;
        }
        self.addresses.first().map(|ip| endpoint(*ip, self.port))
    }

    pub fn endpoints(&self) -> Vec<String> {
        self.addresses
            .iter()
            .map(|ip| endpoint(*ip, self.port))
            .collect()
    }

    pub fn port_blocked(&self) -> bool {
        matches!(
            self.detail,
            Detail::Failed(Failure::PortInUse | Failure::PortDenied)
        )
    }

    pub fn title<'a>(&self, s: &'a Strings) -> &'a str {
        match self.phase {
            Phase::Stopped => s.title_idle,
            Phase::Starting => s.title_starting,
            Phase::Stopping => s.title_stopping,
            Phase::Failed => s.title_failed,
            Phase::Running if self.client_connected => s.title_connected,
            Phase::Running => s.title_ready,
        }
    }

    pub fn detail(&self, s: &Strings) -> String {
        match &self.detail {
            Detail::Idle => s.detail_idle.to_owned(),
            Detail::Starting => s.detail_starting.to_owned(),
            Detail::Ready => s.detail_ready.to_owned(),
            Detail::Stopped => s.detail_stopped.to_owned(),
            Detail::Exited => s.error_exited.to_owned(),
            Detail::Failed(Failure::PortInUse) => fill(s.error_port_in_use, self.port),
            Detail::Failed(Failure::PortDenied) => fill(s.error_port_denied, self.port),
            Detail::Failed(Failure::Other(error)) => fill(s.error_agent, error),
        }
    }

    pub fn firewall_text<'a>(&self, s: &'a Strings) -> &'a str {
        if self.port_blocked() {
            s.firewall_blocked
        } else if self.phase == Phase::Running {
            s.firewall_running
        } else {
            s.firewall_first_run
        }
    }

    /// Notification-area tooltip (Windows limits it to 127 UTF-16 units).
    pub fn tooltip(&self, s: &Strings) -> String {
        let status = if self.online() {
            s.network_online
        } else {
            s.network_offline
        };
        let mut tip = format!("Remote Mouse · {status}");
        if let Some(address) = self.address() {
            tip.push_str(" · ");
            tip.push_str(&address);
        }
        tip
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::l10n::{EN, PT_BR};

    fn ready(state: &mut State) {
        assert!(state.start());
        state.apply(AgentMessage::Bound);
        state.apply(AgentMessage::Ready {
            port: 8765,
            addresses: vec![Ipv4Addr::new(192, 168, 0, 12), Ipv4Addr::new(10, 0, 0, 5)],
            name: "DESKTOP-CARLOS".into(),
            mdns: true,
        });
    }

    #[test]
    fn endpoint_has_no_scheme_or_grouping() {
        assert_eq!(
            endpoint(Ipv4Addr::new(192, 168, 0, 12), 8765),
            "192.168.0.12:8765"
        );
        assert_eq!(
            endpoint(Ipv4Addr::new(10, 0, 0, 1), 65535),
            "10.0.0.1:65535"
        );
    }

    #[test]
    fn full_lifecycle_matches_macos_titles() {
        let mut state = State::default();
        assert_eq!(state.title(&PT_BR), "Seu PC, sem fios.");
        assert_eq!(state.address(), None);
        ready(&mut state);
        assert_eq!(state.phase, Phase::Running);
        assert_eq!(state.title(&PT_BR), "Pronto para conectar!");
        assert_eq!(state.address().as_deref(), Some("192.168.0.12:8765"));
        assert_eq!(state.endpoints().len(), 2);
        state.apply(AgentMessage::Client(true));
        assert_eq!(state.title(&EN), "Connected!");
        assert!(state.tooltip(&EN).ends_with("Online · 192.168.0.12:8765"));
        assert!(state.stop());
        assert!(state.busy());
        assert!(!state.start(), "cannot start while stopping");
        state.apply(AgentMessage::Stopped(None));
        assert_eq!(state.phase, Phase::Stopped);
        assert_eq!(state.detail(&PT_BR), PT_BR.detail_stopped);
        assert!(state.addresses.is_empty() && !state.client_connected);
        assert_eq!(state.tooltip(&EN), "Remote Mouse · Offline");
    }

    #[test]
    fn port_in_use_is_a_clear_failure_and_can_retry() {
        let mut state = State::default();
        assert!(state.start());
        state.apply(AgentMessage::Stopped(Some(Failure::PortInUse)));
        assert_eq!(state.phase, Phase::Failed);
        assert!(state.port_blocked());
        assert!(state.detail(&PT_BR).contains("porta 8765 já está em uso"));
        assert_eq!(state.firewall_text(&EN), EN.firewall_blocked);
        assert!(state.start());
        assert!(!state.port_blocked());
    }

    #[test]
    fn unexpected_exit_is_failure_not_stopped() {
        let mut state = State::default();
        ready(&mut state);
        state.apply(AgentMessage::Stopped(None));
        assert_eq!(state.phase, Phase::Failed);
        assert_eq!(state.detail(&EN), EN.error_exited);
        let mut other = State::default();
        other.start();
        other.apply(AgentMessage::Stopped(Some(Failure::Other("boom".into()))));
        assert_eq!(other.detail(&EN), "Server error: boom");
    }

    #[test]
    fn late_messages_after_stop_request_do_not_resurrect() {
        let mut state = State::default();
        assert!(state.start());
        assert!(state.stop());
        state.apply(AgentMessage::Ready {
            port: 8765,
            addresses: vec![],
            name: "PC".into(),
            mdns: false,
        });
        state.apply(AgentMessage::Client(true));
        assert_eq!(state.phase, Phase::Stopping);
        assert!(!state.client_connected);
    }

    #[test]
    fn address_refresh_only_while_running() {
        let mut state = State::default();
        assert!(!state.update_addresses(vec![Ipv4Addr::LOCALHOST]));
        ready(&mut state);
        assert!(!state.update_addresses(state.addresses.clone()));
        assert!(state.update_addresses(vec![Ipv4Addr::new(172, 16, 0, 2)]));
        assert_eq!(state.address().as_deref(), Some("172.16.0.2:8765"));
    }
}
