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
    # Structural regression guard only, not an AppKit runtime test.
    entry = (SOURCE / "RemoteMouseApp.swift").read_text()
    assert not re.search(r"\b(?:Settings|WindowGroup)\s*\{", entry), "Status-only startup must not register a window scene"
    assert ": App {" not in entry and "NSApplicationDelegateAdaptor" not in entry
    assert "RemoteMouseApplication.shared" in entry and "withExtendedLifetime(delegate)" in entry
    assert info["LSUIElement"] is True
    assert info["NSPrincipalClass"] == "RemoteMouseApplication"
    assert "@objc(RemoteMouseApplication)" in entry and "override func restoreWindow" in entry
    assert "completionHandler(nil, nil)" in entry
    # Network identifiers are verbatim strings, not LocalizedStringKey numeric interpolation.
    panel = (SOURCE / "ServerPanel.swift").read_text()
    assert "Text(verbatim: AgentController.copiedAddress(host: ip, port: model.port))" in panel
    assert 'Text("\\(ip):\\(model.port)")' not in panel
    manifest = (ROOT / "macos/RemoteMouse/Package.swift").read_text()
    assert 'defaultLocalization: "en"' in manifest and '.process("Resources")' in manifest
    build = (ROOT / "macos/scripts/build-app.sh").read_text()
    assert 'ditto "$RESOURCES" "$BUNDLE/Contents/Resources/RemoteMouse_RemoteMouse.bundle"' in build
    assert build.count('python3 "$ROOT/macos/scripts/bundle_resources.py"') == 2
    assert '"$RESOURCES/$language_dir.lproj/Localizable.strings"' not in build
    # The helper binary checks permission before handing off to the shared
    # server library, which binds before constructing Enigo.
    main_rs = (ROOT / "rust-agent/src/main.rs").read_text()
    server_rs = (ROOT / "rust-agent/src/server.rs").read_text()
    assert main_rs.index("desktop::check_permission_mode()") < main_rs.index("desktop::require_accessibility()") < main_rs.index("server::run(")
    assert "TcpListener::bind" not in main_rs and "Enigo::new" not in main_rs
    assert server_rs.index("TcpListener::bind") < server_rs.index("Enigo::new")
    print(f"OK: {len(expected)} keys × 3 languages, format arguments, localized privacy text, packaging/status-only startup declarations, verbatim endpoint and early check-only guard.")


if __name__ == "__main__":
    main()
