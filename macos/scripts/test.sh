#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
[[ "$(uname -s)" == Darwin ]] || { echo "Erro: SwiftUI e enigo deste projeto exigem macOS/Windows; rode este teste no Mac." >&2; exit 1; }
command -v python3 >/dev/null || { echo "Erro: Python 3 é necessário para validar os bundles de idiomas." >&2; exit 1; }
python3 "$ROOT/macos/scripts/check-resources.py"
python3 "$ROOT/macos/scripts/test_bundle_resources.py"
cargo test --locked --manifest-path "$ROOT/rust-agent/Cargo.toml"
swift test --package-path "$ROOT/macos/RemoteMouse"
