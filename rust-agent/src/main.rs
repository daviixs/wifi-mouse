mod desktop;

use std::{env, error::Error, net::SocketAddr};

use remote_mouse_agent::server::{self, DEFAULT_BIND_ADDRESS, Event};
use serde_json::json;
use tokio::signal;

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<(), Box<dyn Error>> {
    if desktop::check_permission_mode() {
        return Ok(());
    }
    desktop::require_accessibility()?;
    let bind_address = env::var("REMOTE_MOUSE_BIND")
        .unwrap_or_else(|_| DEFAULT_BIND_ADDRESS.to_owned())
        .parse::<SocketAddr>()?;

    // Only the packaged desktop app opts into stdin control and structured events.
    // EOF shuts down our own helper if the parent exits or crashes. Futures are
    // lazy: stdin is first read after `Ready`, exactly as before the lib split.
    let shutdown = async {
        tokio::select! {
            _ = signal::ctrl_c() => {},
            _ = desktop::control() => {},
        }
    };
    server::run(bind_address, shutdown, |event| match event {
        Event::Bound { .. } => desktop::permission(),
        Event::Ready {
            port,
            addresses,
            name,
            mdns,
        } => {
            println!("Pressione Ctrl+C para encerrar.");
            desktop::ready(port, addresses, &name, mdns);
        }
        Event::Client { connected } => {
            desktop::emit(json!({"event": "client", "connected": connected}));
        }
    })
    .await
}
