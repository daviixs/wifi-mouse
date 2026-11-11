//! Remote Mouse for Windows: a native Win32 notification-area (tray) app that
//! runs the shared Rust agent in-process. No webview, no Tauri, no Electron.
#![cfg_attr(windows, windows_subsystem = "windows")]
#![cfg_attr(not(windows), allow(dead_code))]

mod autostart;
mod l10n;
mod model;

#[cfg(windows)]
mod agent;
#[cfg(windows)]
mod ui;

#[cfg(windows)]
fn main() {
    ui::run();
}

#[cfg(not(windows))]
fn main() {
    eprintln!("Remote Mouse para Windows só roda no Windows (no Mac, use macos/).");
    std::process::exit(1);
}
