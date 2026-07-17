#!/usr/bin/env python3
"""Generate public/og-image.png — the 1200x630 social preview card.

Offline only (needs Pillow); NOT part of the site build. LinkedIn and X don't
render SVG og:images, so we ship a raster PNG. Mirrors public/og-image.svg (the
design source). Run: python3 scripts/gen-og.py
"""
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
BG = "#0b0f17"
FUCHSIA = "#e879f9"
TITLE = "#f0abfc"
TEXT = "#e6edf3"
MUTED = "#94a3b8"
FAINT = "#64748b"
MARK_FILL = "#111827"
MARK_STROKE = "#1f2937"


def font(size, bold=False):
    paths = (
        [
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
            "/Library/Fonts/Arial Bold.ttf",
            "/System/Library/Fonts/HelveticaNeue.ttc",
        ]
        if bold
        else [
            "/System/Library/Fonts/Supplemental/Arial.ttf",
            "/Library/Fonts/Arial.ttf",
            "/System/Library/Fonts/HelveticaNeue.ttc",
            "/System/Library/Fonts/Helvetica.ttc",
        ]
    )
    for p in paths:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            continue
    return ImageFont.load_default()


img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

# top accent bar
d.rectangle([0, 0, W, 8], fill=FUCHSIA)

# prompt mark: rounded square with a ">" chevron + underscore (matches the favicon)
mx, my = 90, 250
d.rounded_rectangle([mx, my, mx + 140, my + 140], radius=28, fill=MARK_FILL, outline=MARK_STROKE, width=2)
d.line([(mx + 38, my + 42), (mx + 74, my + 78), (mx + 38, my + 114)], fill=FUCHSIA, width=11, joint="curve")
d.rounded_rectangle([mx + 82, my + 103, mx + 116, my + 114], radius=5, fill=FUCHSIA)

# text block (anchor "ls" = left baseline, to match the SVG y coordinates)
d.text((270, 300), "JabberLM", font=font(92, bold=True), fill=TITLE, anchor="ls")
d.text((272, 372), "A transformer you can see inside", font=font(42, bold=True), fill=TEXT, anchor="ls")
d.text((272, 430), "Train & inspect a real 90K-parameter model — in your browser.", font=font(29), fill=MUTED, anchor="ls")
d.text((272, 476), "No account, no upload, no GPU.", font=font(29), fill=MUTED, anchor="ls")
d.text((90, 560), "jabberlm.com", font=font(28, bold=True), fill=FAINT, anchor="ls")

img.save("public/og-image.png", "PNG")
print("wrote public/og-image.png", img.size)
