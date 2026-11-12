#!/usr/bin/env python3
"""Generates the Expo app icons from the ConnectMouse logo (website/public/favicon.svg).

Outputs (referenced by app.json, committed so builds need no Python):
  assets/images/icon.png                     1024, opaque full-bleed (iOS masks it)
  assets/images/android-icon-foreground.png  1024, transparent, glyph inside the safe zone
  assets/images/android-icon-background.png  1024, the logo gradient
  assets/images/android-icon-monochrome.png  1024, white glyph for Android 13+ themed icons
  assets/images/splash-icon.png              1024, transparent, rounded logo
  assets/images/favicon.png                  64, rounded logo (web)

Requires CairoSVG:  pip install cairosvg
Run from the repository root:  python3 scripts/generate-mobile-icons.py
"""
from pathlib import Path

import cairosvg

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "images"

GRADIENT = """<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#6E8BFF"/><stop offset=".55" stop-color="#0031F4"/>
<stop offset="1" stop-color="#0A1FB8"/></linearGradient>"""
# Same paths as website/public/favicon.svg (40x40 viewBox).
GLYPH = """<path d="M13 10.5 28.5 18l-6.6 2.2-3.1 6.6Z" fill="{fill}"/>
<path d="M12.5 30.5a5 5 0 0 1 5-5" stroke="{fill}" stroke-width="2.2" fill="none"
stroke-linecap="round" opacity="{arc}"/>"""


def glyph(fill: str = "#fff", arc: str = ".75", scale: float = 1.0) -> str:
    # Scale around the glyph's centre (20.5, 20.5).
    body = GLYPH.format(fill=fill, arc=arc)
    transform = f"translate(20.5 20.5) scale({scale}) translate(-20.5 -20.5)"
    return f'<g transform="{transform}">{body}</g>'


def svg(content: str, defs: str = "") -> str:
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">'
        f"<defs>{defs}</defs>{content}</svg>"
    )


def render(name: str, markup: str, size: int) -> None:
    cairosvg.svg2png(
        bytestring=markup.encode(), write_to=str(OUT / name), output_width=size, output_height=size
    )


def main() -> None:
    background = '<rect width="40" height="40" fill="url(#g)"/>'
    rounded = '<rect width="40" height="40" rx="12" fill="url(#g)"/>'
    # iOS/legacy icon: full square, no transparency; glyph slightly smaller for breathing room.
    render("icon.png", svg(background + glyph(scale=0.9), GRADIENT), 1024)
    # Adaptive icon: 108dp canvas, launchers show the central 72dp and may mask to a
    # 66dp circle, so the glyph is shrunk to stay inside it.
    render("android-icon-foreground.png", svg(glyph(scale=0.6)), 1024)
    render("android-icon-background.png", svg(background, GRADIENT), 1024)
    render("android-icon-monochrome.png", svg(glyph(arc="1", scale=0.6)), 1024)
    render("splash-icon.png", svg(rounded + glyph(), GRADIENT), 1024)
    render("favicon.png", svg(rounded + glyph(), GRADIENT), 64)
    print(f"Ícones gerados em {OUT}")


if __name__ == "__main__":
    main()
