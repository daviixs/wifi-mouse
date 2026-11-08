#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
[[ "$(uname -s)" == Darwin ]] || { echo "Erro: hdiutil exige macOS." >&2; exit 1; }
ARCH="${1:-$(uname -m)}"
case "$ARCH" in arm64|x86_64) ;; *) echo "Uso: $0 [arm64|x86_64]" >&2; exit 1 ;; esac
OUT="$ROOT/macos/dist/$ARCH"
APP="$OUT/Remote Mouse.app"
DMG="$OUT/Remote-Mouse-$ARCH.dmg"
[[ -d "$APP" ]] || { echo "Gere o app primeiro: macos/scripts/build-app.sh $ARCH" >&2; exit 1; }
[[ ! -e "$DMG" ]] || { echo "O DMG já existe. Mova-o antes de gerar novamente: $DMG" >&2; exit 1; }
for tool in python3 hdiutil codesign ditto osascript; do
  command -v "$tool" >/dev/null || { echo "Erro: ferramenta ausente: $tool" >&2; exit 1; }
done
python3 "$ROOT/macos/scripts/create-dmg.py" \
  --app "$APP" --background "$ROOT/macos/Resources/dmg/background.png" --output "$DMG"
