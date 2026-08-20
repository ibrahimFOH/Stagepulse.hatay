#!/usr/bin/env python3
"""
Stagepulse – Görsel Optimizasyon (Kalite korumalı, boyut küçültme)
-----------------------------------------------------------------
Mevcut JPEG/JPG/PNG dosyalarını yüksek kaliteli WebP'ye çevirir.
Orijinal dosyalar silinmez (yedek kalır).
media.json otomatik güncellenir (webp yolları eklenir).

Kullanım:
  pip install Pillow pillow-heif
  python optimize_images.py
"""

from __future__ import annotations
import json
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent
GALLERY = ROOT / "images" / "gallery"
MEDIA_JSON = ROOT / "media.json"

# Kalite ayarları (görüntü kalitesi düşmesin, boyut küçülsün)
WEBP_QUALITY = 82          # 80-85 arası tatlı nokta
MAX_WIDTH = 1920
MAX_HEIGHT = 1920
KEEP_ORIGINAL = True       # True = orijinal JPEG kalsın

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".heic", ".heif"}


def human_size(n: int) -> str:
    for u in ["B", "KB", "MB"]:
        if n < 1024:
            return f"{n:.1f} {u}"
        n /= 1024
    return f"{n:.1f} GB"


def convert_to_webp(path: Path) -> dict | None:
    try:
        from PIL import Image, ImageOps
        try:
            from pillow_heif import register_heif_opener
            register_heif_opener()
        except ImportError:
            pass

        with Image.open(path) as im:
            im = ImageOps.exif_transpose(im)

            # Boyut sınırı (gerekirse küçült, kaliteyi koru)
            if im.width > MAX_WIDTH or im.height > MAX_HEIGHT:
                im.thumbnail((MAX_WIDTH, MAX_HEIGHT), Image.Resampling.LANCZOS)

            # RGB'ye çevir
            if im.mode in ("RGBA", "P", "LA"):
                bg = Image.new("RGB", im.size, (11, 11, 11))
                if im.mode == "P":
                    im = im.convert("RGBA")
                bg.paste(im, mask=im.split()[-1] if im.mode in ("RGBA", "LA") else None)
                im = bg
            elif im.mode != "RGB":
                im = im.convert("RGB")

            webp_path = path.with_suffix(".webp")
            im.save(
                webp_path,
                "WEBP",
                quality=WEBP_QUALITY,
                method=6,          # en iyi sıkıştırma
                exact=False
            )

            before = path.stat().st_size
            after = webp_path.stat().st_size
            saved = before - after
            pct = (saved / before * 100) if before else 0

            return {
                "original": path.name,
                "webp": webp_path.name,
                "before": before,
                "after": after,
                "saved_pct": round(pct, 1),
            }
    except Exception as e:
        print(f"  HATA {path.name}: {e}")
        return None


def update_media_json(webp_map: dict):
    """media.json içine webp yollarını ekle / photos listesini güncelle."""
    if not MEDIA_JSON.exists():
        print("media.json bulunamadı, atlanıyor.")
        return

    data = json.loads(MEDIA_JSON.read_text(encoding="utf-8"))

    # gallery dizisini güncelle
    for item in data.get("gallery", []):
        name = item.get("name", "")
        stem = Path(name).stem
        # webp varsa ekle
        for orig, info in webp_map.items():
            if Path(orig).stem == stem:
                item["webp"] = f"images/gallery/{info['webp']}"
                break

    # photos dizisi: mümkünse webp tercih et (script.js hâlâ photos kullanıyor)
    new_photos = []
    for p in data.get("photos", []):
        stem = Path(p).stem
        found = False
        for orig, info in webp_map.items():
            if Path(orig).stem == stem:
                new_photos.append(f"images/gallery/{info['webp']}")
                found = True
                break
        if not found:
            new_photos.append(p)
    data["photos"] = new_photos

    data["generated_at"] = datetime.now(timezone.utc).isoformat()
    MEDIA_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print("✓ media.json güncellendi (webp yolları eklendi)")


def main():
    print("▶ Stagepulse Görsel Optimizasyon başlıyor...")
    print(f"  Klasör: {GALLERY}")
    print(f"  Kalite: WebP q{WEBP_QUALITY} | Max: {MAX_WIDTH}px\n")

    if not GALLERY.exists():
        print("images/gallery klasörü yok!")
        return

    webp_map = {}
    total_before = 0
    total_after = 0

    files = sorted([
        f for f in GALLERY.iterdir()
        if f.is_file() and f.suffix.lower() in IMAGE_EXTS
    ])

    if not files:
        print("Dönüştürülecek görsel bulunamadı.")
        return

    for path in files:
        print(f"  → {path.name}")
        result = convert_to_webp(path)
        if result:
            webp_map[path.name] = result
            total_before += result["before"]
            total_after += result["after"]
            print(f"     {human_size(result['before'])} → {human_size(result['after'])}  (-%{result['saved_pct']})")

    print(f"\nToplam: {human_size(total_before)} → {human_size(total_after)}")
    if total_before:
        print(f"Kazanç: %{round((total_before - total_after) / total_before * 100, 1)}")

    update_media_json(webp_map)
    print("\nTamamlandı. Orijinal dosyalar korundu, WebP eklendi.")
    print("GitHub'a hem .webp dosyalarını hem de güncel media.json'u yükle.")


if __name__ == "__main__":
    main()
