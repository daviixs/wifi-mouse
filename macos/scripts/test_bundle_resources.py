#!/usr/bin/env python3
"""Fixtures model SwiftPM native (flat) and macOS SwiftBuild (Contents/Resources).
They reproduce the old false-negative guard without requiring a Mac toolchain.
"""
import json
from pathlib import Path
import plistlib
import shutil
import tempfile
import unittest
from unittest.mock import patch
import bundle_resources
from bundle_resources import LANGUAGES, ResourceError, read_strings, resource_root, validate_bundle

SOURCE = Path(__file__).resolve().parents[1] / "RemoteMouse/Sources/RemoteMouse/Resources"


class BundleResourcesTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)

    def fixture(self, deep=False, spelling="pt-br", compiled=False, name="RemoteMouse_RemoteMouse.bundle"):
        bundle = self.directory / name
        root = bundle / "Contents/Resources" if deep else bundle
        root.mkdir(parents=True)
        info = bundle / "Contents/Info.plist" if deep else bundle / "Info.plist"
        info.write_bytes(plistlib.dumps({"CFBundleDevelopmentRegion": "en", "CFBundlePackageType": "BNDL"}))
        for language in LANGUAGES:
            folder = root / f"{spelling if language == 'pt-BR' else language}.lproj"
            folder.mkdir()
            source = SOURCE / f"{language}.lproj/Localizable.strings"
            if compiled:
                (folder / "Localizable.strings").write_bytes(plistlib.dumps(read_strings(source), fmt=plistlib.FMT_BINARY))
            else:
                shutil.copyfile(source, folder / "Localizable.strings")
        return bundle, root

    def test_native_flat_normalized_locale_is_already_accepted_by_old_case_guard(self):
        bundle, root = self.fixture(spelling="pt-br")
        self.assertTrue((bundle / "pt-br.lproj/Localizable.strings").is_file())
        resolved, counts = validate_bundle(bundle, SOURCE)
        self.assertEqual(resolved, root)
        self.assertEqual(counts, {language: len(read_strings(SOURCE / f"{language}.lproj/Localizable.strings")) for language in LANGUAGES})

    def test_real_swiftbuild_structure_reproduces_old_pt_br_error(self):
        bundle, root = self.fixture(deep=True, spelling="pt-br")
        # Exact former build-app.sh assumption: only check directly below .bundle.
        old_guard = any((bundle / f"{code}.lproj/Localizable.strings").is_file() for code in ("pt-br", "pt-BR"))
        self.assertFalse(old_guard)
        self.assertTrue((root / "pt-br.lproj/Localizable.strings").is_file())
        resolved, counts = validate_bundle(bundle, SOURCE)
        self.assertEqual(resolved, root)
        self.assertEqual(counts["pt-BR"], len(read_strings(SOURCE / "pt-BR.lproj/Localizable.strings")))

    def test_canonical_and_underscore_spelling_and_binary_strings(self):
        for index, spelling in enumerate(("pt-BR", "pt_BR", "PT-br")):
            with self.subTest(spelling=spelling):
                bundle, root = self.fixture(deep=True, spelling=spelling, compiled=True, name=f"variant{index}.bundle")
                self.assertEqual(validate_bundle(bundle, SOURCE)[0], root)

    def test_copied_installed_bundle_keeps_nested_structure_and_values(self):
        bundle, _ = self.fixture(deep=True, compiled=True)
        destination = self.directory / "Remote Mouse.app/Contents/Resources/RemoteMouse_RemoteMouse.bundle"
        shutil.copytree(bundle, destination)
        self.assertEqual(validate_bundle(destination, SOURCE)[0], destination / "Contents/Resources")

    def test_missing_locale_is_not_hidden_by_english_fallback(self):
        bundle, root = self.fixture(deep=True)
        shutil.rmtree(root / "pt-br.lproj")
        with self.assertRaisesRegex(ResourceError, "Tradução ausente: pt-BR.*Contents/Resources"):
            validate_bundle(bundle, SOURCE)

    def test_missing_table_reports_actual_resolved_path(self):
        bundle, root = self.fixture(deep=True)
        (root / "pt-br.lproj/Localizable.strings").unlink()
        with self.assertRaisesRegex(ResourceError, "Tabela de tradução ausente.*Contents/Resources/pt-br.lproj"):
            validate_bundle(bundle, SOURCE)

    def test_missing_key_is_rejected(self):
        bundle, root = self.fixture(compiled=True)
        table = read_strings(root / "pt-br.lproj/Localizable.strings")
        del table["button.quit"]
        (root / "pt-br.lproj/Localizable.strings").write_bytes(plistlib.dumps(table))
        with self.assertRaisesRegex(ResourceError, "Chaves incorretas: pt-BR"):
            validate_bundle(bundle, SOURCE)

    def test_stale_or_swapped_translation_is_rejected(self):
        bundle, root = self.fixture(deep=True, compiled=True)
        shutil.copyfile(root / "en.lproj/Localizable.strings", root / "pt-br.lproj/Localizable.strings")
        with self.assertRaisesRegex(ResourceError, "Tradução divergente/desatualizada: pt-BR"):
            validate_bundle(bundle, SOURCE)

    def test_ambiguous_normalized_locales_are_rejected(self):
        bundle, root = self.fixture()
        (root / "pt_BR.lproj").mkdir()
        with self.assertRaisesRegex(ResourceError, "Idioma duplicado"):
            validate_bundle(bundle, SOURCE)

    def test_hybrid_flat_and_nested_bundle_is_rejected(self):
        bundle, _ = self.fixture(deep=True)
        (bundle / "pt-br.lproj").mkdir()
        with self.assertRaisesRegex(ResourceError, "Bundle ambíguo"):
            resource_root(bundle)

    def test_macos_text_tables_use_native_plutil_for_utf16(self):
        table = {"fixture.quit": "Sair"}
        path = self.directory / "Localizable.strings"
        path.write_bytes('"fixture.quit" = "Sair";'.encode("utf-16"))
        result = bundle_resources.subprocess.CompletedProcess([], 0, stdout=json.dumps(table).encode())
        with patch.object(bundle_resources.sys, "platform", "darwin"), \
             patch.object(bundle_resources.subprocess, "run", return_value=result) as native:
            self.assertEqual(read_strings(path), table)
            self.assertEqual(native.call_args.args[0], ["/usr/bin/plutil", "-convert", "json", "-o", "-", "--", str(path)])

    def test_external_table_symlinks_are_rejected(self):
        bundle, root = self.fixture()
        path = root / "pt-br.lproj/Localizable.strings"
        path.unlink()
        path.symlink_to(SOURCE / "pt-BR.lproj/Localizable.strings")
        with self.assertRaisesRegex(ResourceError, "link externo"):
            validate_bundle(bundle, SOURCE)


if __name__ == "__main__":
    unittest.main()
