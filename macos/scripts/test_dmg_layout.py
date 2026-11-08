#!/usr/bin/env python3
"""Portable safety/orchestration tests with mocked Apple tools; not Finder validation."""
import importlib.util
import os
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


def snapshot(bounds="120,120,760,622", **overrides):
    # Explicit fixture contract, not defaults imported from the implementation.
    fields = {
        "bounds": bounds, "app": "170,240", "applications": "470,240",
        "view_icon": 1, "arrangement_none": 1, "arrangement_text": "not arranged",
        "icon_size": 72, "text_size": 12, "toolbar": 0, "statusbar": 0,
        "sidebar": 0, "labels_bottom": 1, "item_info": 0, "background": 1,
        "folder_app": "170,240", "folder_applications": "470,240",
    }
    fields.update(overrides)
    return ";".join(f"{key}={value}" for key, value in fields.items())


def report(mode="verify", after_set="n/a", after_reopen=None):
    return f"OK\tv2\t{mode}\t{after_set}\t{after_reopen or snapshot()}".encode()


class DmgLayoutTests(unittest.TestCase):
    def test_approved_background_dimensions(self):
        self.assertEqual(dmg.png_dimensions(BACKGROUND), (640, 480))

    def test_mount_ownership_ignores_same_volume_name_and_parent_devices(self):
        image = Path("/tmp/private-layout/image.dmg")
        info = {"images": [
            {"image-path": str(image), "system-entities": [
                {"dev-entry": "/dev/disk7"}, {"mount-point": "/tmp/private-layout/mount-rw"}]},
            {"image-path": "/Users/example/unrelated.dmg", "system-entities": [
                {"mount-point": "/Volumes/Remote Mouse"}]},
        ]}
        self.assertEqual(dmg.image_mounts(info, image), [Path("/tmp/private-layout/mount-rw")])

    def test_detach_only_exact_owned_mount(self):
        mount = dmg.OwnedMount(Path("/tmp/private/image.dmg"), Path("/tmp/private/mount"))
        with patch.object(dmg, "attached_paths", side_effect=[[mount.path], []]), patch.object(dmg, "run") as run:
            dmg.detach(mount)
            run.assert_called_once_with(["/usr/bin/hdiutil", "detach", mount.path], timeout=90)
        with patch.object(dmg, "attached_paths", return_value=[Path("/Volumes/Remote Mouse")]), patch.object(dmg, "run") as run:
            dmg.detach(mount)
            run.assert_not_called()

    def test_refuses_existing_output_without_touching_it(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "existing.dmg"
            output.write_bytes(b"previous user artifact")
            with patch.object(dmg, "run") as run:
                with self.assertRaises(dmg.BuildError):
                    dmg.build(Path(directory) / "app", BACKGROUND, output, HERE / "dmg-layout.applescript")
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

    def run_mocked_build(self, root, fail_readonly=False):
        app = root / "Remote Mouse.app"
        app.mkdir()
        output = root / "result.dmg"
        calls = []

        def tool(arguments, timeout=120):
            if "create" in arguments:
                Path(arguments[-1]).write_bytes(b"writable-image")
            if "convert" in arguments:
                Path(arguments[-1]).write_bytes(b"verified-readonly-image")
            calls.append(arguments)
            return b""

        def mount_image(mount, readonly):
            mount.path.mkdir()
            (mount.path / ".DS_Store").write_bytes(b"mock-metadata")
            calls.append(("attach", readonly))

        def layout(mode, mount, script):
            calls.append(("layout", mode))
            if mode == "verify" and fail_readonly:
                raise dmg.BuildError("readonly layout mismatch")

        with patch.object(dmg, "run", side_effect=tool), patch.object(dmg, "attach", side_effect=mount_image), \
             patch.object(dmg, "detach"), patch.object(dmg, "attached_paths", return_value=[]), \
             patch.object(dmg, "verify_contents"), patch.object(dmg, "wait_for_store"), \
             patch.object(dmg, "finder_layout", side_effect=layout), \
             patch.dict(os.environ, {"CODESIGN_IDENTITY": "-"}):
            if fail_readonly:
                with self.assertRaises(dmg.BuildError):
                    dmg.build(app, BACKGROUND, output, HERE / "dmg-layout.applescript")
                self.assertFalse(output.exists())
            else:
                dmg.build(app, BACKGROUND, output, HERE / "dmg-layout.applescript")
                self.assertEqual(output.read_bytes(), b"verified-readonly-image")
        self.assertIn(("attach", False), calls)
        self.assertIn(("attach", True), calls)
        self.assertLess(calls.index(("layout", "configure")), calls.index(("layout", "verify")))
        self.assertEqual(list(root.glob(".dmg-layout-*")), [])

    def test_success_checks_readonly_remount_before_publication(self):
        with tempfile.TemporaryDirectory() as directory:
            self.run_mocked_build(Path(directory))

    def test_readonly_layout_failure_does_not_publish_dmg(self):
        with tempfile.TemporaryDirectory() as directory:
            self.run_mocked_build(Path(directory), fail_readonly=True)

    def test_unmount_failure_preserves_workspace_and_never_deletes_mount(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            app = root / "Remote Mouse.app"
            app.mkdir()
            output = root / "result.dmg"
            def mount_image(mount, readonly):
                mount.path.mkdir()
            with patch.object(dmg, "run", return_value=b""), \
                 patch.object(dmg, "attach", side_effect=mount_image), \
                 patch.object(dmg, "finder_layout", side_effect=dmg.BuildError("Finder denied")), \
                 patch.object(dmg, "detach", side_effect=dmg.BuildError("volume busy")), \
                 patch.object(dmg.shutil, "rmtree") as remove:
                with self.assertRaisesRegex(dmg.BuildError, "Temporários preservados.*volume busy.*Falha original: Finder denied"):
                    dmg.build(app, BACKGROUND, output, HERE / "dmg-layout.applescript")
                remove.assert_not_called()
                self.assertFalse(output.exists())
                self.assertEqual(len(list(root.glob(".dmg-layout-*"))), 1)

    def test_bounds_origin_translation_is_not_a_resize(self):
        output = report("configure", snapshot(), snapshot("180,160,820,662"))
        result = dmg.validate_layout_report(output, "configure")
        self.assertIn('"bounds": [180, 160, 820, 662]', result)

    def test_readonly_bounds_accept_negative_multimonitor_origin(self):
        result = dmg.validate_layout_report(report(after_reopen=snapshot("-1000,50,-360,552")), "verify")
        self.assertIn("origem de tela pode mudar", result)

    def test_one_pixel_size_mismatch_is_not_tolerated(self):
        with self.assertRaisesRegex(dmg.BuildError, "verify:after-reopen.*atual=639x502"):
            dmg.validate_layout_report(report(after_reopen=snapshot("120,120,759,622")), "verify")

    def test_titlebar_sized_delta_is_diagnosed_not_guessed_away(self):
        with self.assertRaisesRegex(dmg.BuildError, "atual=640x480.*Sem tolerância"):
            dmg.validate_layout_report(report("configure", snapshot("120,142,760,622"), snapshot("120,142,760,622")), "configure")

    def test_after_set_mismatch_is_distinct_from_persistence_mismatch(self):
        with self.assertRaisesRegex(dmg.BuildError, "configure:after-set"):
            dmg.validate_layout_report(report("configure", snapshot("120,120,760,612")), "configure")
        with self.assertRaisesRegex(dmg.BuildError, "configure:after-reopen"):
            dmg.validate_layout_report(report("configure", snapshot(), snapshot("120,120,760,612")), "configure")

    def test_malformed_or_wrong_phase_finder_report_is_rejected(self):
        for output in (b"OK", b"OK\tverify\t120,120,760,622\t120,120,760,622",
                       b"OK\tconfigure\tn/a\t120,120,760,622", b"OK\tverify\tn/a\t1,2,3",
                       b"OK\tverify\tn/a\ta,b,c,d"):
            with self.subTest(output=output), self.assertRaises(dmg.BuildError):
                dmg.validate_layout_report(output, "verify")

    def test_all_icon_and_option_mismatches_are_reported_together(self):
        before = snapshot(app="171,240", icon_size=96)
        after = snapshot(app="170,241", applications="469,240", arrangement_none=0,
                         arrangement_text="arranged by name", toolbar=1, background=0)
        with self.assertRaises(dmg.BuildError) as raised:
            dmg.validate_layout_report(report("configure", before, after), "configure")
        error = str(raised.exception)
        for expected in ("configure:after-set: posição app atual=(171, 240)", "icon_size atual=96",
                         "configure:after-reopen: posição app atual=(170, 241)",
                         "posição applications atual=(469, 240)", "arrangement_none atual=0",
                         "toolbar atual=1", "background atual=0", "arranged by name",
                         "após definir=", "após reabrir="):
            self.assertIn(expected, error)

    def test_folder_selector_is_diagnostic_not_a_window_position_substitute(self):
        result = dmg.validate_layout_report(report(after_reopen=snapshot(folder_app="11,12", folder_applications="n/a")), "verify")
        self.assertIn('"folder_app": [11, 12]', result)
        self.assertIn('"folder_applications": null', result)
        with self.assertRaisesRegex(dmg.BuildError, "posição app atual=None"):
            dmg.validate_layout_report(report(after_reopen=snapshot(app="n/a")), "verify")

    def test_required_metadata_and_phase_cannot_be_silently_defaulted(self):
        malformed = [
            snapshot().replace(";icon_size=72", ""), snapshot() + ";app=170,240",
            snapshot(app="170"), snapshot(app="170,240,0"), snapshot(toolbar="false"),
            snapshot(bounds="1,2,3"), snapshot(bounds="a,b,c,d"),
        ]
        for text in malformed:
            with self.subTest(text=text), self.assertRaises(dmg.BuildError):
                dmg.validate_layout_report(report(after_reopen=text), "verify")
        for output, mode in ((report("configure"), "configure"), (report(after_set=snapshot()), "verify")):
            with self.subTest(mode=mode), self.assertRaisesRegex(dmg.BuildError, "fase/leitura inesperada"):
                dmg.validate_layout_report(output, mode)

    def test_finder_layout_reports_mode_mount_and_both_snapshots_on_validation_failure(self):
        mount = dmg.OwnedMount(Path("/tmp/owned.dmg"), Path("/tmp/private/mount-ro"))
        with patch.object(dmg, "run", return_value=report(after_reopen=snapshot(app="171,240"))):
            with self.assertRaisesRegex(dmg.BuildError, "Fase Finder=verify, mount=/tmp/private/mount-ro.*posição app atual="):
                dmg.finder_layout("verify", mount, HERE / "dmg-layout.applescript")

    def test_every_visual_option_is_verified_after_reopen(self):
        keys = ("view_icon", "arrangement_none", "icon_size", "text_size", "toolbar",
                "statusbar", "sidebar", "labels_bottom", "item_info", "background")
        defaults = dmg.parse_snapshot(snapshot())
        for key in keys:
            with self.subTest(key=key), self.assertRaisesRegex(dmg.BuildError, key + " atual="):
                dmg.validate_layout_report(report(after_reopen=snapshot(**{key: defaults[key] + 1})), "verify")

    def test_source_orders_geometry_before_explicit_window_positions(self):
        source = (HERE / "dmg-layout.applescript").read_text()
        arrangement = source.index("set arrangement of viewOptions to not arranged")
        bounds = source.index("set bounds of targetWindow to expectedBounds")
        app = source.index('set position of item "Remote Mouse.app" of targetWindow to {170, 240}')
        applications = source.index('set position of item "Applications" of targetWindow to {470, 240}')
        capture = source.index("set afterSet to my stableSnapshot")
        self.assertLess(arrangement, bounds)
        self.assertLess(bounds, app)
        self.assertLess(bounds, applications)
        self.assertLess(applications, capture)
        self.assertNotIn("set desktop position", source)
        verify_start = source.index('set currentPhase to layoutMode & ":after-reopen"')
        verify_end = source.index("on error errorMessage", verify_start)
        self.assertNotIn("set position of", source[verify_start:verify_end])
        self.assertNotIn("set bounds of", source[verify_start:verify_end])
        # Static source checks do NOT prove AppleScript compilation or Finder behavior.

    def test_applescript_snapshot_fields_match_strict_python_protocol(self):
        source = (HERE / "dmg-layout.applescript").read_text()
        serialized_keys = set(re.findall(r'[";]([a-z_]+)=', source))
        self.assertEqual(serialized_keys, dmg.SNAPSHOT_KEYS)
        self.assertEqual(set(dmg.parse_snapshot(snapshot())), serialized_keys)
        # Source inspection, not a native AppleScript compiler or execution test.

    def test_applescript_and_python_share_exact_requested_rectangle(self):
        source = (HERE / "dmg-layout.applescript").read_text()
        rectangle = re.search(r"set expectedBounds to \{([0-9, ]+)\}", source).group(1)
        self.assertEqual(dmg.read_rectangle(rectangle), dmg.EXPECTED_BOUNDS)
        self.assertEqual(source.count("set bounds of targetWindow to"), 1)
        self.assertNotIn("750, 612", source) # no intermediate shrink race

    def test_waits_for_actual_metadata_file_to_stop_changing(self):
        with tempfile.TemporaryDirectory() as directory:
            mount = dmg.OwnedMount(Path(directory) / "image.dmg", Path(directory))
            now = [0.0]
            writes = [0]
            def pause(seconds):
                now[0] += seconds
                if writes[0] < 3:
                    writes[0] += 1
                    (mount.path / ".DS_Store").write_bytes(b"x" * writes[0])
            dmg.wait_for_store(mount, clock=lambda: now[0], pause=pause)
            self.assertEqual(writes[0], 3)
            self.assertGreaterEqual(now[0], 1.0)

    def test_metadata_wait_timeout_reports_configure_phase(self):
        with tempfile.TemporaryDirectory() as directory:
            mount = dmg.OwnedMount(Path(directory) / "image.dmg", Path(directory))
            now = [0.0]
            def pause(seconds):
                now[0] += seconds
            with self.assertRaisesRegex(dmg.BuildError, "configure:DS_Store"):
                dmg.wait_for_store(mount, timeout=1, clock=lambda: now[0], pause=pause)

    def test_command_timeout_becomes_clear_error(self):
        with patch.object(dmg.subprocess, "run", side_effect=dmg.subprocess.TimeoutExpired("osascript", 90)):
            with self.assertRaisesRegex(dmg.BuildError, "Timeout"):
                dmg.run(["/usr/bin/osascript"], timeout=90)


if __name__ == "__main__":
    unittest.main()
