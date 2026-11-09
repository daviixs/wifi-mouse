//! WebSocket server loop shared by every desktop front end.
//!
//! Front ends receive typed [`Event`]s; the macOS helper maps them to its private
//! stdout protocol and the Windows app forwards them to its UI thread.

use std::{
    cell::Cell,
    error::Error,
    future::Future,
    io,
    net::{IpAddr, Ipv4Addr, SocketAddr, UdpSocket},
    pin::Pin,
    rc::Rc,
    time::Instant,
};

use enigo::{Enigo, Settings};
use futures_util::{SinkExt, StreamExt};
use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::{
    accept_async_with_config,
    tungstenite::{Message, protocol::WebSocketConfig},
};

use crate::{diagnostics, discovery, input, protocol};

pub const DEFAULT_PORT: u16 = 8765;
pub const DEFAULT_BIND_ADDRESS: &str = "0.0.0.0:8765";
const MAX_COMMAND_BYTES: usize = 1024;

/// Lifecycle notifications, in order: `Bound`, `Ready`, then any number of `Client`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Event {
    /// The TCP listener is bound; input injection is not initialised yet.
    Bound { port: u16 },
    /// Input injection works and the optional mDNS advertisement was attempted.
    Ready {
        port: u16,
        addresses: Vec<Ipv4Addr>,
        name: String,
        mdns: bool,
    },
    /// A phone connected (`true`) or its WebSocket ended (`false`).
    Client { connected: bool },
}

/// Why the listener could not be opened, for user-facing status messages.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BindFailure {
    /// Another program (or another copy of Remote Mouse) already uses the port.
    InUse,
    /// The OS refused the port (e.g. Windows excluded port range or policy).
    Denied,
    Other,
}

/// Classifies an error returned by [`run`]; `None` when it is not a bind error.
pub fn bind_failure(error: &(dyn Error + 'static)) -> Option<BindFailure> {
    let error = error.downcast_ref::<io::Error>()?;
    Some(match error.kind() {
        io::ErrorKind::AddrInUse => BindFailure::InUse,
        io::ErrorKind::PermissionDenied | io::ErrorKind::AddrNotAvailable => BindFailure::Denied,
        _ => BindFailure::Other,
    })
}

type Shutdown<'a> = Pin<Box<dyn Future<Output = ()> + 'a>>;

/// Serves phones until `shutdown` completes. One phone is served at a time.
///
/// Must run on a current-thread Tokio runtime (`Enigo` is not `Send`).
pub async fn run(
    bind_address: SocketAddr,
    shutdown: impl Future<Output = ()>,
    on_event: impl Fn(Event),
) -> Result<(), Box<dyn Error>> {
    let listener = TcpListener::bind(bind_address).await?;
    let port = listener.local_addr()?.port();
    on_event(Event::Bound { port });
    let mouse = Enigo::new(&Settings::default())?;
    let mut mouse = input::MouseController::new(mouse);

    print_listen_addresses(bind_address.ip(), port);
    let advertisement = match discovery::Advertisement::start(port) {
        Ok(advertisement) => {
            println!(
                "Anunciando \"{}\" na rede via mDNS ({}) — o app encontra este computador automaticamente.",
                advertisement.instance_name,
                discovery::SERVICE_TYPE
            );
            Some(advertisement)
        }
        Err(error) => {
            eprintln!("Aviso: não foi possível anunciar via mDNS ({error}). Use o IP manualmente.");
            None
        }
    };

    on_event(Event::Ready {
        port,
        addresses: lan_ipv4_addresses(),
        name: discovery::computer_name(),
        mdns: advertisement.is_some(),
    });
    let stopping = Rc::new(Cell::new(false));
    let shutdown_stopping = Rc::clone(&stopping);
    let mut shutdown: Shutdown<'_> = Box::pin(async move {
        shutdown.await;
        shutdown_stopping.set(true);
    });

    loop {
        tokio::select! {
            _ = &mut shutdown => {
                println!("Encerrando agente.");
                break;
            }
            accepted = listener.accept() => {
                let (stream, peer) = match accepted {
                    Ok(accepted) => accepted,
                    Err(error) => {
                        eprintln!("Falha ao aceitar conexão: {error}");
                        continue;
                    }
                };
                println!("Conexão recebida de {peer}.");
                if let Err(error) = serve_connection(stream, &mut mouse, &mut shutdown, &on_event).await {
                    eprintln!("Conexão {peer} encerrada com erro: {error}");
                }
                println!("Conexão {peer} encerrada.");
                // The same pinned shutdown future also runs inside the connection.
                // Do not poll it again once it has completed there.
                if stopping.get() { break; }
            }
        }
    }

    if let Some(advertisement) = advertisement {
        advertisement.shutdown();
        println!("Anúncio mDNS removido.");
    }

    Ok(())
}

/// LAN IPv4 addresses a phone on the same network can use.
pub fn lan_ipv4_addresses() -> Vec<Ipv4Addr> {
    let mut addresses: Vec<Ipv4Addr> = if_addrs::get_if_addrs()
        .unwrap_or_default()
        .into_iter()
        .filter(|interface| !interface.is_loopback())
        .filter_map(|interface| match interface.ip() {
            IpAddr::V4(ip) if !ip.is_loopback() && !ip.is_link_local() && !ip.is_unspecified() => {
                Some(ip)
            }
            _ => None,
        })
        .collect();
    if addresses.is_empty() {
        // Fallback: let the OS pick the outbound interface (no packet is sent).
        if let Ok(socket) = UdpSocket::bind("0.0.0.0:0")
            && socket.connect("8.8.8.8:80").is_ok()
            && let Ok(SocketAddr::V4(local)) = socket.local_addr()
            && !local.ip().is_loopback()
            && !local.ip().is_unspecified()
        {
            addresses.push(*local.ip());
        }
    }
    addresses.sort();
    addresses.dedup();
    addresses
}

fn print_listen_addresses(ip: IpAddr, port: u16) {
    let addresses = match ip {
        IpAddr::V4(ip) if ip.is_unspecified() => lan_ipv4_addresses(),
        IpAddr::V4(ip) => vec![ip],
        IpAddr::V6(_) => Vec::new(),
    };
    match addresses.as_slice() {
        [] => {
            println!("Remote Mouse ouvindo em ws://{}", SocketAddr::new(ip, port));
            println!("Não foi possível detectar o IP da rede local; verifique o Wi-Fi.");
        }
        [ip] => println!("Remote Mouse ouvindo em ws://{ip}:{port} — digite {ip} no app"),
        many => {
            println!("Remote Mouse ouvindo na porta {port}. IPs desta máquina:");
            for ip in many {
                println!("  • ws://{ip}:{port} — digite {ip} no app");
            }
            println!("Use o IP da mesma rede Wi-Fi do celular.");
        }
    }
}

/// Reports the disconnect on every exit path, including errors.
struct ClientStatus<'a>(&'a dyn Fn(Event));
impl Drop for ClientStatus<'_> {
    fn drop(&mut self) {
        (self.0)(Event::Client { connected: false });
    }
}

async fn serve_connection(
    stream: TcpStream,
    mouse: &mut input::MouseController,
    shutdown: &mut Shutdown<'_>,
    on_event: &dyn Fn(Event),
) -> Result<(), Box<dyn Error>> {
    let mut config = WebSocketConfig::default();
    config.max_message_size = Some(MAX_COMMAND_BYTES);
    config.max_frame_size = Some(MAX_COMMAND_BYTES);
    let mut socket = tokio::select! {
        _ = shutdown.as_mut() => return Ok(()),
        socket = accept_async_with_config(stream, Some(config)) => socket?,
    };
    // Additive v1 server greeting. Old clients ignore incoming frames; shortcut
    // commands remain unchanged and are never remapped by modifier on the agent.
    socket
        .send(Message::Text(
            serde_json::json!({
                "version": 1, "type": "server.info", "payload": {"os": discovery::os_tag()}
            })
            .to_string()
            .into(),
        ))
        .await?;
    on_event(Event::Client { connected: true });
    let _client_status = ClientStatus(on_event);
    let mut diagnostics = diagnostics::AgentDiagnostics::default();

    loop {
        tokio::select! {
            _ = shutdown.as_mut() => return Ok(()),
            incoming = socket.next() => {
                match incoming {
                    Some(Ok(Message::Text(text))) => {
                        let received_at = Instant::now();
                        match protocol::parse_command(text.as_str()) {
                            Ok(command) => {
                                let metrics = diagnostics::CommandMetrics::from_command(&command);
                                let started_at = Instant::now();
                                let error = mouse.apply(command).err().map(|error| error.to_string());
                                diagnostics.record(
                                    metrics,
                                    started_at.duration_since(received_at),
                                    started_at.elapsed(),
                                    error,
                                );
                                if let Some(report) = diagnostics.report_if_due() {
                                    println!("{report}");
                                }
                            }
                            Err(error) => eprintln!("Comando ignorado: {error}"),
                        }
                    }
                    Some(Ok(Message::Ping(payload))) => {
                        socket.send(Message::Pong(payload)).await?;
                    }
                    Some(Ok(Message::Close(_))) | None => return Ok(()),
                    Some(Ok(Message::Binary(_))) => eprintln!("Mensagem binária ignorada; esperado JSON em texto."),
                    Some(Ok(Message::Pong(_))) => {}
                    Some(Ok(Message::Frame(_))) => {}
                    Some(Err(error)) => return Err(error.into()),
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bind_failures_are_classified_for_the_ui() {
        let in_use: Box<dyn Error> = Box::new(io::Error::from(io::ErrorKind::AddrInUse));
        assert_eq!(bind_failure(in_use.as_ref()), Some(BindFailure::InUse));
        let denied: Box<dyn Error> = Box::new(io::Error::from(io::ErrorKind::PermissionDenied));
        assert_eq!(bind_failure(denied.as_ref()), Some(BindFailure::Denied));
        let other: Box<dyn Error> = "enigo".into();
        assert_eq!(bind_failure(other.as_ref()), None);
    }

    #[test]
    fn default_bind_address_matches_default_port() {
        let address: SocketAddr = DEFAULT_BIND_ADDRESS.parse().unwrap();
        assert_eq!(address.port(), DEFAULT_PORT);
        assert!(address.ip().is_unspecified());
    }

    #[test]
    fn occupied_port_is_reported_before_any_event() {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        runtime.block_on(async {
            let holder = TcpListener::bind("127.0.0.1:0").await.unwrap();
            let address = holder.local_addr().unwrap();
            let events = std::cell::RefCell::new(Vec::new());
            let error = run(address, std::future::pending(), |event| {
                events.borrow_mut().push(event)
            })
            .await
            .unwrap_err();
            assert!(matches!(
                bind_failure(error.as_ref()),
                Some(BindFailure::InUse | BindFailure::Denied)
            ));
            assert!(events.borrow().is_empty());
        });
    }
}
