#!/usr/bin/env python3
"""Build a Finder-laid-out, verified, read-only DMG using Apple tools + Python stdlib.
Requires a logged-in macOS desktop and permission for the terminal to automate Finder.
"""
import argparse
from dataclasses import dataclass
import os
from pathlib import Path
import plistlib
import shutil
import struct
import subprocess
import sys
import tempfile
import time


class BuildError(RuntimeError):
    pass


def run(arguments, timeout=120):
    try:
        result = subprocess.run([str(arg) for arg in arguments], stdin=subprocess.DEVNULL,
                                capture_output=True, timeout=timeout, check=True)
    except subprocess.TimeoutExpired as error:
        raise BuildError(f"Timeout ({timeout}s): {arguments[0]}. Verifique Finder/Automation e montagens.") from error
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


def attach(mount, readonly):
    mount.path.mkdir()
    flags = ["-readonly"] if readonly else ["-readwrite"]
    output = run(["/usr/bin/hdiutil", "attach", *flags, "-nobrowse", "-noautoopen",
                  "-mountpoint", mount.path, "-plist", mount.image], timeout=90)
    info = plistlib.loads(output)
    matching = [entry for entry in info.get("system-entities", [])
                if entry.get("mount-point") == str(mount.path)]
    if len(matching) != 1 or mount.path.resolve() not in attached_paths(mount.image):
        raise BuildError("hdiutil não confirmou o mountpoint privado solicitado.")


EXPECTED_BOUNDS = (120, 120, 760, 622)
EXPECTED_SIZE = (640, 502) # script-coordinate contract; 640×480 art + nominal chrome


def read_rectangle(text):
    try:
        rectangle = tuple(int(value) for value in text.split(","))
    except ValueError as error:
        raise BuildError(f"Bounds inválidos do Finder: {text!r}") from error
    if len(rectangle) != 4:
        raise BuildError(f"Bounds do Finder precisam de quatro coordenadas: {text!r}")
    return rectangle


def require_dimensions(rectangle, phase, report):
    width, height = rectangle[2] - rectangle[0], rectangle[3] - rectangle[1]
    if (width, height) != EXPECTED_SIZE:
        raise BuildError(f"Finder[{phase}] dimensão incorreta: atual={width}x{height}, esperado=640x502 "
                         f"nas coordenadas bounds; arte nominal=640x480. {report}. "
                         "Não foi aplicada compensação presumida de título/chrome. Copie este diagnóstico completo.")


def validate_layout_report(output, mode):
    fields = output.decode(errors="replace").strip().split("\t")
    if len(fields) != 4 or fields[:2] != ["OK", mode]:
        raise BuildError(f"Finder[{mode}] relatório inválido: {output!r}")
    after_set = None if fields[2] == "n/a" else read_rectangle(fields[2])
    after_reopen = read_rectangle(fields[3])
    report = (f"pedido={EXPECTED_BOUNDS}; após definir={after_set}; após reabrir={after_reopen}; "
              "toolbar/sidebar/status ocultos e ícones/fundo verificados; origem de tela pode mudar")
    if mode == "configure":
        if after_set is None:
            raise BuildError(f"Finder[configure] leitura após definir ausente; {report}")
        require_dimensions(after_set, "configure:after-set", report)
    elif mode != "verify" or after_set is not None:
        raise BuildError(f"Finder[{mode}] fase/leitura inesperada; {report}")
    require_dimensions(after_reopen, mode + ":after-reopen", report)
    # A translated rectangle is not a resized window. Never demand a fixed screen
    # origin after remount, and never accept a width/height mismatch as a tolerance.
    return report


def finder_layout(mode, mount, script):
    try:
        result = run(["/usr/bin/osascript", script, mode, mount.path], timeout=90)
    except BuildError as error:
        raise BuildError(f"Fase Finder={mode}, mount={mount.path}: {error}") from error
    report = validate_layout_report(result, mode)
    print(f"Finder[{mode}] {report}")


def wait_for_store(mount, timeout=10, clock=time.monotonic, pause=time.sleep):
    deadline = clock() + timeout
    previous, stable = None, 0
    while clock() < deadline:
        try:
            stat = (mount.path / ".DS_Store").stat()
            fingerprint = (stat.st_size, stat.st_mtime_ns) if stat.st_size > 0 else None
        except FileNotFoundError:
            fingerprint = None
        stable = stable + 1 if fingerprint is not None and fingerprint == previous else 0
        if stable >= 3:
            return
        previous = fingerprint
        pause(0.2)
    raise BuildError(f"Finder[configure:DS_Store] metadados não estabilizaram em {timeout}s: {mount.path}")


def verify_contents(mount, background):
    visible = sorted(item.name for item in mount.path.iterdir() if not item.name.startswith("."))
    if visible != ["Applications", "Remote Mouse.app"]:
        raise BuildError(f"Itens auxiliares visíveis no instalador: {visible}")
    link = mount.path / "Applications"
    if not link.is_symlink() or os.readlink(link) != "/Applications":
        raise BuildError("Applications não aponta para /Applications.")
    store = mount.path / ".DS_Store"
    if not store.is_file() or store.stat().st_size == 0:
        raise BuildError("Finder não gravou .DS_Store. Recusando DMG sem layout persistido.")
    if (mount.path / ".background/background.png").read_bytes() != background.read_bytes():
        raise BuildError("Fundo do volume difere do asset aprovado.")


def build(app, background, output, script):
    if output.exists() or output.is_symlink():
        raise BuildError(f"DMG já existe; arquive-o antes de reconstruir: {output}")
    if not app.is_dir() or app.is_symlink():
        raise BuildError(f"Aplicativo ausente ou não é um bundle local: {app}")
    if png_dimensions(background) != (640, 480):
        raise BuildError("O fundo deve medir 640×480 pixels.")
    run(["/usr/bin/codesign", "--verify", "--deep", "--strict", app])
    work = Path(tempfile.mkdtemp(prefix=".dmg-layout-", dir=output.parent))
    owned = []
    try:
        content = work / "content"
        (content / ".background").mkdir(parents=True)
        run(["/usr/bin/ditto", app, content / "Remote Mouse.app"], timeout=600)
        shutil.copyfile(background, content / ".background/background.png")
        (content / "Applications").symlink_to("/Applications")
        writable = work / "layout.dmg"
        run(["/usr/bin/hdiutil", "create", "-volname", "Remote Mouse", "-fs", "HFS+",
             "-srcfolder", content, "-format", "UDRW", writable], timeout=600)
        editable_mount = OwnedMount(writable, work / "mount-rw")
        owned.append(editable_mount) # track before attach, including partial attach failure
        attach(editable_mount, readonly=False)
        finder_layout("configure", editable_mount, script)
        wait_for_store(editable_mount)
        verify_contents(editable_mount, background)
        detach(editable_mount)
        compressed = work / "ready.dmg"
        run(["/usr/bin/hdiutil", "convert", writable, "-format", "UDZO",
             "-imagekey", "zlib-level=9", "-o", compressed], timeout=600)
        readonly_mount = OwnedMount(compressed, work / "mount-ro")
        owned.append(readonly_mount)
        attach(readonly_mount, readonly=True)
        verify_contents(readonly_mount, background)
        run(["/usr/bin/codesign", "--verify", "--deep", "--strict", readonly_mount.path / "Remote Mouse.app"])
        finder_layout("verify", readonly_mount, script) # no rewriting on this mount
        detach(readonly_mount)
        identity = os.environ.get("CODESIGN_IDENTITY", "")
        if identity and identity != "-":
            run(["/usr/bin/codesign", "--force", "--timestamp", "--sign", identity, compressed])
        run(["/usr/bin/hdiutil", "verify", compressed], timeout=600)
        # Atomic no-overwrite publication on the same filesystem, after all checks.
        os.link(compressed, output)
        print(f"DMG gerado: {output} (layout verificado; não implica notarização)")
    finally:
        cleanup_errors = []
        for mount in reversed(owned):
            try:
                detach(mount)
                # If attach unexpectedly used another path, preserve the workspace.
                if attached_paths(mount.image):
                    raise BuildError(f"Imagem ainda montada em caminho inesperado: {mount.image}")
            except Exception as error:
                cleanup_errors.append(str(error))
        if cleanup_errors:
            # Never recurse/delete a workspace while any of its images may be mounted.
            raise BuildError("Não foi possível confirmar desmontagem. Temporários preservados em "
                             f"{work}. " + "; ".join(cleanup_errors))
        shutil.rmtree(work) # only our unique mkdtemp, after confirming images are detached


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app", type=Path, required=True)
    parser.add_argument("--background", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if sys.platform != "darwin":
        raise BuildError("A geração com layout exige macOS e uma sessão gráfica do Finder.")
    build(args.app.resolve(), args.background.resolve(), args.output.absolute(),
          Path(__file__).with_name("dmg-layout.applescript").resolve())


if __name__ == "__main__":
    try:
        main()
    except (BuildError, OSError, ValueError) as error:
        print(f"Erro: {error}", file=sys.stderr)
        sys.exit(1)
