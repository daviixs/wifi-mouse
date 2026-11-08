#!/usr/bin/env python3
"""Real binary codec/file tests. Native Alias filesystem identity uses a fixture,
not an Apple runtime, Finder or hdiutil simulation masquerading as integration.
"""
import datetime
import hashlib
import json
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


def fixture_resolution(data, expected_path):
    # Explicit resolver fixture for Linux codec tests; not native resolution.
    return {"path": str(expected_path), "stale": False}


class MetadataTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / ".background").mkdir()
        shutil.copyfile(BACKGROUND, self.root / metadata.RELATIVE_BACKGROUND)
        self.initial = metadata.write_layout(self.root, alias_factory=fixture_alias, alias_resolver=fixture_resolution)

    def mutate(self, callback):
        with metadata.DSStore.open(str(self.root / ".DS_Store"), "r+") as store:
            callback(store)

    def verify(self):
        return metadata.verify_layout(self.root, alias_factory=fixture_alias, alias_resolver=fixture_resolution)

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
            self.assertEqual(alias.volume.posix_path, str(self.root))
            self.assertIsNone(alias.volume.disk_image_alias)

    def test_unmodified_upstream_fixture_confirms_codes_keys_and_alias_volume_hint(self):
        fixtures = Path(__file__).with_name("fixtures")
        path = fixtures / "dmgbuild-1.6.7-reference.dsstore"
        manifest = json.loads((fixtures / "dmgbuild-1.6.7-reference.json").read_text())
        self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), manifest["fixture_sha256"])
        with metadata.DSStore.open(str(path), "r") as upstream, metadata.DSStore.open(str(self.root / ".DS_Store"), "r") as actual:
            self.assertEqual({entry.code for entry in upstream if entry.filename == "."}, {b"vSrn", b"bwsp", b"icvp", b"icvl"})
            self.assertEqual(actual["."]["bwsp"], upstream["."]["bwsp"])
            self.assertEqual(actual["."]["icvl"], upstream["."]["icvl"])
            reference_options = upstream["."]["icvp"]
            own_options = actual["."]["icvp"]
            self.assertIn("backgroundImageAlias", reference_options)
            self.assertNotIn("backgroundImageAliasData", reference_options)
            self.assertEqual({k: v for k, v in own_options.items() if k != "backgroundImageAlias"},
                             {k: v for k, v in reference_options.items() if k != "backgroundImageAlias"})
            alias = metadata.Alias.from_bytes(reference_options["backgroundImageAlias"])
            self.assertEqual(alias.volume.posix_path, "/Volumes/Reference")
            self.assertEqual(alias.target.posix_path, "/.background.png")

    def test_factory_alias_bytes_are_preserved_without_sanitizing_resolver_fields(self):
        alias = fixture_alias(self.root / metadata.RELATIVE_BACKGROUND)
        alias.extra = [(77, b"preserve-native-extra")]
        expected = alias.to_bytes()
        metadata.write_layout(self.root, alias_factory=lambda path: metadata.Alias.from_bytes(expected), alias_resolver=fixture_resolution)
        with metadata.DSStore.open(str(self.root / ".DS_Store"), "r") as store:
            self.assertEqual(store["."]["icvp"]["backgroundImageAlias"], expected)

    def test_native_resolution_must_reach_this_mount_not_an_identical_other_volume(self):
        with tempfile.TemporaryDirectory() as directory:
            other = Path(directory) / "background.png"
            other.write_bytes(BACKGROUND.read_bytes())
            with self.assertRaisesRegex(metadata.MetadataError, "fora da montagem atual") as raised:
                metadata.verify_layout(self.root, alias_factory=fixture_alias,
                                       alias_resolver=lambda data, expected: {"path": str(other), "stale": False})
            for field in ("device", "inode", "canonical_path", "same_object", str(other)):
                self.assertIn(field, str(raised.exception))
            identities = metadata.compare_resolved_file({"path": str(other)}, self.root / metadata.RELATIVE_BACKGROUND)
            self.assertFalse(identities["same_object"])
            self.assertNotEqual(identities["resolved"]["inode"], identities["expected"]["inode"])

    def test_stale_true_is_accepted_when_the_actual_file_matches(self):
        result = metadata.verify_layout(self.root, alias_factory=fixture_alias,
                                        alias_resolver=lambda data, expected: {"path": str(expected), "stale": True})
        self.assertTrue(result["background_native_resolution"]["stale"])
        self.assertTrue(result["background_file_identity"]["same_object"])

    def test_file_identity_handles_symlink_and_missing_target_without_path_guesses(self):
        background = self.root / metadata.RELATIVE_BACKGROUND
        link = self.root / "alias-path"
        link.symlink_to(background)
        same = metadata.compare_resolved_file({"path": str(link)}, background)
        self.assertTrue(same["same_object"])
        self.assertEqual(same["resolved"]["canonical_path"], str(background.resolve()))
        missing = metadata.compare_resolved_file({"path": str(self.root / "missing")}, background)
        self.assertFalse(missing["same_object"])
        self.assertFalse(missing["resolved"]["exists"])
        self.assertTrue(missing["expected"]["exists"])
        self.assertIn("device", missing["expected"])
        self.assertIn("inode", missing["expected"])

    def test_system_hidden_folder_is_not_deleted_or_modified(self):
        system = self.root / ".fseventsd"
        system.mkdir()
        marker = system / "keep"
        marker.write_bytes(b"system data, not ours to delete")
        metadata.write_layout(self.root, alias_factory=fixture_alias, alias_resolver=fixture_resolution)
        self.assertEqual(marker.read_bytes(), b"system data, not ours to delete")

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
                    metadata.write_layout(self.root, alias_factory=fixture_alias, alias_resolver=fixture_resolution)

    def test_background_identity_relative_path_and_host_hint_are_verified(self):
        for kind in ("file-id", "volume", "path", "missing-hint"):
            with self.subTest(kind=kind):
                def change(store):
                    options = store["."]["icvp"]
                    alias = metadata.Alias.from_bytes(options["backgroundImageAlias"])
                    if kind == "file-id": alias.target.cnid = 999
                    if kind == "volume": alias.volume.name = "Wrong Volume"
                    if kind == "path": alias.target.posix_path = "/Users/example/background.png"
                    if kind == "missing-hint": alias.volume.posix_path = None
                    options["backgroundImageAlias"] = alias.to_bytes()
                    store["."]["icvp"] = options
                self.mutate(change)
                with self.assertRaisesRegex(metadata.MetadataError, "background"):
                    self.verify()
                metadata.write_layout(self.root, alias_factory=fixture_alias, alias_resolver=fixture_resolution)

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
            report = metadata.verify_layout(relocated / "new-mount", alias_factory=fixture_alias, alias_resolver=fixture_resolution)
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
