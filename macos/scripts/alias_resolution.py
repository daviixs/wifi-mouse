"""Resolve a stored Alias through CoreFoundation, without UI or mounting disks.
Native declarations/constants: Apple CFURL.h (macOS 10.6+). No Finder scripting.
A separate process bounds native resolution time; no parser-only fallback.
"""
import ctypes as C
import json
import os
from pathlib import Path
import subprocess
import sys

NO_UI_OR_MOUNT = (1 << 8) | (1 << 9)


def resolve_native(data, cf=None):
    if cf is None:
        if sys.platform != "darwin":
            raise RuntimeError("A resolução nativa de Alias exige macOS; parsing não substitui resolução.")
        cf = C.CDLL("/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation")
    ptr = C.c_void_p
    signatures = {
        "CFDataCreate": (ptr, [ptr, ptr, C.c_long]),
        "CFURLCreateBookmarkDataFromAliasRecord": (ptr, [ptr, ptr]),
        "CFURLCreateByResolvingBookmarkData": (ptr, [ptr, ptr, C.c_ulong, ptr, ptr, C.POINTER(C.c_ubyte), C.POINTER(ptr)]),
        "CFURLGetFileSystemRepresentation": (C.c_ubyte, [ptr, C.c_ubyte, ptr, C.c_long]),
        "CFErrorGetCode": (C.c_long, [ptr]),
        "CFRelease": (None, [ptr]),
    }
    for name, (result, args) in signatures.items():
        function = getattr(cf, name)
        function.restype, function.argtypes = result, args
    owned = []
    try:
        def retain_result(value, phase):
            if not value:
                raise RuntimeError(f"CoreFoundation {phase} retornou NULL")
            owned.append(value)
            return value
        buffer = C.create_string_buffer(data)
        alias = retain_result(cf.CFDataCreate(None, buffer, len(data)), "CFDataCreate")
        bookmark = retain_result(cf.CFURLCreateBookmarkDataFromAliasRecord(None, alias), "Alias→Bookmark")
        stale, error = C.c_ubyte(), ptr()
        url = cf.CFURLCreateByResolvingBookmarkData(None, bookmark, NO_UI_OR_MOUNT, None, None, C.byref(stale), C.byref(error))
        if error.value:
            owned.append(error.value)
        if not url:
            code = cf.CFErrorGetCode(error) if error.value else "sem CFError"
            raise RuntimeError(f"CoreFoundation não resolveu background Alias (CFError code={code}); consulte identidade do Alias e montagens desta imagem no diagnóstico")
        owned.append(url)
        path = C.create_string_buffer(65536)
        if not cf.CFURLGetFileSystemRepresentation(url, True, path, len(path)):
            raise RuntimeError("CoreFoundation não retornou caminho POSIX para background Alias")
        return {"path": os.fsdecode(path.value), "stale": bool(stale.value)}
    finally:
        for value in reversed(owned):
            cf.CFRelease(value)


def resolve_alias(data, expected_path):
    try:
        result = subprocess.run([sys.executable, str(Path(__file__).resolve())], input=data,
                                capture_output=True, check=True, timeout=20)
    except subprocess.TimeoutExpired as error:
        raise RuntimeError("Resolução nativa do fundo excedeu 20s; nenhum volume foi solicitado para montagem") from error
    except subprocess.CalledProcessError as error:
        raise RuntimeError(f"Resolução de {expected_path}: " + error.stderr.decode(errors="replace").strip()) from error
    return json.loads(result.stdout)


if __name__ == "__main__":
    try:
        print(json.dumps(resolve_native(sys.stdin.buffer.read())))
    except Exception as error:
        print(f"{type(error).__name__}: {error}", file=sys.stderr)
        sys.exit(1)
