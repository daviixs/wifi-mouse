#!/usr/bin/env python3
"""Checks source translations/packaging declarations; does not claim a native build."""
from pathlib import Path
import plistlib
import re
from bundle_resources import LANGUAGES, read_strings as strings

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "macos/RemoteMouse/Sources/RemoteMouse"


def main():
    tables = {lang: strings(SOURCE / "Resources" / f"{lang}.lproj/Localizable.strings")
              for lang in LANGUAGES}
    expected = set(tables["en"])
    for lang, table in tables.items():
        assert set(table) == expected, f"Mismatched keys: {lang}"
        for key, value in table.items():
            assert value.strip(), f"Empty value: {lang}: {key}"
            assert re.findall(r"%[@d]", value) == re.findall(r"%[@d]", tables["en"][key]), f"Format mismatch: {lang}: {key}"
        privacy = strings(ROOT / "macos/Resources" / f"{lang}.lproj/InfoPlist.strings")
        assert privacy["NSLocalNetworkUsageDescription"].strip()
    all_swift = "\n".join(path.read_text() for path in SOURCE.glob("*.swift"))
    referenced = set(re.findall(r'"((?:name|detail|title|error|button|hint|connection|network|permission)\.[a-z.]+)"', all_swift))
    assert referenced <= expected, f"Missing translations: {referenced - expected}"
    with (ROOT / "macos/Resources/Info.plist").open("rb") as file:
        info = plistlib.load(file)
    assert set(info["CFBundleLocalizations"]) == set(LANGUAGES)
    assert info["CFBundleDevelopmentRegion"] == "en"
    manifest = (ROOT / "macos/RemoteMouse/Package.swift").read_text()
    assert 'defaultLocalization: "en"' in manifest and '.process("Resources")' in manifest
    build = (ROOT / "macos/scripts/build-app.sh").read_text()
    assert 'ditto "$RESOURCES" "$BUNDLE/Contents/Resources/RemoteMouse_RemoteMouse.bundle"' in build
    assert build.count('python3 "$ROOT/macos/scripts/bundle_resources.py"') == 2
    assert '"$RESOURCES/$language_dir.lproj/Localizable.strings"' not in build
    main_rs = (ROOT / "rust-agent/src/main.rs").read_text()
    assert main_rs.index("desktop::check_permission_mode()") < main_rs.index("TcpListener::bind") < main_rs.index("Enigo::new")
    print(f"OK: {len(expected)} keys × 3 languages, format arguments, localized privacy text, packaging declarations and early check-only guard.")


if __name__ == "__main__":
    main()
