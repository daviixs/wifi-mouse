#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
[[ "$(uname -s)" == Darwin ]] || { echo "Erro: SwiftUI e enigo deste projeto exigem macOS/Windows; rode este teste no Mac." >&2; exit 1; }
cargo test --locked --manifest-path "$ROOT/rust-agent/Cargo.toml"
swift test --package-path "$ROOT/macos/RemoteMouse"
