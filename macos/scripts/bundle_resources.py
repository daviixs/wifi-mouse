#!/usr/bin/env python3
"""Strict resource validation for flat native SwiftPM and macOS SwiftBuild bundles.
No recursive search or English fallback: absent/stale locales are real errors.
"""
import argparse
import json
from pathlib import Path
import plistlib
import re
import subprocess
import sys

LANGUAGES = ("pt-BR", "en", "es")
PAIR = re.compile(r'("(?:\\.|[^"\\])*")\s*=\s*("(?:\\.|[^"\\])*");')


class ResourceError(ValueError):
    pass


def normalized_language(value):
    return value.replace("_", "-").casefold()


def read_strings(path):
    data = path.read_bytes()
    try:
        table = plistlib.loads(data) # binary/XML .strings emitted by Apple compilers
    except (ValueError, plistlib.InvalidFileException):
        if sys.platform == "darwin":
            try:
                result = subprocess.run(["/usr/bin/plutil", "-convert", "json", "-o", "-", "--", str(path)],
                                        capture_output=True, check=True, timeout=15)
                table = json.loads(result.stdout)
            except (subprocess.SubprocessError, ValueError) as error:
                diagnostic = (getattr(error, "stderr", None) or b"").decode(errors="replace").strip()
                raise ResourceError(f"Tabela .strings inválida: {path}: {diagnostic or error}") from error
        else:
            # Portable source/fixture parser, deliberately limited to our UTF-8 tables.
            # Unknown OpenStep formats fail; the actual Mac uses Apple's plutil above.
            text = data.decode("utf-8-sig")
            table = {}
            for match in PAIR.finditer(text):
                key, value = (json.loads(part) for part in match.groups())
                if key in table:
                    raise ResourceError(f"Chave duplicada: {path}: {key}")
                table[key] = value
            if PAIR.sub("", text).strip():
                raise ResourceError(f"Formato .strings não reconhecido: {path}")
    if not isinstance(table, dict) or not table or any(not isinstance(key, str) or not isinstance(value, str)
                                                    for key, value in table.items()):
        raise ResourceError(f"Tabela .strings vazia ou inválida: {path}")
    return table


def resource_root(bundle):
    if not bundle.is_dir() or bundle.is_symlink():
        raise ResourceError(f"Bundle de traduções ausente ou link externo: {bundle}")
    deep = bundle / "Contents/Resources"
    flat_locales = [path for path in bundle.iterdir() if path.suffix.casefold() == ".lproj"]
    if deep.is_dir():
        if flat_locales:
            raise ResourceError(f"Bundle ambíguo: há .lproj na raiz e em Contents/Resources: {bundle}")
        return deep
    return bundle


def locale_directories(root):
    result = {}
    for path in root.iterdir():
        if path.suffix.casefold() != ".lproj":
            continue
        if not path.is_dir() or path.is_symlink():
            raise ResourceError(f"Diretório de idioma inválido/link externo: {path}")
        code = normalized_language(path.stem)
        if code in result:
            raise ResourceError(f"Idioma duplicado após normalização: {result[code]} e {path}")
        result[code] = path
    return result


def validate_bundle(bundle, source):
    root = resource_root(bundle)
    directories = locale_directories(root)
    source_directories = locale_directories(source)
    counts = {}
    for language in LANGUAGES:
        code = normalized_language(language)
        if code not in directories:
            available = ", ".join(path.name for path in directories.values()) or "nenhum"
            raise ResourceError(f"Tradução ausente: {language}; raiz efetiva: {root}; idiomas encontrados: {available}")
        table_path = directories[code] / "Localizable.strings"
        if not table_path.is_file() or table_path.is_symlink():
            raise ResourceError(f"Tabela de tradução ausente ou link externo: {table_path}")
        if code not in source_directories:
            raise ResourceError(f"Fonte de tradução ausente: {source}/{language}.lproj")
        actual = read_strings(table_path)
        expected = read_strings(source_directories[code] / "Localizable.strings")
        if set(actual) != set(expected):
            missing, extra = sorted(set(expected) - set(actual)), sorted(set(actual) - set(expected))
            raise ResourceError(f"Chaves incorretas: {language}: faltando={missing}; extras={extra}; arquivo={table_path}")
        different = [key for key in expected if actual[key] != expected[key]]
        if different:
            raise ResourceError(f"Tradução divergente/desatualizada: {language}: {different}; arquivo={table_path}")
        if any(not value.strip() for value in actual.values()):
            raise ResourceError(f"Tradução vazia: {table_path}")
        counts[language] = len(actual)
    return root, counts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=Path)
    parser.add_argument("--source", type=Path, required=True)
    args = parser.parse_args()
    root, counts = validate_bundle(args.bundle, args.source)
    print(f"OK: traduções completas {counts}; raiz efetiva: {root}")


if __name__ == "__main__":
    try:
        main()
    except (ResourceError, OSError, ValueError) as error:
        print(f"Erro: {error}", file=sys.stderr)
        sys.exit(1)
