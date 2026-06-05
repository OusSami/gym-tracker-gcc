#!/usr/bin/env python3
"""Label preview for Barbell Bench Press (Flat) — shows EN/AR labels + leader-line stubs."""

from PIL import Image, ImageDraw, ImageFont
import arabic_reshaper
from bidi.algorithm import get_display
import os

# ── fonts ──────────────────────────────────────────────────────────────────────
EN_FONT_PATH  = "/System/Library/Fonts/SFNSMono.ttf"
AR_FONT_PATH  = "/System/Library/Fonts/SFArabic.ttf"
EN_BOLD       = "/System/Library/Fonts/SFNSMono.ttf"

def ar(text):
    return get_display(arabic_reshaper.reshape(text))

# ── label data ─────────────────────────────────────────────────────────────────
LABELS = [
    {"num": 1, "en": "Pectoralis Major (Upper)", "ar": "الصدر الكبير العلوي",   "role": "primary"},
    {"num": 2, "en": "Pectoralis Major (Lower)", "ar": "الصدر الكبير السفلي",   "role": "primary"},
    {"num": 3, "en": "Anterior Deltoid",          "ar": "عضلة الكتف الأمامية",   "role": "secondary"},
    {"num": 4, "en": "Triceps Brachii",           "ar": "الترايسبس",             "role": "secondary"},
]

ROLE_COLOR = {"primary": "#C0392B", "secondary": "#D35400"}

W, H = 900, 420
STUB_LEN  = 90   # pixel length of leader-line stub
X_ANCHOR  = 380  # x where stubs begin (arrow tip)
LABEL_X   = X_ANCHOR + STUB_LEN + 10  # x where label text starts
Y_START   = 60
Y_STEP    = 90

def build_preview(out_path: str):
    img  = Image.new("RGB", (W, H), "white")
    draw = ImageDraw.Draw(img)

    try:
        en_bold = ImageFont.truetype(EN_BOLD,  20)
        en_reg  = ImageFont.truetype(EN_FONT_PATH, 17)
        ar_reg  = ImageFont.truetype(AR_FONT_PATH, 18)
    except Exception as e:
        print(f"Font load error: {e}"); return

    # title
    draw.text((20, 14), "Barbell Bench Press — Flat  |  Label Preview", font=en_bold, fill="#111")

    # figure placeholder
    draw.rectangle([30, 50, X_ANCHOR - 10, H - 30], outline="#CCC", width=2)
    draw.text((40, 220), "[ FIGURE PLACEHOLDER ]", font=en_reg, fill="#AAA")
    draw.text((40, 250), "start | end panels here", font=en_reg, fill="#AAA")

    for i, lbl in enumerate(LABELS):
        y_tip   = Y_START + i * Y_STEP
        y_label = y_tip - 22
        color   = ROLE_COLOR[lbl["role"]]

        # leader line stub (arrow tip → label)
        draw.line([(X_ANCHOR, y_tip), (X_ANCHOR + STUB_LEN, y_tip)], fill=color, width=2)
        # arrowhead (filled triangle at tip)
        ax = X_ANCHOR
        draw.polygon([(ax, y_tip), (ax + 10, y_tip - 5), (ax + 10, y_tip + 5)], fill=color)

        # number circle
        draw.ellipse([X_ANCHOR + STUB_LEN - 2, y_tip - 10, X_ANCHOR + STUB_LEN + 18, y_tip + 10],
                     outline=color, width=2)
        draw.text((X_ANCHOR + STUB_LEN + 3, y_tip - 9), str(lbl["num"]), font=en_reg, fill=color)

        # EN label
        draw.text((LABEL_X + 24, y_label),
                  f"{lbl['num']}  {lbl['en']}", font=en_bold, fill="#111")

        # AR label (RTL-corrected)
        ar_text = ar(lbl["ar"])
        draw.text((LABEL_X + 24, y_label + 26), ar_text, font=ar_reg, fill="#444")

        # role badge
        badge = "PRIMARY" if lbl["role"] == "primary" else "secondary"
        draw.text((LABEL_X + 24, y_label + 54), badge, font=en_reg, fill=color)

    # legend
    lx, ly = 30, H - 22
    draw.rectangle([lx, ly - 10, lx + 16, ly + 4], fill=ROLE_COLOR["primary"])
    draw.text((lx + 20, ly - 10), "Primary muscle (red glow)", font=en_reg, fill="#333")
    draw.rectangle([lx + 260, ly - 10, lx + 276, ly + 4], fill=ROLE_COLOR["secondary"])
    draw.text((lx + 280, ly - 10), "Secondary muscle (orange glow)", font=en_reg, fill="#333")

    img.save(out_path)
    print(f"Saved: {out_path}")

if __name__ == "__main__":
    out = os.path.join(os.path.dirname(__file__),
                       "../public/exercises/label-preview-bp-flat.png")
    build_preview(os.path.abspath(out))
