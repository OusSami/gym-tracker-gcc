#!/usr/bin/env python3
"""
Composite start-pose ghost + main base, then stamp bilingual labels.
Curl-image style: plain black text, numbered, thin leader lines + arrowheads.
"""

from PIL import Image, ImageDraw, ImageFont
import arabic_reshaper
from bidi.algorithm import get_display
import math, os

BASE_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "exercises")

FONT_EN  = "/System/Library/Fonts/Helvetica.ttc"
FONT_AR  = "/System/Library/Fonts/SFArabic.ttf"
EN_SIZE  = 22
AR_SIZE  = 20

BLACK = (0, 0, 0, 255)

LABELS = [
    {"num": 1, "en": "Pectoralis Major", "ar": "الصدر الكبير",         "role": "primary"},
    {"num": 2, "en": "Triceps Brachii",  "ar": "الترايسبس",            "role": "secondary"},
    {"num": 3, "en": "Anterior Deltoid", "ar": "عضلة الكتف الأمامية", "role": "secondary"},
]

# tip  = arrowhead on muscle, fraction of W×H
# lxy  = top-left of text block, fraction of W×H
ANCHORS = {
    "male": [
        {"tip": (0.43, 0.63), "lxy": (0.03, 0.54)},   # 1 Pectoralis — left
        {"tip": (0.50, 0.46), "lxy": (0.63, 0.28)},   # 2 Triceps — right
        {"tip": (0.46, 0.54), "lxy": (0.63, 0.48)},   # 3 Ant. Deltoid — right
    ],
    "female": [
        {"tip": (0.40, 0.60), "lxy": (0.03, 0.50)},
        {"tip": (0.50, 0.44), "lxy": (0.63, 0.26)},
        {"tip": (0.44, 0.52), "lxy": (0.63, 0.46)},
    ],
}

GHOST_OPACITY = 0.32   # fraction; dark clothing → light grey silhouette
GHOST_OFFSET  = 60     # px rightward shift so both poses are distinct


def ar(text):
    return get_display(arabic_reshaper.reshape(text))


def make_ghost(start_img: Image.Image, W: int, H: int) -> Image.Image:
    """Return a faded RGBA version of start_img, shifted right, on transparent canvas."""
    # Resize to match canvas
    ghost = start_img.convert("RGBA").resize((W, H), Image.LANCZOS)

    # Reduce alpha of every pixel by GHOST_OPACITY; white bg pixels become fully transparent
    pixels = ghost.load()
    for y in range(H):
        for x in range(W):
            r, g, b, a = pixels[x, y]
            # luminance-based: near-white → very transparent
            lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255
            new_a = int(a * GHOST_OPACITY * (1 - lum * 0.8))
            pixels[x, y] = (r, g, b, new_a)

    # Paste onto canvas offset right
    canvas = Image.new("RGBA", (W, H), (255, 255, 255, 0))
    canvas.paste(ghost, (GHOST_OFFSET, 0), ghost)
    return canvas


def draw_arrowhead(draw, tip, base, size=9):
    dx, dy = tip[0] - base[0], tip[1] - base[1]
    length = math.hypot(dx, dy) or 1
    ux, uy = dx / length, dy / length
    px, py = -uy, ux
    p1 = (tip[0] - ux*size + px*size*0.4, tip[1] - uy*size + py*size*0.4)
    p2 = (tip[0] - ux*size - px*size*0.4, tip[1] - uy*size - py*size*0.4)
    draw.polygon([tip, p1, p2], fill=BLACK)


def stamp(variant: str):
    main_path  = os.path.join(BASE_DIR, f"bp-flat-{variant}-base.png")
    start_path = os.path.join(BASE_DIR, f"bp-flat-{variant}-start.png")
    out_path   = os.path.join(BASE_DIR, f"bp-flat-{variant}.png")

    main  = Image.open(main_path).convert("RGBA")
    start = Image.open(start_path).convert("RGBA")
    W, H  = main.size

    # --- 1. white canvas ---
    canvas = Image.new("RGBA", (W, H), (255, 255, 255, 255))

    # --- 2. ghost (start pose, faded, offset) ---
    ghost = make_ghost(start, W, H)
    canvas = Image.alpha_composite(canvas, ghost)

    # --- 3. main figure on top ---
    canvas = Image.alpha_composite(canvas, main)

    # --- 4. label layer ---
    label_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(label_layer)

    try:
        font_en  = ImageFont.truetype(FONT_EN, EN_SIZE)
        font_ar  = ImageFont.truetype(FONT_AR, AR_SIZE)
    except Exception:
        font_en = font_ar = ImageFont.load_default()

    anchors = ANCHORS[variant]
    line_h  = EN_SIZE + 4

    for label, anchor in zip(LABELS, anchors):
        tip_x = int(anchor["tip"][0] * W)
        tip_y = int(anchor["tip"][1] * H)
        lx    = int(anchor["lxy"][0] * W)
        ly    = int(anchor["lxy"][1] * H)

        num_str = f"{label['num']}  "
        en_str  = label["en"]
        ar_str  = ar(label["ar"])

        num_w = draw.textlength(num_str, font=font_en)
        en_w  = draw.textlength(en_str,  font=font_en)
        ar_w  = draw.textlength(ar_str,  font=font_ar)

        block_w = int(num_w + max(en_w, ar_w)) + 14
        block_h = line_h * 2 + 8

        # white backing for legibility
        draw.rectangle(
            [lx - 4, ly - 4, lx + block_w, ly + block_h],
            fill=(255, 255, 255, 210)
        )

        # EN line: "N  Name"
        draw.text((lx, ly), num_str, font=font_en, fill=BLACK)
        draw.text((lx + num_w, ly), en_str, font=font_en, fill=BLACK)
        # AR line below
        draw.text((lx + num_w, ly + line_h + 2), ar_str, font=font_ar, fill=BLACK)

        # leader line from text block centre to arrowhead tip
        block_cx = lx + block_w // 2
        block_cy = ly + block_h // 2
        draw.line([(block_cx, block_cy), (tip_x, tip_y)], fill=BLACK, width=2)
        draw_arrowhead(draw, (tip_x, tip_y), (block_cx, block_cy))

    canvas = Image.alpha_composite(canvas, label_layer)
    canvas.convert("RGB").save(out_path, "PNG", optimize=True)
    print(f"  ✓ {out_path}")


if __name__ == "__main__":
    stamp("male")
    stamp("female")
    print("Done.")
