mod diagnostics;
mod input;
mod protocol;

use std::{
    env,
    error::Error,
    future::Future,
    net::{IpAddr, Ipv4Addr, SocketAddr, UdpSocket},
    pin::Pin,
    time::Instant,
};

use enigo::{Enigo, Settings};
use futures_util::{SinkExt, StreamExt};
use tokio::{
    net::{TcpListener, TcpStream},
    signal,
};
use tokio_tungstenite::{
    accept_async_with_config,
    tungstenite::{Message, protocol::WebSocketConfig},
};

const DEFAULT_BIND_ADDRESS: &str = "0.0.0.0:8765";
const MAX_COMMAND_BYTES: usize = 1024;

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<(), Box<dyn Error>> {
    let bind_address = env::var("REMOTE_MOUSE_BIND")
        .unwrap_or_else(|_| DEFAULT_BIND_ADDRESS.to_owned())
        .parse::<SocketAddr>()?;

    let listener = TcpListener::bind(bind_address).await?;
    let mouse = Enigo::new(&Settings::default())?;
    let mut mouse = input::MouseController::new(mouse);

    print_listen_addresses(bind_address);
    println!("Pressione Ctrl+C para encerrar.");

    let mut shutdown: Pin<Box<dyn Future<Output = ()>>> = Box::pin(async {
        let _ = signal::ctrl_c().await;
    });

    loop {
        tokio::select! {
            _ = &mut shutdown => {
                println!("Encerrando agente.");
                break;
            }
            accepted = listener.accept() => {
                let (stream, peer) = accepted?;
                println!("Conexão recebida de {peer}.");
                if let Err(error) = serve_connection(stream, &mut mouse, &mut shutdown).await {
                    eprintln!("Conexão {peer} encerrada com erro: {error}");
                }
                println!("Conexão {peer} encerrada.");
            }
        }
    }

    Ok(())
}

fn lan_ipv4_addresses() -> Vec<Ipv4Addr> {
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

fn print_listen_addresses(bind_address: SocketAddr) {
    let port = bind_address.port();
    let addresses = match bind_address.ip() {
        IpAddr::V4(ip) if ip.is_unspecified() => lan_ipv4_addresses(),
        IpAddr::V4(ip) => vec![ip],
        IpAddr::V6(_) => Vec::new(),
    };
    match addresses.as_slice() {
        [] => {
            println!("Remote Mouse ouvindo em ws://{bind_address}");
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

async fn serve_connection(
    stream: TcpStream,
    mouse: &mut input::MouseController,
    shutdown: &mut Pin<Box<dyn Future<Output = ()>>>,
) -> Result<(), Box<dyn Error>> {
    let mut config = WebSocketConfig::default();
    config.max_message_size = Some(MAX_COMMAND_BYTES);
    config.max_frame_size = Some(MAX_COMMAND_BYTES);
    let mut socket = accept_async_with_config(stream, Some(config)).await?;
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
