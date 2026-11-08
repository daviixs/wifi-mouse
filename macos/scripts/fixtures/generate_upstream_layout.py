#!/usr/bin/env python3
"""Reproduce an upstream-writer fixture, never run as part of a DMG build.
Usage: python3 generate_upstream_layout.py /path/to/dmgbuild-1.6.7-py3-none-any.whl
The upstream code is immutable/hash-pinned. All native commands are intercepted;
Alias identity is explicitly a fixture, not a Mac/Finder-generated sample.
"""
import datetime
import hashlib
import importlib
import json
from pathlib import Path
import sys
import tempfile
from unittest.mock import patch
import zipfile

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import dmg_metadata  # loads the hash-checked codec wheels
from mac_alias.alias import Alias, VolumeInfo, TargetInfo

WHEEL_SHA = "37ee5771c377beb3203d9164aae8046ffed8531c06edf9227f5788b3c599b1bf"
wheel = Path(sys.argv[1]).resolve()
assert hashlib.sha256(wheel.read_bytes()).hexdigest() == WHEEL_SHA
sys.path.insert(0, str(wheel))
with patch("platform.mac_ver", return_value=("14.0.0", ("", "", ""), "arm64")):
    upstream = importlib.import_module("dmgbuild.core")


def alias_fixture(path):
    date = datetime.datetime(2026, 1, 1, tzinfo=datetime.timezone.utc)
    return Alias(volume=VolumeInfo("Reference", date, b"H+", 0, 0, b"\0\0", posix_path="/Volumes/Reference"),
                 target=TargetInfo(0, ".background.png", 2, 47, date, b"\0"*4, b"\0"*4, posix_path="/.background.png"))


settings = {
    "window_rect": ((120, 120), (640, 480)), "sidebar_width": 0,
    "icon_size": 72, "text_size": 12, "grid_spacing": 80,
    "icon_locations": {"Remote Mouse.app": (170, 240), "Applications": (470, 240)},
    "shrink": False, "format": "UDZO",
}
with tempfile.TemporaryDirectory(prefix="upstream-layout-fixture-") as directory:
    root = Path(directory)
    mount = root / "mount"
    mount.mkdir()
    def hdiutil(command, *args, **kwargs):
        assert command in ("create", "attach", "detach", "convert", "resize")
        if command == "attach":
            return 0, {"system-entities": [{"dev-entry": "/dev/fixture-only", "mount-point": str(mount)}]}
        return 0, {}
    def check_call(args, **kwargs):
        assert args[0] == "sync", args  # no real process is ever started
        return 0
    settings["background"] = str(HERE.parent.parent / "Resources/dmg/background.png")
    with patch.object(upstream, "hdiutil", side_effect=hdiutil), \
         patch.object(upstream.Alias, "for_file", side_effect=alias_fixture), \
         patch.object(upstream.subprocess, "check_call", side_effect=check_call), \
         patch.object(upstream.subprocess, "Popen", side_effect=AssertionError("No real processes")), \
         patch.object(upstream.subprocess, "run", side_effect=AssertionError("No real processes")):
        upstream.build_dmg(str(root / "fixture.dmg"), "Reference", settings=settings, lookForHiDPI=False)
    body = (mount / ".DS_Store").read_bytes()
    (HERE / "dmgbuild-1.6.7-reference.dsstore").write_bytes(body)
with zipfile.ZipFile(wheel) as archive:
    core = archive.read("dmgbuild/core.py")
manifest = {"upstream": "https://pypi.org/project/dmgbuild/1.6.7/", "wheel_sha256": WHEEL_SHA,
            "core_sha256": hashlib.sha256(core).hexdigest(), "fixture_sha256": hashlib.sha256(body).hexdigest(),
            "identity": "explicit synthetic Alias identity; native commands mocked; writer is unmodified upstream"}
(HERE / "dmgbuild-1.6.7-reference.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(manifest)
