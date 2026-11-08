#!/usr/bin/env python3
"""Build a metadata-verified, read-only DMG using Apple tools and vendored codecs.
Uses the same binary layout codecs as dmgbuild; never automates Finder.
"""
import argparse
import json
from dataclasses import dataclass
import os
from pathlib import Path
import plistlib
import shutil
import struct
import subprocess
import sys
import tempfile
import uuid

from dmg_metadata import MetadataError, write_layout, verify_layout


class BuildError(RuntimeError):
    pass


def run(arguments, timeout=120):
    try:
        result = subprocess.run([str(arg) for arg in arguments], stdin=subprocess.DEVNULL,
                                capture_output=True, timeout=timeout, check=True)
    except subprocess.TimeoutExpired as error:
        raise BuildError(f"Timeout ({timeout}s): {arguments[0]}. Verifique as ferramentas Apple e montagens.") from error
    except subprocess.CalledProcessError as error:
        diagnostic = (error.stderr or error.stdout or b"").decode(errors="replace").strip()
        raise BuildError(f"Falha em {arguments[0]}: {diagnostic}") from error
    return result.stdout


def png_dimensions(path):
    data = path.read_bytes()[:24]
    if len(data) != 24 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise BuildError("O fundo precisa ser PNG válido.")
    return struct.unpack(">II", data[16:24])


@dataclass(frozen=True)
class OwnedMount:
    image: Path
    path: Path


def image_mounts(info, image):
    """Only entries for this exact image; never match by volume name/device prefix."""
    mounts = []
    for entry in info.get("images", []):
        candidate = entry.get("image-path")
        if not candidate or Path(candidate).resolve() != image.resolve():
            continue
        mounts.extend(Path(entity["mount-point"]).resolve()
                      for entity in entry.get("system-entities", []) if "mount-point" in entity)
    return mounts


def attached_paths(image):
    return image_mounts(plistlib.loads(run(["/usr/bin/hdiutil", "info", "-plist"])), image)


def detach(mount):
    paths = attached_paths(mount.image)
    if mount.path.resolve() not in paths:
        return
    # This path was created by this build and confirmed to belong to its exact image.
    run(["/usr/bin/hdiutil", "detach", mount.path], timeout=90)
    if mount.path.resolve() in attached_paths(mount.image):
        raise BuildError(f"Volume continua montado: {mount.path}")


def new_volume_name():
    # ASCII <=27 bytes: do not truncate the v2 Alias volume-name field.
    return "Remote Mouse " + uuid.uuid4().hex[:12]


def canonical_mount_path(volume_name):
    return Path("/Volumes") / volume_name


def mount_report(mount):
    """Only report entities of this execution's exact image, never other images."""
    try:
        info = plistlib.loads(run(["/usr/bin/hdiutil", "info", "-plist"]))
        entities = []
        for image in info.get("images", []):
            candidate = image.get("image-path")
            if candidate and Path(candidate).resolve() == mount.image.resolve():
                entities.extend({key: entry[key] for key in ("dev-entry", "mount-point", "content-hint") if key in entry}
                                for entry in image.get("system-entities", []))
        return {"image": str(mount.image), "expected_mount": str(mount.path), "entities": entities}
    except Exception as error:
        return {"image": str(mount.image), "diagnostic_error": str(error)}


def attach(mount, readonly):
    if mount.path.exists() or mount.path.is_symlink():
        raise BuildError(f"Caminho canônico já ocupado; nada foi removido: {mount.path}")
    flags = ["-readonly"] if readonly else ["-readwrite"]
    # Let hdiutil create its normal /Volumes/<filesystem-name> mount, as dmgbuild
    # does. Never mkdir/delete /Volumes entries or force an existing volume away.
    output = run(["/usr/bin/hdiutil", "attach", *flags, "-nobrowse", "-noautoopen",
                  "-plist", mount.image], timeout=90)
    info = plistlib.loads(output)
    actual = [Path(entry["mount-point"]).resolve() for entry in info.get("system-entities", []) if "mount-point" in entry]
    owned = attached_paths(mount.image)
    if actual != [mount.path.resolve()] or owned != [mount.path.resolve()]:
        raise BuildError(f"hdiutil não confirmou o mount canônico único; retorno={actual}, "
                         f"imagem própria={owned}, esperado={mount.path}. Não se aceita sufixo/caminho alternativo.")


def image_layout(mode, mount):
    try:
        report = write_layout(mount.path) if mode == "write" else verify_layout(mount.path)
    except (MetadataError, OSError, ValueError) as error:
        raise BuildError(f"Layout metadata[{mode}], mount={mount.path}: {error}; "
                         f"montagens desta imagem={json.dumps(mount_report(mount), ensure_ascii=False)}") from error
    print(f"Layout metadata[{mode}] " + json.dumps(report, ensure_ascii=False))
    return report["sha256"]


def verify_contents(mount, background):
    visible = sorted(item.name for item in mount.path.iterdir() if not item.name.startswith("."))
    if visible != ["Applications", "Remote Mouse.app"]:
        raise BuildError(f"Itens auxiliares visíveis no instalador: {visible}")
    link = mount.path / "Applications"
    if not link.is_symlink() or os.readlink(link) != "/Applications":
        raise BuildError("Applications não aponta para /Applications.")
    store = mount.path / ".DS_Store"
    if not store.is_file() or store.stat().st_size == 0:
        raise BuildError(".DS_Store ausente/vazio. Recusando DMG sem layout persistido.")
    if (mount.path / ".background/background.png").read_bytes() != background.read_bytes():
        raise BuildError("Fundo do volume difere do asset aprovado.")


def build(app, background, output):
    if output.exists() or output.is_symlink():
        raise BuildError(f"DMG já existe; arquive-o antes de reconstruir: {output}")
    if not app.is_dir() or app.is_symlink():
        raise BuildError(f"Aplicativo ausente ou não é um bundle local: {app}")
    if png_dimensions(background) != (640, 480):
        raise BuildError("O fundo deve medir 640×480 pixels.")
    run(["/usr/bin/codesign", "--verify", "--deep", "--strict", app])
    work = Path(tempfile.mkdtemp(prefix=".dmg-layout-", dir=output.parent))
    owned = []
    volume_name = new_volume_name()
    mount_path = canonical_mount_path(volume_name)
    print(f"Volume interno exclusivo: {volume_name}; mount canônico: {mount_path}")
    try:
        content = work / "content"
        (content / ".background").mkdir(parents=True)
        run(["/usr/bin/ditto", app, content / "Remote Mouse.app"], timeout=600)
        shutil.copyfile(background, content / ".background/background.png")
        (content / "Applications").symlink_to("/Applications")
        writable = work / "layout.dmg"
        run(["/usr/bin/hdiutil", "create", "-volname", volume_name, "-fs", "HFS+",
             "-srcfolder", content, "-format", "UDRW", writable], timeout=600)
        editable_mount = OwnedMount(writable, mount_path)
        owned.append(editable_mount) # track before attach, including partial attach failure
        attach(editable_mount, readonly=False)
        layout_digest = image_layout("write", editable_mount)
        verify_contents(editable_mount, background)
        detach(editable_mount)
        compressed = work / "ready.dmg"
        run(["/usr/bin/hdiutil", "convert", writable, "-format", "UDZO",
             "-imagekey", "zlib-level=9", "-o", compressed], timeout=600)
        readonly_mount = OwnedMount(compressed, mount_path)
        owned.append(readonly_mount)
        attach(readonly_mount, readonly=True)
        verify_contents(readonly_mount, background)
        run(["/usr/bin/codesign", "--verify", "--deep", "--strict", readonly_mount.path / "Remote Mouse.app"])
        final_digest = image_layout("verify", readonly_mount) # binary reads only; no Finder cache
        if final_digest != layout_digest:
            raise BuildError(".DS_Store da montagem somente leitura difere do layout gravado; recusando publicar.")
        detach(readonly_mount)
        identity = os.environ.get("CODESIGN_IDENTITY", "")
        if identity and identity != "-":
            run(["/usr/bin/codesign", "--force", "--timestamp", "--sign", identity, compressed])
        run(["/usr/bin/hdiutil", "verify", compressed], timeout=600)
        # Atomic no-overwrite publication on the same filesystem, after all checks.
        os.link(compressed, output)
        print(f"DMG gerado: {output} (metadados somente leitura verificados; não implica notarização)")
    finally:
        primary_error = sys.exc_info()[1]
        cleanup_errors = []
        for mount in reversed(owned):
            try:
                detach(mount)
                # If attach unexpectedly used another path, preserve the workspace.
                if attached_paths(mount.image):
                    raise BuildError("Imagem ainda montada em caminho inesperado; temporários preservados: "
                                     + json.dumps(mount_report(mount), ensure_ascii=False))
            except Exception as error:
                cleanup_errors.append(str(error))
        if cleanup_errors:
            # Never recurse/delete a workspace while any of its images may be mounted.
            original = f" Falha original: {primary_error}." if primary_error is not None else ""
            raise BuildError("Não foi possível confirmar desmontagem. Temporários preservados em "
                             f"{work}. " + "; ".join(cleanup_errors) + original)
        shutil.rmtree(work) # only our unique mkdtemp, after confirming images are detached


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app", type=Path, required=True)
    parser.add_argument("--background", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if sys.platform != "darwin":
        raise BuildError("A geração exige macOS para hdiutil e a identidade nativa do Alias. Finder não é automatizado.")
    build(args.app.resolve(), args.background.resolve(), args.output.absolute())


if __name__ == "__main__":
    try:
        main()
    except (BuildError, OSError, ValueError) as error:
        print(f"Erro: {error}", file=sys.stderr)
        sys.exit(1)
