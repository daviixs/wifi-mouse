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
codesign --verify --deep --strict "$APP"
STAGE="$(mktemp -d "$OUT/dmg.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT
ditto "$APP" "$STAGE/Remote Mouse.app"
ln -s /Applications "$STAGE/Applications"
hdiutil create -volname "Remote Mouse" -srcfolder "$STAGE" -format UDZO "$DMG"
if [[ -n "${CODESIGN_IDENTITY:-}" && "$CODESIGN_IDENTITY" != - ]]; then
  codesign --force --timestamp --sign "$CODESIGN_IDENTITY" "$DMG"
fi
hdiutil verify "$DMG"
printf '\nDMG gerado (não implica notarização): %s\n' "$DMG"
