"""dmgbuild-compatible metadata; no Finder automation or screen-coordinate guesses.

The vendored MIT codecs write/read real .DS_Store and Alias binary records.
Alias.for_file is deliberately native on macOS, never fabricated for a build.
"""
import hashlib
import json
import os
from pathlib import Path
import sys
import unicodedata

VENDOR = Path(__file__).with_name("vendor")
WHEELS = {
    "ds_store-1.3.1-py3-none-any.whl": "fbacbb0bd5193ab3e66e5a47fff63619f15e374ffbec8ae29744251a6c8f05b5",
    "mac_alias-2.2.2-py3-none-any.whl": "504ab8ac546f35bbd75ad014d6ad977c426660aa721f2cd3acf3dc2f664141bd",
}
for name, expected in WHEELS.items():
    path = VENDOR / name
    if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
        raise RuntimeError(f"Codec DMG ausente/alterado: {path}; reaplique o patch completo.")
    sys.path.insert(0, str(path))
from ds_store import DSStore
from mac_alias import Alias


class MetadataError(RuntimeError):
    pass


POSITIONS = {"Remote Mouse.app": (170, 240), "Applications": (470, 240)}
# This is the nominal persisted rectangle used by dmgbuild, not AppleScript's
# window bounds. Native frame/content chrome still needs a visual Mac check.
# No presumed 22-point title bar or 13-point icon correction.
WINDOW = {
    "WindowBounds": "{{120, 120}, {640, 480}}",
    "ShowStatusBar": False, "ShowTabView": False, "ShowToolbar": False,
    "ShowPathbar": False, "ShowSidebar": False, "SidebarWidth": 0,
    "ContainerShowSidebar": False, "PreviewPaneVisibility": False,
}
ICON_VIEW = {
    "viewOptionsVersion": 1, "backgroundType": 2,
    "backgroundColorRed": 1.0, "backgroundColorGreen": 1.0, "backgroundColorBlue": 1.0,
    "gridOffsetX": 0.0, "gridOffsetY": 0.0, "gridSpacing": 80.0,
    "arrangeBy": "none", "showIconPreview": False, "showItemInfo": False,
    "labelOnBottom": True, "textSize": 12.0, "iconSize": 72.0,
    "scrollPositionX": 0.0, "scrollPositionY": 0.0,
}
RELATIVE_BACKGROUND = ".background/background.png"


def text(value):
    if isinstance(value, bytes):
        value = value.decode("utf-8")
    return unicodedata.normalize("NFC", value)


def identity(alias):
    return {
        "volume": text(alias.volume.name),
        "volume_created": alias.volume.creation_date.isoformat(),
        "filesystem": alias.volume.fs_type.hex(),
        "file": text(alias.target.filename),
        "folder_id": alias.target.folder_cnid,
        "file_id": alias.target.cnid,
        "file_created": alias.target.creation_date.isoformat(),
        "relative_path": text(alias.target.posix_path).lstrip("/"),
        "kind": alias.target.kind,
    }


def background_file(root):
    path = root / RELATIVE_BACKGROUND
    if (root / ".background").is_symlink() or path.is_symlink() or not path.is_file():
        raise MetadataError(f"Fundo precisa ser arquivo do próprio volume, sem symlink: {path}")
    if path.resolve().parent.parent != root.resolve():
        raise MetadataError(f"Fundo fora do volume: {path}")
    return path


def native_alias(path, alias_factory):
    # Canonicalize both writer and verifier through the real codec. Alias dates
    # have 1/65536-second precision, unlike filesystem timestamps.
    try:
        return Alias.from_bytes(alias_factory(str(path)).to_bytes())
    except Exception as error:
        raise MetadataError(f"Identidade nativa do fundo indisponível em {path}: {type(error).__name__}: {error}") from error


def write_layout(root, alias_factory=None):
    root = Path(root)
    alias = native_alias(background_file(root), alias_factory or Alias.for_file)
    if text(alias.target.posix_path) not in (RELATIVE_BACKGROUND, "/" + RELATIVE_BACKGROUND):
        raise MetadataError(f"Alias nativo não é relativo ao volume: {identity(alias)}")
    # The volume's real identity + CNIDs and volume-relative target are retained.
    # An optional obsolete host mountpoint hint is not a background dependency.
    alias.volume.posix_path = None
    alias.volume.disk_image_alias = None
    options = dict(ICON_VIEW, backgroundImageAlias=alias.to_bytes())
    path = root / ".DS_Store"
    if path.is_symlink():
        raise MetadataError(f".DS_Store não pode ser symlink: {path}")
    with path.open("w+b") as stream, DSStore.open(stream, "w+") as store:
        store["."]["vSrn"] = ("long", 1)
        store["."]["bwsp"] = dict(WINDOW)
        store["."]["icvp"] = options
        store["."]["icvl"] = ("type", b"icnv")
        for name, position in POSITIONS.items():
            store[name]["Iloc"] = position
    with path.open("r+b") as stream:
        os.fsync(stream.fileno())
    return verify_layout(root, alias_factory=alias_factory)


def verify_layout(root, alias_factory=None):
    root = Path(root)
    background = background_file(root)
    path = root / ".DS_Store"
    if path.is_symlink() or not path.is_file():
        raise MetadataError(f".DS_Store precisa ser arquivo regular: {path}")
    try:
        with path.open("rb") as stream, DSStore.open(stream, "r") as store:
            def get(name, key):
                try:
                    return store[name][key]
                except KeyError:
                    return None
            window = get(".", "bwsp")
            options = get(".", "icvp")
            view = get(".", "icvl")
            version = get(".", "vSrn")
            positions = {name: get(name, "Iloc") for name in POSITIONS}
    except Exception as error:
        raise MetadataError(f".DS_Store ilegível em {root}: {error}") from error
    failures = []
    for name, expected in (("bwsp", WINDOW), ("icvp", ICON_VIEW)):
        actual = window if name == "bwsp" else options
        if not isinstance(actual, dict):
            failures.append(f"{name} ausente/inválido: {actual!r}")
            continue
        for key, value in expected.items():
            if actual.get(key) != value:
                failures.append(f"{name}.{key}: atual={actual.get(key)!r}, esperado={value!r}")
    for name, expected in POSITIONS.items():
        if positions[name] != expected:
            failures.append(f"Iloc {name}: atual={positions[name]!r}, esperado={expected!r}")
    for name, actual, expected in (("icvl", view, (b"type", b"icnv")), ("vSrn", version, (b"long", 1))):
        if actual != expected:
            failures.append(f"{name}: atual={actual!r}, esperado={expected!r}")
    alias_report = None
    try:
        alias = Alias.from_bytes(options["backgroundImageAlias"])
        alias_report = identity(alias)
        expected = identity(native_alias(background, alias_factory or Alias.for_file))
        if alias_report != expected:
            failures.append(f"background Alias atual={alias_report}, arquivo real no volume={expected}")
        if text(alias.target.posix_path) not in (RELATIVE_BACKGROUND, "/" + RELATIVE_BACKGROUND):
            failures.append(f"background fora da raiz do volume: {alias_report}")
        if alias.volume.posix_path is not None or alias.volume.disk_image_alias is not None:
            failures.append("background contém referência opcional ao mountpoint/imagem do host")
    except Exception as error:
        failures.append(f"background Alias inválido/identidade nativa indisponível: {type(error).__name__}: {error}")
    summary = {
        "positions_Iloc": positions, "window": window,
        "icon_view": {key: value for key, value in (options or {}).items() if key != "backgroundImageAlias"} if isinstance(options, dict) else options,
        "background_alias": alias_report,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
    }
    if failures:
        raise MetadataError(" | ".join(failures) + "; leitura=" + json.dumps(summary, ensure_ascii=False, default=repr))
    return summary
