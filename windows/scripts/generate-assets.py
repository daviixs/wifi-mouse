#!/usr/bin/env python3
"""Generates the Windows icon and MSIX/Store logos from assets/images/icon.png.

Outputs are committed, so building on Windows does not need Python. Re-run
after changing the app icon:  python3 windows/scripts/generate-assets.py
Requires Pillow (pip install pillow).
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets" / "images" / "icon.png"
WINDOWS = ROOT / "windows"
ASSETS = WINDOWS / "packaging" / "Assets"
BACKGROUND = (16, 18, 17, 255)  # matches the icon's outer background

# Square tiles keep the icon's own padding; small sizes (tray, taskbar, title
# bar) crop to the rounded key so the cursor stays legible at 16 px.
SQUARE = {
    "StoreLogo.png": 50,
    "Square150x150Logo.png": 150,
    "SmallTile.png": 71,
    "LargeTile.png": 310,
}
CROPPED = {"Square44x44Logo.png": 44}
WIDE = {"Wide310x150Logo.png": (310, 150), "SplashScreen.png": (620, 300)}
ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256]


def cropped(image: Image.Image) -> Image.Image:
    size = image.width
    margin = round(size * 0.205)
    return image.crop((margin, margin, size - margin, size - margin))


def resized(image: Image.Image, size: int) -> Image.Image:
    return image.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    icon = Image.open(SOURCE).convert("RGBA")
    ASSETS.mkdir(parents=True, exist_ok=True)
    for name, size in SQUARE.items():
        resized(icon, size).save(ASSETS / name, optimize=True)
    small = cropped(icon)
    for name, size in CROPPED.items():
        resized(small, size).save(ASSETS / name, optimize=True)
    for name, (width, height) in WIDE.items():
        canvas = Image.new("RGBA", (width, height), BACKGROUND)
        logo = resized(icon, height)
        canvas.alpha_composite(logo, ((width - height) // 2, 0))
        canvas.save(ASSETS / name, optimize=True)
    frames = [resized(small if size <= 64 else icon, size) for size in ICO_SIZES]
    frames[-1].save(
        WINDOWS / "resources" / "RemoteMouse.ico",
        sizes=[(size, size) for size in ICO_SIZES],
        append_images=frames[:-1],
    )
    print(f"Assets gerados em {ASSETS} e resources/RemoteMouse.ico")


if __name__ == "__main__":
    main()
