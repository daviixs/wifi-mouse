#!/usr/bin/env python3
"""Generates the Windows icon, MSIX/Store logos and Inno Setup wizard images
from the ConnectMouse logo (website/public/favicon.svg, the same artwork as the
mobile icons in scripts/generate-mobile-icons.py).

Outputs are committed, so building on Windows does not need Python. Re-run
after changing the logo:  python3 windows/scripts/generate-assets.py
Requires CairoSVG and Pillow:  pip install cairosvg pillow
"""
import io
import re
from pathlib import Path

import cairosvg
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "website" / "public" / "favicon.svg"
WINDOWS = ROOT / "windows"
ASSETS = WINDOWS / "packaging" / "Assets"
INSTALLER = WINDOWS / "installer"
ICON = WINDOWS / "resources" / "RemoteMouse.ico"

ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256]
# Below this size the arc turns into a blur; draw only a bigger cursor.
SIMPLE_BELOW = 28
# Rounded logo on a transparent background (taskbar, Start, Store listing).
LOGO = {"Square44x44Logo.png": 44, "StoreLogo.png": 50}
# Start tiles: the logo with breathing room (BackgroundColor is transparent).
TILES = {"SmallTile.png": 71, "Square150x150Logo.png": 150, "LargeTile.png": 310}
# Full-bleed brand gradient with the white glyph.
WIDE = {"Wide310x150Logo.png": (310, 150)}
# White glyph only; the manifest paints the splash background in brand blue.
SPLASH = {"SplashScreen.png": (620, 300)}
# Inno Setup wizard images at 100/125/150/200 % DPI.
WIZARD_SMALL = [55, 69, 83, 110]
WIZARD_LARGE = [(164, 314), (205, 393), (246, 471), (328, 628)]
WHITE = (255, 255, 255, 255)


def parts() -> tuple[str, str, str]:
    """(defs, rounded background, glyph) taken verbatim from favicon.svg."""
    svg = SOURCE.read_text(encoding="utf-8")
    defs = re.search(r"<defs>.*?</defs>", svg, re.S).group(0)
    background = re.search(r"<rect[^>]*/>", svg).group(0)
    glyph = "".join(re.findall(r"<path[^>]*/>", svg))
    return defs, background, glyph


DEFS, ROUNDED, GLYPH = parts()
CURSOR = re.findall(r"<path[^>]*/>", GLYPH)[0]
SQUARE = re.sub(r'\s*rx="[^"]*"', "", ROUNDED)


def scaled(content: str, scale: float, cx: float = 20.0, cy: float = 20.0) -> str:
    return f'<g transform="translate({cx} {cy}) scale({scale}) translate({-cx} {-cy})">{content}</g>'


def render(content: str, width: int, height: int, view: tuple[float, float] = (40, 40)) -> Image.Image:
    vw, vh = view
    markup = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vw} {vh}">{DEFS}{content}</svg>'
    )
    png = cairosvg.svg2png(bytestring=markup.encode(), output_width=width, output_height=height)
    return Image.open(io.BytesIO(png)).convert("RGBA")


def logo(size: int) -> Image.Image:
    if size < SIMPLE_BELOW:
        # Cursor centred (its own centre is ~20.75, 18.6) and enlarged.
        cursor = f'<g transform="translate(-0.75 1.4)">{CURSOR}</g>'
        return render(ROUNDED + scaled(cursor, 1.25), size, size)
    return render(ROUNDED + GLYPH, size, size)


def padded(size: int, ratio: float) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    inner = round(size * ratio)
    offset = (size - inner) // 2
    canvas.alpha_composite(logo(inner), (offset, offset))
    return canvas


def banner(width: int, height: int, glyph_scale: float, background: bool) -> Image.Image:
    """Gradient (optional) filling width x height with the glyph centred.

    The 40-unit logo square is fitted to the shorter side; `glyph_scale` is
    relative to that square.
    """
    if width >= height:
        view = (40 * width / height, 40.0)
    else:
        view = (40.0, 40 * height / width)
    shift_x, shift_y = (view[0] - 40) / 2, (view[1] - 40) / 2
    back = (
        f'<rect width="{view[0]}" height="{view[1]}" fill="url(#g)"/>' if background else ""
    )
    glyph = scaled(GLYPH, glyph_scale, 20.5, 20.5)
    return render(back + f'<g transform="translate({shift_x} {shift_y})">{glyph}</g>', width, height, view)


def on_white(image: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", image.size, WHITE)
    canvas.alpha_composite(image)
    return canvas.convert("RGB")


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    INSTALLER.mkdir(parents=True, exist_ok=True)
    for name, size in LOGO.items():
        logo(size).save(ASSETS / name, optimize=True)
    for name, size in TILES.items():
        padded(size, 0.66).save(ASSETS / name, optimize=True)
    for name, (width, height) in WIDE.items():
        banner(width, height, 1.0, True).save(ASSETS / name, optimize=True)
    for name, (width, height) in SPLASH.items():
        banner(width, height, 1.2, False).save(ASSETS / name, optimize=True)

    frames = [logo(size) for size in ICO_SIZES]
    frames[-1].save(
        ICON,
        sizes=[(size, size) for size in ICO_SIZES],
        append_images=frames[:-1],
    )

    for size in WIZARD_SMALL:
        # Opaque on the wizard's white header: no reliance on PNG alpha support.
        on_white(padded(size, 0.9)).save(INSTALLER / f"WizardSmallImage-{size}.png", optimize=True)
    for width, height in WIZARD_LARGE:
        image = banner(width, height, 1.0, True).convert("RGB")
        image.save(INSTALLER / f"WizardImage-{width}.png", optimize=True)
    print(f"Assets gerados em {ASSETS}, {INSTALLER} e {ICON.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
