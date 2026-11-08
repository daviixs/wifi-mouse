#!/usr/bin/env python3
"""Real binary codec/file tests. Native Alias filesystem identity uses a fixture,
not an Apple runtime, Finder or hdiutil simulation masquerading as integration.
"""
import datetime
import hashlib
from pathlib import Path
import shutil
import struct
import sys
import tempfile
import unittest

import dmg_metadata as metadata
from mac_alias.alias import Alias, VolumeInfo, TargetInfo

BACKGROUND = Path(__file__).resolve().parent.parent / "Resources/dmg/background.png"


def fixture_alias(path):
    date = datetime.datetime(2026, 1, 1, tzinfo=datetime.timezone.utc)
    return Alias(
        volume=VolumeInfo("Remote Mouse", date, b"H+", 0, 0, b"\0\0", posix_path=str(Path(path).parent.parent)),
        target=TargetInfo(0, "background.png", 42, 43, date, b"\0"*4, b"\0"*4,
                          folder_name=".background", posix_path="/.background/background.png"),
    )


class MetadataTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / ".background").mkdir()
        shutil.copyfile(BACKGROUND, self.root / metadata.RELATIVE_BACKGROUND)
        self.initial = metadata.write_layout(self.root, alias_factory=fixture_alias)

    def mutate(self, callback):
        with metadata.DSStore.open(str(self.root / ".DS_Store"), "r+") as store:
            callback(store)

    def verify(self):
        return metadata.verify_layout(self.root, alias_factory=fixture_alias)

    def test_real_binary_roundtrip_and_content_geometry(self):
        data = (self.root / ".DS_Store").read_bytes()
        self.assertEqual(data[4:8], b"Bud1")
        # Independent check of the documented raw Iloc payload, not only the
        # same library decoding its own encoder output.
        for x in (170, 470):
            self.assertIn(struct.pack(">IIII", x, 240, 0xFFFFFFFF, 0xFFFF0000), data)
        self.assertIn(b"bplist00", data)
        self.assertEqual(self.initial["positions_Iloc"], {"Remote Mouse.app": (170, 240), "Applications": (470, 240)})
        self.assertEqual(self.initial["window"]["WindowBounds"], "{{120, 120}, {640, 480}}")
        self.assertEqual(self.initial["icon_view"]["scrollPositionY"], 0.0)
        self.assertEqual(self.initial["background_alias"]["relative_path"], ".background/background.png")
        with metadata.DSStore.open(str(self.root / ".DS_Store"), "r") as store:
            self.assertEqual(store["."]["icvl"], (b"type", b"icnv"))
            alias = metadata.Alias.from_bytes(store["."]["icvp"]["backgroundImageAlias"])
            self.assertIsNone(alias.volume.posix_path)
            self.assertIsNone(alias.volume.disk_image_alias)

    def test_one_point_and_observed_thirteen_point_shifts_are_rejected(self):
        for offset in (1, 13, -1):
            with self.subTest(offset=offset):
                self.mutate(lambda store: store["Remote Mouse.app"].__setitem__("Iloc", (170, 240 + offset)))
                with self.assertRaisesRegex(metadata.MetadataError, "Iloc Remote Mouse.app"):
                    self.verify()

    def test_aggregates_positions_window_scroll_and_background_failures(self):
        def change(store):
            store["Remote Mouse.app"]["Iloc"] = (171, 253)
            store["Applications"]["Iloc"] = (470, 253)
            window = store["."]["bwsp"]
            window["WindowBounds"] = "{{120, 120}, {640, 502}}"
            store["."]["bwsp"] = window
            options = store["."]["icvp"]
            options["scrollPositionY"] = 13.0
            options["backgroundImageAlias"] = b"not an alias"
            store["."]["icvp"] = options
        self.mutate(change)
        with self.assertRaises(metadata.MetadataError) as raised:
            self.verify()
        for field in ("Remote Mouse.app", "Applications", "WindowBounds", "scrollPositionY", "background Alias inválido"):
            self.assertIn(field, str(raised.exception))

    def test_all_dmgbuild_visual_options_remain_strict(self):
        for section, expected in (("bwsp", metadata.WINDOW), ("icvp", metadata.ICON_VIEW)):
            for key, value in expected.items():
                with self.subTest(section=section, key=key):
                    def change(store):
                        options = store["."][section]
                        options[key] = not value if isinstance(value, bool) else "wrong"
                        store["."][section] = options
                    self.mutate(change)
                    with self.assertRaisesRegex(metadata.MetadataError, key):
                        self.verify()
                    metadata.write_layout(self.root, alias_factory=fixture_alias)

    def test_background_identity_relative_path_and_host_hint_are_verified(self):
        for kind in ("file-id", "volume", "path", "host-hint"):
            with self.subTest(kind=kind):
                def change(store):
                    options = store["."]["icvp"]
                    alias = metadata.Alias.from_bytes(options["backgroundImageAlias"])
                    if kind == "file-id": alias.target.cnid = 999
                    if kind == "volume": alias.volume.name = "Wrong Volume"
                    if kind == "path": alias.target.posix_path = "/Users/example/background.png"
                    if kind == "host-hint": alias.volume.posix_path = "/tmp/obsolete-mount"
                    options["backgroundImageAlias"] = alias.to_bytes()
                    store["."]["icvp"] = options
                self.mutate(change)
                with self.assertRaisesRegex(metadata.MetadataError, "background"):
                    self.verify()
                metadata.write_layout(self.root, alias_factory=fixture_alias)

    def test_read_only_verification_does_not_write_metadata(self):
        store = self.root / ".DS_Store"
        before = (store.read_bytes(), store.stat().st_mtime_ns)
        store.chmod(0o444)
        self.assertEqual(self.verify()["sha256"], self.initial["sha256"])
        self.assertEqual((store.read_bytes(), store.stat().st_mtime_ns), before)

    def test_relocation_uses_no_original_host_mountpoint(self):
        with tempfile.TemporaryDirectory(prefix="Remote Mouse São Paulo ") as directory:
            relocated = Path(directory)
            shutil.copytree(self.root, relocated / "new-mount")
            (self.root / metadata.RELATIVE_BACKGROUND).unlink()
            report = metadata.verify_layout(relocated / "new-mount", alias_factory=fixture_alias)
            self.assertEqual(report["sha256"], self.initial["sha256"])
            # The identity provider here is explicitly a fixture, not the macOS
            # Alias resolver. Real conversion/mount identity needs macOS testing.

    def test_missing_root_records_and_corrupt_file_are_rejected(self):
        self.mutate(lambda store: store["."].__delitem__(b"icvl"))
        with self.assertRaisesRegex(metadata.MetadataError, "icvl"):
            self.verify()
        (self.root / ".DS_Store").write_bytes(b"corrupt")
        with self.assertRaisesRegex(metadata.MetadataError, "ilegível"):
            self.verify()

    def test_background_symlink_is_rejected_without_following_it(self):
        path = self.root / metadata.RELATIVE_BACKGROUND
        path.unlink()
        path.symlink_to(BACKGROUND)
        with self.assertRaisesRegex(metadata.MetadataError, "sem symlink"):
            self.verify()

    def test_vendored_wheel_digests(self):
        for name, expected in metadata.WHEELS.items():
            self.assertEqual(hashlib.sha256((metadata.VENDOR / name).read_bytes()).hexdigest(), expected)

    @unittest.skipIf(sys.platform == "darwin", "Linux refusal test; native factory is supported on macOS")
    def test_build_never_fabricates_native_alias_on_linux(self):
        with self.assertRaisesRegex(metadata.MetadataError, "Identidade nativa.*Not implemented"):
            metadata.write_layout(self.root)


if __name__ == "__main__":
    unittest.main()
