mod input;
mod protocol;

use std::{env, error::Error, future::Future, net::SocketAddr, pin::Pin};

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

    println!("Remote Mouse Agent ouvindo em ws://{bind_address}");
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

async fn serve_connection(
    stream: TcpStream,
    mouse: &mut input::MouseController,
    shutdown: &mut Pin<Box<dyn Future<Output = ()>>>,
) -> Result<(), Box<dyn Error>> {
    let mut config = WebSocketConfig::default();
    config.max_message_size = Some(MAX_COMMAND_BYTES);
    config.max_frame_size = Some(MAX_COMMAND_BYTES);
    let mut socket = accept_async_with_config(stream, Some(config)).await?;

    loop {
        tokio::select! {
            _ = shutdown.as_mut() => return Ok(()),
            incoming = socket.next() => {
                match incoming {
                    Some(Ok(Message::Text(text))) => {
                        match protocol::parse_command(text.as_str()) {
                            Ok(command) => {
                                if let Err(error) = mouse.apply(command) {
                                    eprintln!("Falha ao executar comando do mouse: {error}");
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
