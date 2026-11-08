#!/usr/bin/env python3
"""Portable CoreFoundation call/ownership stubs, NOT native ABI/runtime tests."""
import ctypes as C
import subprocess
import unittest
from unittest.mock import patch
from types import SimpleNamespace

import alias_resolution as resolver


def fake_cf(fail=None):
    released = []
    def data(allocator, buffer, length):
        assert C.string_at(buffer, length) == b"alias"
        return None if fail == "data" else 11
    def bookmark(allocator, value):
        assert value == 11
        return None if fail == "bookmark" else 22
    def resolve(allocator, value, flags, relative, properties, stale, error):
        assert value == 22 and flags == 768 and relative is None and properties is None
        C.cast(stale, C.POINTER(C.c_ubyte)).contents.value = 1
        if fail == "resolve":
            C.cast(error, C.POINTER(C.c_void_p)).contents.value = 44
            return None
        return 33
    def filesystem(url, resolve_base, output, length):
        assert url == 33 and resolve_base
        C.memmove(output, b"/tmp/fixture/background.png\0", 28)
        return fail != "path"
    def release(value): released.append(value)
    def error_code(value): return -43
    return SimpleNamespace(CFDataCreate=data, CFURLCreateBookmarkDataFromAliasRecord=bookmark,
                           CFURLCreateByResolvingBookmarkData=resolve, CFURLGetFileSystemRepresentation=filesystem,
                           CFErrorGetCode=error_code, CFRelease=release), released


class AliasResolutionTests(unittest.TestCase):
    def test_resolver_uses_no_ui_no_mount_flags_and_releases_all_objects(self):
        cf, released = fake_cf()
        self.assertEqual(resolver.resolve_native(b"alias", cf), {"path": "/tmp/fixture/background.png", "stale": True})
        self.assertEqual(released, [33, 22, 11])

    def test_native_failures_are_not_downgraded_to_parser_success(self):
        for failure, references in (("data", []), ("bookmark", [11]), ("resolve", [44, 22, 11]), ("path", [33, 22, 11])):
            with self.subTest(failure=failure):
                cf, released = fake_cf(failure)
                with self.assertRaises(RuntimeError):
                    resolver.resolve_native(b"alias", cf)
                self.assertEqual(released, references)

    def test_timeout_is_bounded_and_has_no_fallback(self):
        with patch.object(resolver.subprocess, "run", side_effect=subprocess.TimeoutExpired("resolver", 20)):
            with self.assertRaisesRegex(RuntimeError, "20s"):
                resolver.resolve_alias(b"alias", "/tmp/bg.png")

    def test_subprocess_uses_argument_list_binary_stdin_and_timeout(self):
        with patch.object(resolver.subprocess, "run", return_value=SimpleNamespace(stdout=b'{"path":"/tmp/bg.png","stale":false}')) as run:
            self.assertEqual(resolver.resolve_alias(b"alias", "/tmp/bg.png")["path"], "/tmp/bg.png")
            args, kwargs = run.call_args
            self.assertIsInstance(args[0], list)
            self.assertEqual(kwargs["input"], b"alias")
            self.assertEqual(kwargs["timeout"], 20)
            self.assertNotIn("shell", kwargs)


if __name__ == "__main__":
    unittest.main()
