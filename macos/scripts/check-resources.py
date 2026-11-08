#!/usr/bin/env python3
"""Checks source translations/packaging declarations; does not claim a native build."""
import json
from pathlib import Path
import plistlib
import re

ROOT = Path(__file__).resolve().parents[2]
LANGUAGES = ("pt-BR", "en", "es")
SOURCE = ROOT / "macos/RemoteMouse/Sources/RemoteMouse"
PAIR = re.compile(r'("(?:\\.|[^"\\])*")\s*=\s*("(?:\\.|[^"\\])*");')


def strings(path):
    text = path.read_text()
    result = {}
    for match in PAIR.finditer(text):
        key, value = (json.loads(part) for part in match.groups())
        assert key not in result, f"Duplicate key: {path}: {key}"
        result[key] = value
    assert PAIR.sub("", text).strip() == "", f"Unparsed strings content: {path}"
    assert result, f"Empty translation table: {path}"
    return result


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
    main_rs = (ROOT / "rust-agent/src/main.rs").read_text()
    assert main_rs.index("desktop::check_permission_mode()") < main_rs.index("TcpListener::bind") < main_rs.index("Enigo::new")
    print(f"OK: {len(expected)} keys × 3 languages, format arguments, localized privacy text, packaging declarations and early check-only guard.")


if __name__ == "__main__":
    main()
