//! Remote Mouse agent library.
//!
//! The WebSocket server, input injection and mDNS advertisement are shared by
//! the standalone `remote-mouse-agent` binary (CLI and macOS helper) and the
//! native Windows tray app, which runs [`server::run`] in-process.

pub mod diagnostics;
pub mod discovery;
pub mod input;
pub mod protocol;
pub mod server;
