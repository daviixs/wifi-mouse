#!/usr/bin/env python3
"""Smoke test real do helper no Mac; requer Acessibilidade. Não envia comandos de input."""
import json
import os
from pathlib import Path
import selectors
import socket
import subprocess
import sys
import time


def launch(binary, port):
    env = dict(os.environ, REMOTE_MOUSE_DESKTOP="1", REMOTE_MOUSE_BIND=f"0.0.0.0:{port}")
    return subprocess.Popen([str(binary)], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, env=env)


def ready(child):
    pending = b""
    selector = selectors.DefaultSelector()
    selector.register(child.stdout, selectors.EVENT_READ)
    try:
        deadline = time.monotonic() + 12
        while time.monotonic() < deadline:
            for key, _ in selector.select(timeout=0.2):
                data = os.read(key.fd, 65536)
                if not data:
                    raise RuntimeError("Agente encerrou antes de ficar pronto: " + child.stderr.read().decode(errors="replace"))
                pending += data
                while b"\n" in pending:
                    line, pending = pending.split(b"\n", 1)
                    if line.startswith(b"REMOTE_MOUSE_EVENT "):
                        event = json.loads(line[len(b"REMOTE_MOUSE_EVENT "):])
                        if event["event"] == "ready":
                            return event
        raise RuntimeError("Agente não ficou pronto; verifique Acessibilidade.")
    finally:
        selector.close()


def finish(child):
    # Cleanup only our own Popen handle, even on assertion failure.
    if child.poll() is None:
        child.stdin.close()
        try:
            child.wait(timeout=10)
        except subprocess.TimeoutExpired:
            child.terminate()
            child.wait(timeout=5)
    child.stdout.close()
    child.stderr.close()


def main():
    if sys.platform != "darwin":
        raise SystemExit("Erro: execute no macOS com Acessibilidade autorizada.")
    if len(sys.argv) != 2:
        raise SystemExit('Uso: python3 macos/scripts/smoke-agent.py "caminho/Remote Mouse.app"')
    binary = Path(sys.argv[1]).resolve() / "Contents/MacOS/remote-mouse-agent"
    # OS picks a currently free port; the helper still owns bind and reports conflicts.
    with socket.socket() as reservation:
        reservation.bind(("127.0.0.1", 0))
        port = reservation.getsockname()[1]
    child = launch(binary, port)
    try:
        event = ready(child)
        assert event["port"] == port
        assert event["accessibility"] is True
        duplicate = launch(binary, port)
        try:
            assert duplicate.wait(timeout=10) != 0, "Agente duplicado não deve assumir a porta"
            assert child.poll() is None, "Não deve encerrar o agente já existente"
        finally:
            finish(duplicate)
        # A client that never sends its handshake must not block graceful shutdown.
        with socket.create_connection(("127.0.0.1", port), timeout=3):
            child.stdin.write(b"stop\n")
            child.stdin.flush()
            assert child.wait(timeout=10) == 0
    finally:
        finish(child)
    # Simulate a GUI crash: EOF must stop the helper without a signal/killall.
    orphan = launch(binary, port)
    try:
        ready(orphan)
        orphan.stdin.close()
        assert orphan.wait(timeout=10) == 0
    finally:
        finish(orphan)
    print("OK: ready, permissão real, conflito de porta, stop durante handshake e EOF.")


if __name__ == "__main__":
    main()
