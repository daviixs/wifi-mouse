//! Private pipe protocol for the macOS shell; never sent over the WebSocket.
use serde_json::{Value, json};
use std::{
    env,
    io::{self, BufRead, Read, Write},
    net::Ipv4Addr,
};

pub fn enabled() -> bool {
    env::var("REMOTE_MOUSE_DESKTOP").as_deref() == Ok("1")
}

pub fn emit(value: Value) {
    if enabled() {
        // One locked write: diagnostics cannot interleave with an event.
        let mut stdout = io::stdout().lock();
        let _ = writeln!(stdout, "REMOTE_MOUSE_EVENT {value}");
        let _ = stdout.flush();
    }
}

#[cfg(target_os = "macos")]
fn accessibility(prompt: bool) -> bool {
    use core_foundation::{
        base::TCFType, boolean::CFBoolean, dictionary::CFDictionary, string::CFString,
    };
    #[link(name = "ApplicationServices", kind = "framework")]
    unsafe extern "C" {
        static kAXTrustedCheckOptionPrompt: *const std::ffi::c_void;
        fn AXIsProcessTrustedWithOptions(options: *const std::ffi::c_void) -> u8;
    }
    // Get-rule retains the framework-owned constant; do not release Apple's reference.
    let key = unsafe { CFString::wrap_under_get_rule(kAXTrustedCheckOptionPrompt.cast()) };
    let value = if prompt {
        CFBoolean::true_value()
    } else {
        CFBoolean::false_value()
    };
    let options = CFDictionary::from_CFType_pairs(&[(key, value)]);
    unsafe { AXIsProcessTrustedWithOptions(options.as_concrete_TypeRef().cast()) != 0 }
}

/// Check in the actual server process before binding or constructing Enigo.
/// A trusted GUI/probe cannot stand in for this process's current TCC decision.
pub fn require_accessibility() -> io::Result<()> {
    permission_guard(accessibility(false))
}

fn permission_guard(trusted: bool) -> io::Result<()> {
    if trusted {
        Ok(())
    } else {
        emit(json!({"event": "permission", "accessibility": false}));
        Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "Accessibility denied for the input process; authorize the current installed app in System Settings",
        ))
    }
}

/// Must run before binding, Enigo initialization or mDNS. Even denied checks exit 0:
/// authorization is the JSON boolean, whereas process failure means unknown.
pub fn check_permission_mode() -> bool {
    let args: Vec<String> = env::args().skip(1).collect();
    let Some(prompt) = permission_request(&args) else {
        return false;
    };
    println!(
        "REMOTE_MOUSE_EVENT {}",
        json!({"event": "permission", "accessibility": accessibility(prompt)})
    );
    true
}

fn permission_request(args: &[String]) -> Option<bool> {
    if args.iter().any(|arg| arg == "--request-accessibility") {
        Some(true)
    } else if args.iter().any(|arg| arg == "--check-accessibility") {
        Some(false)
    } else {
        None
    }
}

#[cfg(not(target_os = "macos"))]
fn accessibility(_prompt: bool) -> bool {
    true
}

pub fn permission() {
    emit(
        json!({"event": "permission", "accessibility": accessibility(false),
                "addresses": remote_mouse_agent::server::lan_ipv4_addresses()}),
    );
}

pub fn ready(port: u16, addresses: Vec<Ipv4Addr>, name: &str, mdns: bool) {
    emit(json!({
        "event": "ready", "port": port, "addresses": addresses,
        "name": name, "mdns": mdns,
        "accessibility": accessibility(false)
    }));
}

#[derive(Debug, PartialEq)]
enum Command {
    Status,
    Stop,
    Ignore,
}
fn parse_command(line: &str) -> Command {
    match line.trim() {
        "status" => Command::Status,
        "stop" => Command::Stop,
        _ => Command::Ignore,
    }
}

pub async fn control() {
    if !enabled() {
        std::future::pending::<()>().await;
        return;
    }
    let (sender, mut receiver) = tokio::sync::mpsc::unbounded_channel();
    // Not tokio::io::stdin: its blocking pool can keep the runtime alive on exit.
    std::thread::spawn(move || read_commands(io::stdin().lock(), sender));
    while let Some(command) = receiver.recv().await {
        match command {
            Command::Stop => break,
            Command::Status => permission(),
            Command::Ignore => {}
        }
    }
}

fn read_commands(mut input: impl BufRead, sender: tokio::sync::mpsc::UnboundedSender<Command>) {
    let mut line = String::new();
    loop {
        line.clear();
        // Cap each control line; a malformed parent must not grow memory forever.
        let result = input.by_ref().take(256).read_line(&mut line);
        if !matches!(result, Ok(n) if n > 0) {
            break;
        }
        if line.len() >= 256 || sender.send(parse_command(&line)).is_err() {
            break;
        }
    }
    // Dropping sender also requests shutdown on EOF/error.
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn server_requires_its_own_actual_permission() {
        assert!(permission_guard(true).is_ok());
        assert_eq!(
            permission_guard(false).unwrap_err().kind(),
            io::ErrorKind::PermissionDenied
        );
    }

    #[test]
    fn control_is_explicit_and_does_not_accept_partial_commands() {
        assert_eq!(parse_command("status\n"), Command::Status);
        assert_eq!(parse_command("stop\r\n"), Command::Stop);
        assert_eq!(parse_command("stop-other-process"), Command::Ignore);
        assert_eq!(parse_command(""), Command::Ignore);
    }
    #[test]
    fn eof_closes_control_channel_after_ordered_commands() {
        let (sender, mut receiver) = tokio::sync::mpsc::unbounded_channel();
        read_commands(io::Cursor::new(b"status\nstop\n"), sender);
        assert_eq!(receiver.try_recv().unwrap(), Command::Status);
        assert_eq!(receiver.try_recv().unwrap(), Command::Stop);
        assert!(matches!(
            receiver.try_recv(),
            Err(tokio::sync::mpsc::error::TryRecvError::Disconnected)
        ));
    }

    #[test]
    fn oversized_control_lines_close_channel() {
        let (sender, mut receiver) = tokio::sync::mpsc::unbounded_channel();
        read_commands(io::Cursor::new(vec![b'a'; 300]), sender);
        assert!(matches!(
            receiver.try_recv(),
            Err(tokio::sync::mpsc::error::TryRecvError::Disconnected)
        ));
    }
    #[test]
    fn permission_modes_are_explicit_and_silent_by_default() {
        assert_eq!(permission_request(&[]), None);
        assert_eq!(
            permission_request(&["--check-accessibility".into()]),
            Some(false)
        );
        assert_eq!(
            permission_request(&["--request-accessibility".into()]),
            Some(true)
        );
        assert_eq!(
            permission_request(&["--check-accessibility-extra".into()]),
            None
        );
    }
}
