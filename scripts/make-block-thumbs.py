"""
Smaller copies of each Blocx thumbnail, for `srcset`.

The thumbnails in public/blocx/thumbs are 960x756. A Blocx card shows its
picture at roughly 285-400 CSS px, so most screens need far fewer pixels than
that: 480 and 640 wide copies let the browser pick the smallest one that is
still sharp at the screen's density, and only a 3x phone or a wide desktop
card fetches the 960. `blockThumbSrcSet()` in lib/blocks.ts lists them.

    python scripts/make-block-thumbs.py     # after adding or replacing a thumbnail
"""
from pathlib import Path
from PIL import Image

DIR = Path(__file__).resolve().parent.parent / "public" / "blocx" / "thumbs"
WIDTHS = (480, 640)

before = after = 0
for src in sorted(DIR.glob("*.webp")):
    if src.stem.endswith(tuple(f"-{w}" for w in WIDTHS)):
        continue  # a copy, not a source
    with Image.open(src) as im:
        im = im.convert("RGBA") if im.mode in ("RGBA", "LA", "P") else im.convert("RGB")
        for w in WIDTHS:
            out = DIR / f"{src.stem}-{w}.webp"
            h = round(im.height * w / im.width)
            im.resize((w, h), Image.LANCZOS).save(out, "WEBP", quality=80, method=6)
            after += out.stat().st_size
    before += src.stat().st_size
    print(f"{src.name:28} {src.stat().st_size // 1024:3}KB -> " + ", ".join(
        f"{w}w {(DIR / f'{src.stem}-{w}.webp').stat().st_size // 1024}KB" for w in WIDTHS))
