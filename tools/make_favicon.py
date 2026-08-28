#!/usr/bin/env python3
"""Generate the Signal Desk favicon.

The phosphor-amber oscilloscope trace (same signature waveform as the header
brand mark) on a dark rounded tile with a soft amber glow — drawn with Pillow on
a 4x supersampled master and resampled to each icon size for crisp small renders.

Writes ``favicon.ico`` (multi-size) at the repo root and prints a
``data:image/x-icon`` URI. That URI is embedded in ``index.html`` so the
single-file ``file://`` build stays self-contained (Vite does not inline files
referenced from ``public/``).

    python3 tools/make_favicon.py            # regenerate favicon.ico + print data URI

Requires Pillow (``pip install Pillow``).
"""
import base64
import io
import os
import struct
from PIL import Image, ImageDraw, ImageFilter

# Brand tokens (docs/STYLEGUIDE.md)
BG     = (11, 14, 20, 255)   # --bg #0B0E14
BORDER = (35, 43, 59, 255)   # --border #232B3B
SIGNAL = (245, 185, 66)      # --signal #F5B942
GRID   = (138, 106, 40)      # --signal-dim #8A6A28

# Signature waveform from Header.tsx: M1 15 L6 15 L9 5 L13 21 L17 11 L20 15 L25 15
RAW = [(1, 15), (6, 15), (9, 5), (13, 21), (17, 11), (20, 15), (25, 15)]
XMIN, XMAX = min(p[0] for p in RAW), max(p[0] for p in RAW)
YMIN, YMAX = min(p[1] for p in RAW), max(p[1] for p in RAW)

SIZES = [16, 24, 32, 48, 64, 128, 256]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def render(size: int) -> Image.Image:
    ss = 4
    S = size * ss
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Dark rounded tile + hairline border.
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22),
                        fill=BG, outline=BORDER, width=max(1, int(S * 0.015)))

    # Faint amber grid, only where it reads (>=32px).
    if size >= 32:
        gw = max(1, int(S * 0.006))
        for gx in (0.34, 0.66):
            x = int(S * gx)
            d.line([(x, int(S * 0.18)), (x, int(S * 0.82))], fill=GRID + (46,), width=gw)
        for gy in (0.34, 0.66):
            y = int(S * gy)
            d.line([(int(S * 0.14), y), (int(S * 0.86), y)], fill=GRID + (46,), width=gw)

    # Map the waveform into the tile's inner area.
    left, right = S * 0.15, S * 0.85
    top, bot = S * 0.26, S * 0.74
    pts = [
        (left + (x - XMIN) / (XMAX - XMIN) * (right - left),
         top + (y - YMIN) / (YMAX - YMIN) * (bot - top))
        for (x, y) in RAW
    ]
    lw = max(2, int(S * 0.085))

    # Soft phosphor glow.
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.line(pts, fill=SIGNAL + (255,), width=lw, joint="curve")
    for (px, py) in pts:
        r = lw * 0.55
        gd.ellipse([px - r, py - r, px + r, py + r], fill=SIGNAL + (255,))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(S * 0.03)))

    # Sharp trace with rounded caps/joins.
    d.line(pts, fill=SIGNAL + (255,), width=lw, joint="curve")
    for (px, py) in pts:
        r = lw * 0.5
        d.ellipse([px - r, py - r, px + r, py + r], fill=SIGNAL + (255,))

    return img.resize((size, size), Image.LANCZOS)


def pack_ico(images) -> bytes:
    """Pack a multi-size ICO by hand (Pillow's writer collapses to one size).
    Frames are stored PNG-encoded, which is valid ICO and keeps 256px compact."""
    pngs = []
    for im in images:
        buf = io.BytesIO()
        im.save(buf, format="PNG")
        pngs.append(buf.getvalue())
    n = len(images)
    out = struct.pack("<HHH", 0, 1, n)  # reserved, type=icon, count
    offset = 6 + 16 * n
    data = b""
    for im, png in zip(images, pngs):
        w, h = im.size
        out += struct.pack("<BBBBHHII",
                           w if w < 256 else 0, h if h < 256 else 0,
                           0, 0, 1, 32, len(png), offset)
        data += png
        offset += len(png)
    return out + data


def main() -> None:
    frames = [render(s) for s in SIZES]
    ico = pack_ico(frames)
    out = os.path.join(ROOT, "favicon.ico")
    with open(out, "wb") as f:
        f.write(ico)
    uri = "data:image/x-icon;base64," + base64.b64encode(ico).decode()
    print("wrote", out, f"({len(ico)} bytes)")
    print(uri)


if __name__ == "__main__":
    main()
