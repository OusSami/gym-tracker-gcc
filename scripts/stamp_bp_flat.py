#!/usr/bin/env python3
"""
Barbell Bench Press (Flat) — two-panel composite, curl-style bilingual labels.
Labels placed close to each muscle with short leader lines; no far-side legend.
Images are 1408x736. Panels scaled to PANEL_W wide.
"""
from PIL import Image, ImageDraw, ImageFont
import arabic_reshaper
from bidi.algorithm import get_display
import os, math

BASE_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "exercises")
FONT_EN  = "/System/Library/Fonts/SFNSMono.ttf"
FONT_AR  = "/System/Library/Fonts/SFArabic.ttf"

def ar(t): return get_display(arabic_reshaper.reshape(t))

def arrow(draw, x1, y1, x2, y2, color, w=2, sz=7):
    draw.line([(x1,y1),(x2,y2)], fill=color, width=w)
    a = math.atan2(y2-y1, x2-x1)
    for da in (-math.pi/6, math.pi/6):
        draw.line([(x2,y2),(x2-sz*math.cos(a+da), y2-sz*math.sin(a+da))], fill=color, width=w)

def label_block(draw, x, y, en_text, ar_text, f_en, f_ar):
    """White-backed bilingual block. Returns block height."""
    pad = 5
    ew = int(draw.textlength(en_text, font=f_en))
    aw = int(draw.textlength(ar_text, font=f_ar))
    bw = max(ew, aw) + pad*2
    bh = 24 + 22 + pad*2
    draw.rectangle([x-pad, y-pad, x+bw, y+bh], fill=(255,255,255))
    draw.text((x, y),    en_text, font=f_en, fill=(0,0,0))
    draw.text((x, y+24), ar_text, font=f_ar, fill=(50,50,50))
    return bh + pad*2

# ── layout ─────────────────────────────────────────────────────────────────────
ORIG_W, ORIG_H = 1408, 736
PANEL_W = 700
PANEL_H = round(ORIG_H * PANEL_W / ORIG_W)   # ≈ 366
SCALE   = PANEL_W / ORIG_W                    # ≈ 0.497
GAP     = 50
L_PAD   = 50
T_PAD   = 90   # extra top space for above-figure labels
B_PAD   = 50
CW = L_PAD + PANEL_W + GAP + PANEL_W + L_PAD
CH = T_PAD + PANEL_H + B_PAD

# end-panel left edge in canvas coords
EX = L_PAD + PANEL_W + GAP   # = 800

# ── label configs ──────────────────────────────────────────────────────────────
# anchor_orig  : (x,y) in original 1408x736 end-pose image
# lbl_local    : label top-left in end-panel-local coordinates
#                (can be negative y = in top-margin above panel)
# arr_local    : arrow origin in end-panel-local coords (edge closest to muscle)
# role         : "primary" | "secondary"
CONFIGS = {
    "male": [
        # Triceps — label above figure in top margin, arrow goes down
        {"en": "Triceps Brachii",           "ar": "الترايسبس",
         "role": "secondary",
         "anchor_orig": (700, 240),
         "lbl_local":   (310, -60),
         "arr_local":   (430, -10)},
        # Upper Pec — label to right of upper chest, arrow goes left
        {"en": "Pectoralis Major (Upper)",  "ar": "الصدر الكبير العلوي",
         "role": "primary",
         "anchor_orig": (590, 195),
         "lbl_local":   (408,  75),
         "arr_local":   (408,  98)},
        # Anterior Deltoid — label at left edge of end panel pointing right
        {"en": "Anterior Deltoid",          "ar": "عضلة الكتف الأمامية",
         "role": "secondary",
         "anchor_orig": (540, 305),
         "lbl_local":   ( 10, 105),
         "arr_local":   (225, 128)},
        # Lower Pec — label to right of lower chest, arrow goes left
        {"en": "Pectoralis Major (Lower)",  "ar": "الصدر الكبير السفلي",
         "role": "primary",
         "anchor_orig": (645, 360),
         "lbl_local":   (408, 170),
         "arr_local":   (408, 193)},
    ],
    "female": [
        {"en": "Triceps Brachii",           "ar": "الترايسبس",
         "role": "secondary",
         "anchor_orig": (705, 230),
         "lbl_local":   (330, -60),
         "arr_local":   (450, -10)},
        {"en": "Pectoralis Major (Upper)",  "ar": "الصدر الكبير العلوي",
         "role": "primary",
         "anchor_orig": (660, 195),
         "lbl_local":   (415,  70),
         "arr_local":   (415,  93)},
        {"en": "Anterior Deltoid",          "ar": "عضلة الكتف الأمامية",
         "role": "secondary",
         "anchor_orig": (610, 295),
         "lbl_local":   ( 10, 100),
         "arr_local":   (230, 123)},
        {"en": "Pectoralis Major (Lower)",  "ar": "الصدر الكبير السفلي",
         "role": "primary",
         "anchor_orig": (685, 355),
         "lbl_local":   (415, 165),
         "arr_local":   (415, 188)},
    ],
}
ROLE_COL = {"primary": (200,30,30), "secondary": (175,85,0)}


def compose(variant: str):
    start_path = os.path.join(BASE_DIR, f"bp-flat-{variant}-start.png")
    end_path   = os.path.join(BASE_DIR, f"bp-flat-{variant}-base.png")
    out_path   = os.path.join(BASE_DIR, f"bp-flat-{variant}.png")

    img_s = Image.open(start_path).convert("RGB").resize((PANEL_W, PANEL_H), Image.LANCZOS)
    img_e = Image.open(end_path  ).convert("RGB").resize((PANEL_W, PANEL_H), Image.LANCZOS)

    canvas = Image.new("RGB", (CW, CH), (255,255,255))
    canvas.paste(img_s, (L_PAD, T_PAD))
    canvas.paste(img_e, (EX,    T_PAD))

    draw = ImageDraw.Draw(canvas)

    try:
        f_cap = ImageFont.truetype(FONT_EN, 17)
        f_en  = ImageFont.truetype(FONT_EN, 19)
        f_ar  = ImageFont.truetype(FONT_AR, 17)
    except Exception as e:
        print(f"Font error: {e}")
        f_cap = f_en = f_ar = ImageFont.load_default()

    # subtle panel captions
    draw.text((L_PAD + PANEL_W//2 - 28, T_PAD - 26), "START", font=f_cap, fill=(170,170,170))
    draw.text((EX    + PANEL_W//2 - 20, T_PAD - 26), "END",   font=f_cap, fill=(170,170,170))

    for lbl in CONFIGS[variant]:
        color = ROLE_COL[lbl["role"]]

        # muscle anchor in canvas
        ax = EX + round(lbl["anchor_orig"][0] * SCALE)
        ay = T_PAD + round(lbl["anchor_orig"][1] * SCALE)

        # label top-left in canvas
        lx = EX + lbl["lbl_local"][0]
        ly = T_PAD + lbl["lbl_local"][1]

        # arrow origin in canvas
        ox = EX + lbl["arr_local"][0]
        oy = T_PAD + lbl["arr_local"][1]

        # draw arrow
        arrow(draw, ox, oy, ax, ay, color, w=2, sz=7)
        # dot at arrow origin
        draw.ellipse([ox-4, oy-4, ox+4, oy+4], fill=color)

        # label text
        label_block(draw, lx, ly, lbl["en"], ar(lbl["ar"]), f_en, f_ar)

        # debug: print line length
        dist = math.sqrt((ox-ax)**2 + (oy-ay)**2)
        print(f"  {lbl['en'][:20]:20s}  arrow {dist:.0f}px")

    canvas.save(out_path, "PNG")
    print(f"  → {out_path}")


if __name__ == "__main__":
    import sys
    variants = sys.argv[1:] if len(sys.argv) > 1 else ["male", "female"]
    for v in variants:
        print(f"\n{v}:")
        compose(v)
    print("\nDone.")
