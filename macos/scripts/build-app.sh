#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
[[ "$(uname -s)" == Darwin ]] || { echo "Erro: este build exige macOS 13+ e Xcode/Command Line Tools." >&2; exit 1; }
ARCH="${1:-$(uname -m)}"
case "$ARCH" in
  arm64) RUST_TARGET=aarch64-apple-darwin ;;
  x86_64) RUST_TARGET=x86_64-apple-darwin ;;
  *) echo "Uso: $0 [arm64|x86_64]" >&2; exit 1 ;;
esac
for tool in cargo rustup swift xcrun codesign iconutil sips python3; do
  command -v "$tool" >/dev/null || { echo "Erro: ferramenta ausente: $tool" >&2; exit 1; }
done
xcrun --sdk macosx --show-sdk-path >/dev/null
if ! rustup target list --installed | /usr/bin/grep -qx "$RUST_TARGET"; then
  echo "Instale o target antes: rustup target add $RUST_TARGET" >&2; exit 1
fi
export MACOSX_DEPLOYMENT_TARGET=13.0
export CARGO_TARGET_DIR="$ROOT/rust-agent/target"
TRIPLE="$ARCH-apple-macosx13.0"
OUT="$ROOT/macos/dist/$ARCH"
APP="$OUT/Remote Mouse.app"
mkdir -p "$OUT"
# Use a new staging bundle on every build, not an old app with a stale signature.
STAGE="$(mktemp -d "$OUT/staging.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT
BUNDLE="$STAGE/Remote Mouse.app"
mkdir -p "$BUNDLE/Contents/MacOS" "$BUNDLE/Contents/Resources"
cargo build --locked --release --manifest-path "$ROOT/rust-agent/Cargo.toml" --target "$RUST_TARGET"
swift build --package-path "$ROOT/macos/RemoteMouse" --configuration release --triple "$TRIPLE"
BIN="$(swift build --package-path "$ROOT/macos/RemoteMouse" --configuration release --triple "$TRIPLE" --show-bin-path)"
cp "$BIN/RemoteMouse" "$BUNDLE/Contents/MacOS/RemoteMouse"
RESOURCES="$BIN/RemoteMouse_RemoteMouse.bundle"
[[ -d "$RESOURCES" ]] || { echo "Erro: bundle de traduções SwiftPM ausente: $RESOURCES" >&2; exit 1; }
LOCALE_SOURCE="$ROOT/macos/RemoteMouse/Sources/RemoteMouse/Resources"
# SwiftPM native bundles can be flat; SwiftBuild/Xcode bundles use Contents/Resources.
# Validate values, not a guessed folder path, before and after copying unchanged.
python3 "$ROOT/macos/scripts/bundle_resources.py" "$RESOURCES" --source "$LOCALE_SOURCE"
ditto "$RESOURCES" "$BUNDLE/Contents/Resources/RemoteMouse_RemoteMouse.bundle"
python3 "$ROOT/macos/scripts/bundle_resources.py" \
  "$BUNDLE/Contents/Resources/RemoteMouse_RemoteMouse.bundle" --source "$LOCALE_SOURCE"
for language in pt-BR en es; do
  ditto "$ROOT/macos/Resources/$language.lproj" "$BUNDLE/Contents/Resources/$language.lproj"
done
cp "$ROOT/rust-agent/target/$RUST_TARGET/release/remote-mouse-agent" "$BUNDLE/Contents/MacOS/remote-mouse-agent"
cp "$ROOT/macos/Resources/Info.plist" "$BUNDLE/Contents/Info.plist"
printf 'APPL????' > "$BUNDLE/Contents/PkgInfo"
/usr/bin/plutil -lint "$BUNDLE/Contents/Info.plist"
for executable in RemoteMouse remote-mouse-agent; do
  /usr/bin/lipo -verify_arch "$ARCH" "$BUNDLE/Contents/MacOS/$executable"
done
# Reuse the repository's mobile app icon (no generated native mobile files).
ICONSET="$STAGE/RemoteMouse.iconset"
mkdir -p "$ICONSET"
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$ROOT/assets/images/icon.png" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  sips -z "$double" "$double" "$ROOT/assets/images/icon.png" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$BUNDLE/Contents/Resources/RemoteMouse.icns"
IDENTITY="${CODESIGN_IDENTITY:--}"
SIGN_ARGS=(--force --sign "$IDENTITY")
if [[ "$IDENTITY" != - ]]; then SIGN_ARGS+=(--options runtime --timestamp); fi
# Sign inside out. Never use --deep to hide an unsigned nested executable.
codesign "${SIGN_ARGS[@]}" "$BUNDLE/Contents/MacOS/remote-mouse-agent"
codesign "${SIGN_ARGS[@]}" "$BUNDLE"
codesign --verify --deep --strict --verbose=2 "$BUNDLE"
if [[ -e "$APP" ]]; then
  # Preserve previous artifact rather than overwriting it silently.
  mv "$APP" "$OUT/Remote Mouse.previous.$(date +%Y%m%d-%H%M%S).app"
fi
mv "$BUNDLE" "$APP"
printf '\nAplicativo gerado: %s\nAssinatura: %s\n' "$APP" "$IDENTITY"
