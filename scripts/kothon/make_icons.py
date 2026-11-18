"""Build Kothon's app and tray icons from the designer's files.

usage: python make_icons.py BRANDING_DIR OUT_MASTER_DIR TRAY_OUT_DIR

BRANDING_DIR holds kothon-mouth-icon.png (used for every size and the tray
when present), else app-icon.png (large sizes) and app-icon-small.png (ক
only, for 16/32 px). This script:
  - squares each tile to Apple's 824 px grid on a 1024 canvas, fully opaque
    (writes OUT_MASTER_DIR/icon-master.png and icon-master-small.png);
  - draws the tray icons (idle, recording, transcribing, warning; black for
    the macOS template image, white for dark tray themes, purple for Linux's
    colored theme) from the ক glyph in app-icon-small.png.
Then `bun tauri icon` and iconutil finish the platform icon sets
(see make-icons.sh).
"""
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

PURPLE = (63, 1, 89, 255)
SS = 8  # supersampling for the tray shapes


def square_tile(src: Path) -> Image.Image:
    im = Image.open(src).convert("RGBA")
    a = im.getchannel("A")
    bbox = a.point(lambda v: 255 if v > 128 else 0).getbbox()
    tile = im.crop(bbox)
    # Opaque inside the tile; keep the anti-aliased rim.
    alpha = tile.getchannel("A").point(lambda v: 255 if v >= 250 else v)
    tile.putalpha(alpha)
    tile = tile.resize((824, 824), Image.LANCZOS)
    canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    canvas.alpha_composite(tile, (100, 100))
    return canvas


def glyph_mask(src: Path) -> Image.Image:
    """The white mark (mouth or ক) from an icon tile, as an L mask cropped to its bounds."""
    im = Image.open(src).convert("RGBA")
    r, g, b, a = im.split()
    white = ImageChops.multiply(ImageChops.multiply(r, g), b).point(lambda v: 255 if v > 200 else 0)
    white = ImageChops.multiply(white, a.point(lambda v: 255 if v > 200 else 0))
    return white.crop(white.getbbox()).filter(ImageFilter.GaussianBlur(1))


def fit(mask: Image.Image, box: int) -> Image.Image:
    w, h = mask.size
    s = box / max(w, h)
    return mask.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)


def paste_center(canvas: Image.Image, mask: Image.Image, cx: int, cy: int) -> None:
    canvas.paste(mask, (cx - mask.width // 2, cy - mask.height // 2), mask)


def tray_masks(glyph: Image.Image) -> dict:
    n = 64 * SS
    out = {}

    idle = Image.new("L", (n, n), 0)
    paste_center(idle, fit(glyph, 54 * SS), n // 2, n // 2)
    out["idle"] = idle

    # Recording: filled disc with the glyph knocked out.
    rec = Image.new("L", (n, n), 0)
    ImageDraw.Draw(rec).ellipse((2 * SS, 2 * SS, 62 * SS, 62 * SS), fill=255)
    hole = Image.new("L", (n, n), 0)
    paste_center(hole, fit(glyph, 36 * SS), n // 2, n // 2 + SS)
    out["recording"] = ImageChops.subtract(rec, hole)

    # Transcribing: disc knocked out by three dots, as in "working…".
    tr = Image.new("L", (n, n), 0)
    d = ImageDraw.Draw(tr)
    d.ellipse((2 * SS, 2 * SS, 62 * SS, 62 * SS), fill=255)
    for cx in (18, 32, 46):
        d.ellipse(((cx - 5) * SS, 27 * SS, (cx + 5) * SS, 37 * SS), fill=0)
    out["transcribing"] = tr

    # Warning: glyph with a "!" badge in the bottom-right corner.
    warn = Image.new("L", (n, n), 0)
    paste_center(warn, fit(glyph, 50 * SS), 26 * SS, 27 * SS)
    d = ImageDraw.Draw(warn)
    d.ellipse((34 * SS, 34 * SS, 64 * SS, 64 * SS), fill=0)  # gap around the badge
    d.ellipse((37 * SS, 37 * SS, 63 * SS, 63 * SS), fill=255)
    d.rounded_rectangle((48 * SS, 41 * SS, 52 * SS, 54 * SS), radius=2 * SS, fill=0)
    d.ellipse((47.5 * SS, 56 * SS, 52.5 * SS, 61 * SS), fill=0)
    out["warning"] = warn
    return {k: v.resize((64, 64), Image.LANCZOS) for k, v in out.items()}


def colored(mask: Image.Image, rgba) -> Image.Image:
    im = Image.new("RGBA", mask.size, rgba)
    im.putalpha(mask)
    return im


def main() -> None:
    branding, master_dir, tray_dir = (Path(p) for p in sys.argv[1:4])
    master_dir.mkdir(parents=True, exist_ok=True)
    # The mouth icon, when present, is the one mark for every size and the tray.
    mouth = branding / "kothon-mouth-icon.png"
    large = mouth if mouth.exists() else branding / "app-icon.png"
    small = mouth if mouth.exists() else branding / "app-icon-small.png"
    if not small.exists():
        small = large
    square_tile(large).save(master_dir / "icon-master.png")
    square_tile(small).save(master_dir / "icon-master-small.png")

    m = tray_masks(glyph_mask(small))
    black, white, purple = (0, 0, 0, 255), (255, 255, 255, 255), (124, 58, 237, 255)
    names = {"idle": "tray_idle", "recording": "tray_recording", "transcribing": "tray_transcribing", "warning": "tray_idle_warning"}
    for key, base in names.items():
        colored(m[key], white).save(tray_dir / f"{base}.png")  # dark theme: light icons
        colored(m[key], black).save(tray_dir / f"{base}_dark.png")  # light theme: dark icons
    colored(m["idle"], purple).save(tray_dir / "handy.png")
    colored(m["recording"], purple).save(tray_dir / "recording.png")
    colored(m["transcribing"], purple).save(tray_dir / "transcribing.png")
    colored(m["warning"], purple).save(tray_dir / "handy_warning.png")


if __name__ == "__main__":
    main()
