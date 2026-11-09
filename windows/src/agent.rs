//! Runs the shared `remote-mouse-agent` server in-process on its own thread.
//!
//! `Enigo` is not `Send`, so the server owns a dedicated current-thread Tokio
//! runtime. The UI thread only sees [`AgentMessage`]s and a stop signal.

use std::{
    net::{Ipv4Addr, SocketAddr, SocketAddrV4},
    panic::{AssertUnwindSafe, catch_unwind},
    thread::JoinHandle,
};

use remote_mouse_agent::server::{self, BindFailure, Event};
use tokio::sync::oneshot;

use crate::model::{AgentMessage, DEFAULT_PORT, Failure};

pub struct AgentHandle {
    stop: Option<oneshot::Sender<()>>,
    thread: Option<JoinHandle<()>>,
}

impl AgentHandle {
    /// `notify` runs on the server thread; it must only queue and wake the UI.
    pub fn spawn(notify: impl Fn(AgentMessage) + Send + 'static) -> std::io::Result<Self> {
        let (stop, stopped) = oneshot::channel::<()>();
        let thread = std::thread::Builder::new()
            .name("remote-mouse-server".into())
            .spawn(move || {
                let outcome = catch_unwind(AssertUnwindSafe(|| serve(stopped, &notify)));
                let failure = match outcome {
                    Ok(failure) => failure,
                    Err(_) => Some(Failure::Other("panic".into())),
                };
                notify(AgentMessage::Stopped(failure));
            })?;
        Ok(Self {
            stop: Some(stop),
            thread: Some(thread),
        })
    }

    /// Asks the server to close the listener, the phone socket and mDNS.
    pub fn request_stop(&mut self) {
        // Dropping the sender also completes the receiver.
        if let Some(stop) = self.stop.take() {
            let _ = stop.send(());
        }
    }

    /// Call after `Stopped` was delivered; the thread is then already exiting.
    pub fn join(mut self) {
        self.request_stop();
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

fn serve(stopped: oneshot::Receiver<()>, notify: &dyn Fn(AgentMessage)) -> Option<Failure> {
    let runtime = match tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
    {
        Ok(runtime) => runtime,
        Err(error) => return Some(Failure::Other(error.to_string())),
    };
    let bind = SocketAddr::V4(SocketAddrV4::new(Ipv4Addr::UNSPECIFIED, DEFAULT_PORT));
    let result = runtime.block_on(server::run(
        bind,
        async {
            let _ = stopped.await;
        },
        |event| notify(message(event)),
    ));
    result
        .err()
        .map(|error| match server::bind_failure(error.as_ref()) {
            Some(BindFailure::InUse) => Failure::PortInUse,
            Some(BindFailure::Denied) => Failure::PortDenied,
            _ => Failure::Other(error.to_string()),
        })
}

fn message(event: Event) -> AgentMessage {
    match event {
        Event::Bound { .. } => AgentMessage::Bound,
        Event::Ready {
            port,
            addresses,
            name,
            mdns,
        } => AgentMessage::Ready {
            port,
            addresses,
            name,
            mdns,
        },
        Event::Client { connected } => AgentMessage::Client(connected),
    }
}

pub fn lan_addresses() -> Vec<Ipv4Addr> {
    server::lan_ipv4_addresses()
}
