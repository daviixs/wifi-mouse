#!/usr/bin/env python3
"""Portable safety/orchestration tests with mocked Apple tools; not Finder validation."""
import importlib.util
import os
import plistlib
import re
from pathlib import Path
import struct
import sys
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("remote_mouse_dmg", HERE / "create-dmg.py")
dmg = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = dmg
SPEC.loader.exec_module(dmg)
BACKGROUND = HERE.parent / "Resources/dmg/background.png"


class DmgLayoutTests(unittest.TestCase):
    def test_approved_background_dimensions(self):
        self.assertEqual(dmg.png_dimensions(BACKGROUND), (640, 480))

    def test_mount_ownership_ignores_same_volume_name_and_parent_devices(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            image = root / "image.dmg"
            image.write_bytes(b"our image")
            other_image = root / "foreign.dmg"
            other_image.write_bytes(b"our image")  # content/name is not ownership
            own = root / "own" / "Remote Mouse"
            other = root / "foreign" / "Remote Mouse"
            own.mkdir(parents=True)
            other.mkdir(parents=True)
            info = {"images": [
                {"image-path": str(image), "system-entities": [
                    {"dev-entry": "/dev/disk7"}, {"mount-point": str(own)}]},
                {"image-path": str(other_image), "system-entities": [
                    {"dev-entry": "/dev/disk70", "mount-point": str(other)}]},
            ]}
            self.assertEqual(dmg.image_mounts(info, image), [own])

    def test_detach_only_exact_owned_mount(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            mount = dmg.OwnedMount(root / "image.dmg", root / "mount")
            mount.path.mkdir()
            other = root / "foreign"
            other.mkdir()
            with patch.object(dmg, "attached_paths", side_effect=[[mount.path], []]), patch.object(dmg, "run") as run:
                dmg.detach(mount)
                run.assert_called_once_with(["/usr/bin/hdiutil", "detach", mount.path.resolve()], timeout=90)
            with patch.object(dmg, "attached_paths", return_value=[other]), patch.object(dmg, "run") as run:
                dmg.detach(mount)
                run.assert_not_called()

    def test_refuses_existing_output_without_touching_it(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "existing.dmg"
            output.write_bytes(b"previous user artifact")
            with patch.object(dmg, "run") as run:
                with self.assertRaises(dmg.BuildError):
                    dmg.build(Path(directory) / "app", BACKGROUND, output)
                run.assert_not_called()
            self.assertEqual(output.read_bytes(), b"previous user artifact")

    def test_visible_items_background_and_dsstore_checks(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "Remote Mouse.app").mkdir()
            (root / "Applications").symlink_to("/Applications")
            (root / ".background").mkdir()
            (root / ".background/background.png").write_bytes(BACKGROUND.read_bytes())
            (root / ".DS_Store").write_bytes(b"mock metadata, not a Finder DS_Store")
            mount = dmg.OwnedMount(root / "not-mounted.dmg", root)
            dmg.verify_contents(mount, BACKGROUND)
            (root / "README.txt").write_text("unexpected auxiliary icon")
            with self.assertRaises(dmg.BuildError):
                dmg.verify_contents(mount, BACKGROUND)

    def run_mocked_build(self, root, fail_readonly=False, corrupt_readonly=False):
        app = root / "Remote Mouse.app"
        app.mkdir()
        output = root / "result.dmg"
        calls = []
        mount_paths = []

        def tool(arguments, timeout=120):
            if "create" in arguments:
                Path(arguments[-1]).write_bytes(b"writable-image")
            if "convert" in arguments:
                Path(arguments[-1]).write_bytes(b"verified-readonly-image")
            calls.append(arguments)
            return b""

        def mount_image(mount, readonly):
            mount.path.mkdir(parents=True)
            mount_paths.append(mount.path)
            (mount.path / ".DS_Store").write_bytes(b"mock-metadata")
            calls.append(("attach", readonly))

        def unmount_image(mount):
            if mount.path.exists():
                (mount.path / ".DS_Store").unlink()
                mount.path.rmdir()  # only a test-owned, now-empty temporary folder

        def layout(mode, mount):
            calls.append(("layout", mode))
            if mode == "verify" and fail_readonly:
                raise dmg.BuildError("readonly layout mismatch")
            return "changed" if mode == "verify" and corrupt_readonly else "same-digest"

        with patch.object(dmg, "run", side_effect=tool), patch.object(dmg, "attach", side_effect=mount_image), \
             patch.object(dmg, "detach", side_effect=unmount_image), patch.object(dmg, "attached_paths", return_value=[]), \
             patch.object(dmg, "canonical_mount_path", side_effect=lambda name: root / "canonical" / name), \
             patch.object(dmg, "verify_contents"), \
             patch.object(dmg, "image_layout", side_effect=layout), \
             patch.dict(os.environ, {"CODESIGN_IDENTITY": "-"}):
            if fail_readonly or corrupt_readonly:
                with self.assertRaises(dmg.BuildError):
                    dmg.build(app, BACKGROUND, output)
                self.assertFalse(output.exists())
            else:
                dmg.build(app, BACKGROUND, output)
                self.assertEqual(output.read_bytes(), b"verified-readonly-image")
        self.assertEqual(len(mount_paths), 2)
        self.assertEqual(mount_paths[0], mount_paths[1])
        self.assertRegex(mount_paths[0].name, r"^Remote Mouse [0-9a-f]{12}$")
        create = next(command for command in calls if isinstance(command, list) and "create" in command)
        self.assertEqual(create[create.index("-volname") + 1], mount_paths[0].name)
        self.assertIn(("attach", False), calls)
        self.assertIn(("attach", True), calls)
        self.assertLess(calls.index(("layout", "write")), calls.index(("layout", "verify")))
        self.assertEqual(list(root.glob(".dmg-layout-*")), [])

    def test_success_checks_readonly_remount_before_publication(self):
        with tempfile.TemporaryDirectory() as directory:
            self.run_mocked_build(Path(directory))

    def test_readonly_layout_failure_does_not_publish_dmg(self):
        with tempfile.TemporaryDirectory() as directory:
            self.run_mocked_build(Path(directory), fail_readonly=True)

    def test_readonly_metadata_digest_mismatch_is_not_published(self):
        with tempfile.TemporaryDirectory() as directory:
            self.run_mocked_build(Path(directory), corrupt_readonly=True)

    def test_unmount_failure_preserves_workspace_and_never_deletes_mount(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            app = root / "Remote Mouse.app"
            app.mkdir()
            output = root / "result.dmg"
            def mount_image(mount, readonly):
                mount.path.mkdir(parents=True)
            with patch.object(dmg, "run", return_value=b""), \
                 patch.object(dmg, "attach", side_effect=mount_image), \
                 patch.object(dmg, "canonical_mount_path", side_effect=lambda name: root / "canonical" / name), \
                 patch.object(dmg, "image_layout", side_effect=dmg.BuildError("Finder denied")), \
                 patch.object(dmg, "detach", side_effect=dmg.BuildError("volume busy")), \
                 patch.object(dmg.shutil, "rmtree") as remove:
                with self.assertRaisesRegex(dmg.BuildError, "Temporários preservados.*volume busy.*Falha original: Finder denied"):
                    dmg.build(app, BACKGROUND, output)
                remove.assert_not_called()
                self.assertFalse(output.exists())
                self.assertEqual(len(list(root.glob(".dmg-layout-*"))), 1)

    def test_volume_labels_are_unique_and_fit_the_alias_v2_field(self):
        names = {dmg.new_volume_name() for _ in range(64)}
        self.assertEqual(len(names), 64)
        for name in names:
            self.assertRegex(name, r"^Remote Mouse [0-9a-f]{12}$")
            self.assertLessEqual(len(name.encode("ascii")), 27)
            self.assertEqual(dmg.canonical_mount_path(name), Path("/Volumes") / name)

    def test_attach_uses_canonical_automount_not_a_custom_mountpoint(self):
        with tempfile.TemporaryDirectory() as directory:
            mount = dmg.OwnedMount(Path(directory) / "image.dmg", Path(directory) / "planned-volume")
            reply = plistlib.dumps({"system-entities": [{"mount-point": str(mount.path)}]})
            with patch.object(dmg, "run", return_value=reply) as run, patch.object(dmg, "attached_paths", return_value=[mount.path]):
                dmg.attach(mount, readonly=True)
                args = run.call_args.args[0]
                self.assertIn("-readonly", args)
                self.assertNotIn("-mountpoint", args)
                self.assertNotIn("-mountroot", args)
                self.assertNotIn("-mountrandom", args)
                self.assertFalse(mount.path.exists())  # our code never mkdirs the mount

    def test_real_symlink_spelling_is_accepted_by_attach_and_detach(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            real = root / "real"
            real.mkdir()
            alias = root / "alias"
            alias.symlink_to(real, target_is_directory=True)
            image = real / "image.dmg"
            image.write_bytes(b"own image")
            mount = dmg.OwnedMount(alias / "image.dmg", alias / "volume")
            canonical = real / "volume"

            def auto_mount(arguments, timeout=90):
                canonical.mkdir()  # actual filesystem, but Apple command is mocked
                return plistlib.dumps({"system-entities": [{"mount-point": str(canonical)}]})

            with patch.object(dmg, "run", side_effect=auto_mount), patch.object(dmg, "attached_paths", return_value=[mount.path]):
                dmg.attach(mount, False)
            self.assertTrue(mount.path.samefile(canonical))
            self.assertTrue(dmg.same_filesystem_path(mount.path, canonical))
            info = {"images": [{"image-path": str(image), "system-entities": [{"mount-point": str(canonical)}]}]}
            self.assertEqual(dmg.image_mounts(info, mount.image), [canonical])
            with patch.object(dmg, "attached_paths", side_effect=[[mount.path], []]), patch.object(dmg, "run") as run:
                dmg.detach(dmg.OwnedMount(image, canonical))
                run.assert_called_once_with(["/usr/bin/hdiutil", "detach", canonical], timeout=90)

    def test_symlink_does_not_make_another_mount_or_image_owned(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            real = root / "real"
            real.mkdir()
            alias = root / "alias"
            alias.symlink_to(real, target_is_directory=True)
            own = real / "our-volume"
            other = real / "foreign-volume"
            other.mkdir()
            image = real / "our-image.dmg"
            foreign = real / "foreign-image.dmg"
            image.write_bytes(b"same bytes")
            foreign.write_bytes(b"same bytes")
            mount = dmg.OwnedMount(image, alias / "our-volume")
            reply = plistlib.dumps({"system-entities": [{"mount-point": str(other)}]})
            with patch.object(dmg, "run", return_value=reply), patch.object(dmg, "attached_paths", return_value=[other]):
                with self.assertRaisesRegex(dmg.BuildError, "mount canônico único"):
                    dmg.attach(mount, False)
            own.mkdir()  # two live directories: actual inode comparison, not fallback
            with patch.object(dmg, "attached_paths", return_value=[other]), patch.object(dmg, "run") as run:
                dmg.detach(mount)
                run.assert_not_called()
            self.assertFalse(dmg.same_filesystem_path(own, other))
            info = {"images": [{"image-path": str(foreign), "system-entities": [{"mount-point": str(own)}]}]}
            self.assertEqual(dmg.image_mounts(info, alias / "our-image.dmg"), [])
            with patch.object(dmg, "run", return_value=plistlib.dumps(info)):
                self.assertEqual(dmg.mount_report(mount)["entities"], [])
            # Even if a foreign image reports our expected mount path, its
            # different file identity must prevent detach through the real filter.
            with patch.object(dmg, "run", return_value=plistlib.dumps(info)) as run:
                dmg.detach(mount)
                run.assert_called_once_with(["/usr/bin/hdiutil", "info", "-plist"])

    def test_detach_postcheck_detects_an_owned_mount_through_its_symlink(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            real = root / "real"
            real.mkdir()
            alias = root / "alias"
            alias.symlink_to(real, target_is_directory=True)
            mount = dmg.OwnedMount(root / "image.dmg", real)
            with patch.object(dmg, "attached_paths", return_value=[alias]), patch.object(dmg, "run") as run:
                with self.assertRaisesRegex(dmg.BuildError, "Volume continua montado"):
                    dmg.detach(mount)
                run.assert_called_once_with(["/usr/bin/hdiutil", "detach", real], timeout=90)

    def test_attach_still_requires_exactly_one_owned_mount(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            mount = dmg.OwnedMount(root / "image.dmg", root / "planned")
            reply = plistlib.dumps({"system-entities": [{"mount-point": str(mount.path)}]})
            with patch.object(dmg, "run", return_value=reply), patch.object(dmg, "attached_paths", return_value=[mount.path, mount.path]):
                with self.assertRaisesRegex(dmg.BuildError, "mount canônico único"):
                    dmg.attach(mount, False)

    def test_path_identity_does_not_strip_private_or_swallow_stat_errors(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            # This is a literal folder named private, NOT an OS path alias.
            self.assertFalse(dmg.same_filesystem_path(root / "private" / "volume", root / "volume"))
            with patch.object(Path, "samefile", side_effect=PermissionError("denied")):
                with self.assertRaises(PermissionError):
                    dmg.same_filesystem_path(root, root)

    def test_attach_never_overwrites_or_unmounts_an_existing_path(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            marker = root / "keep"
            marker.write_bytes(b"not ours")
            with patch.object(dmg, "run") as run:
                with self.assertRaisesRegex(dmg.BuildError, "já ocupado"):
                    dmg.attach(dmg.OwnedMount(root / "image.dmg", root), False)
                run.assert_not_called()
            self.assertEqual(marker.read_bytes(), b"not ours")

    def test_attach_rejects_automatic_suffix_and_reports_only_owned_mounts(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            mount = dmg.OwnedMount(root / "image.dmg", root / "expected")
            actual = root / "expected 1"
            reply = plistlib.dumps({"system-entities": [{"mount-point": str(actual)}]})
            with patch.object(dmg, "run", return_value=reply), patch.object(dmg, "attached_paths", return_value=[actual]):
                with self.assertRaisesRegex(dmg.BuildError, "sufixo/caminho alternativo"):
                    dmg.attach(mount, False)
            info = {"images": [
                {"image-path": str(mount.image), "system-entities": [{"dev-entry": "/dev/owned", "mount-point": str(actual)}]},
                {"image-path": "/private/unrelated/image.dmg", "system-entities": [{"dev-entry": "/dev/other", "mount-point": "/Volumes/Private"}]},
            ]}
            with patch.object(dmg, "run", return_value=plistlib.dumps(info)):
                report = dmg.mount_report(mount)
            self.assertEqual(report["entities"], [{"dev-entry": "/dev/owned", "mount-point": str(actual)}])
            self.assertNotIn("Private", str(report))
            self.assertNotIn("unrelated", str(report))

    def test_command_timeout_becomes_clear_error(self):
        with patch.object(dmg.subprocess, "run", side_effect=dmg.subprocess.TimeoutExpired("osascript", 90)):
            with self.assertRaisesRegex(dmg.BuildError, "Timeout"):
                dmg.run(["/usr/bin/osascript"], timeout=90)


if __name__ == "__main__":
    unittest.main()
