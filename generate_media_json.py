#!/usr/bin/env python3
"""
Stagepulse – Media Scanner & Auto Optimizer (v2 - Geriye uyumlu)
----------------------------------------------------------------
• images/gallery/  → fotoğraflar
• videos/          → videolar
• documents/       → PDF ve dokümanlar

Çıktı hem yeni yapı (gallery) hem eski yapı (photos) üretir.
Böylece mevcut script.js bozulmaz.
"""

from __future__ import annotations
import json
import os
import re
import sys
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent
GALLERY_DIR = ROOT / "images" / "gallery"
VIDEOS_DIR = ROOT / "videos"
DOCS_DIR = ROOT / "documents"
OUTPUT = ROOT / "media.json"

OPTIMIZE_IMAGES = True
MAX_WIDTH = 1920
MAX_HEIGHT = 1920
JPEG_QUALITY = 82
WEBP_QUALITY = 80
CREATE_WEBP = True

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif", ".avif", ".tif", ".tiff"}
VIDEO_EXTS = {".mp4", ".webm", ".mov", ".m4v", ".mkv"}
DOC_EXTS = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".zip"}


def safe_name(name: str) -> str:
    """Sanitize filename: strip, remove forbidden chars, collapse spaces to underscore."""
    name = name.strip()
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", name)
    # Spaces and repeated whitespace → single underscore (URL/tooling friendly)
    name = re.sub(r"\s+", "_", name)
    # Avoid leading/trailing dots or underscores that some hosts dislike
    name = name.strip("._")
    return name or "unnamed"


def human_size(num: int) -> str:
    for unit in ["B", "KB", "MB", "GB"]:
        if num < 1024:
            return f"{num:.1f} {unit}"
        num /= 1024
    return f"{num:.1f} TB"


def optimize_image(path: Path) -> dict:
    """Optimize in-place (or convert format). Returns info including final 'path' (Path)."""
    info = {
        "original": path.name,
        "optimized": False,
        "webp": None,
        "size_before": path.stat().st_size,
        "size_after": path.stat().st_size,
        "path": path,  # final path after any rename/conversion
    }

    if not OPTIMIZE_IMAGES:
        return info

    try:
        from PIL import Image, ImageOps
        try:
            from pillow_heif import register_heif_opener
            register_heif_opener()
        except ImportError:
            pass

        with Image.open(path) as im:
            im = ImageOps.exif_transpose(im)

            im.thumbnail((MAX_WIDTH, MAX_HEIGHT), Image.Resampling.LANCZOS)

            if im.mode in ("RGBA", "P", "LA"):
                background = Image.new("RGB", im.size, (11, 11, 11))
                if im.mode == "P":
                    im = im.convert("RGBA")
                background.paste(im, mask=im.split()[-1] if im.mode in ("RGBA", "LA") else None)
                im = background
            elif im.mode != "RGB":
                im = im.convert("RGB")

            suffix = path.suffix.lower()
            if suffix in {".jpg", ".jpeg"}:
                im.save(path, "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
            elif suffix == ".png":
                im.save(path, "PNG", optimize=True)
            elif suffix == ".webp":
                im.save(path, "WEBP", quality=WEBP_QUALITY, method=6)
            else:
                new_path = path.with_suffix(".jpg")
                im.save(new_path, "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
                if new_path != path:
                    path.unlink(missing_ok=True)
                    path = new_path
                    info["original"] = path.name
                    info["path"] = path

            info["size_after"] = path.stat().st_size
            info["optimized"] = True
            info["path"] = path

            if CREATE_WEBP and path.suffix.lower() != ".webp":
                webp_path = path.with_suffix(".webp")
                im.save(webp_path, "WEBP", quality=WEBP_QUALITY, method=6)
                info["webp"] = webp_path.name

    except Exception as e:
        info["error"] = str(e)

    return info


def scan_dir(directory: Path, allowed_exts: set, kind: str) -> list:
    items = []
    if not directory.exists():
        directory.mkdir(parents=True, exist_ok=True)
        return items

    for entry in sorted(directory.iterdir(), key=lambda p: p.name.lower()):
        if not entry.is_file():
            continue
        ext = entry.suffix.lower()
        if ext not in allowed_exts:
            continue

        # Sanitize filename on disk if needed (spaces, forbidden chars)
        clean = safe_name(entry.name)
        if clean != entry.name:
            target = entry.with_name(clean)
            # Avoid overwrite
            if target.exists() and target != entry:
                stem, suf = target.stem, target.suffix
                n = 1
                while target.exists():
                    target = entry.with_name(f"{stem}_{n}{suf}")
                    n += 1
            entry.rename(target)
            entry = target

        # Optimize (may further rename e.g. .heic → .jpg)
        final_path = entry
        opt = None
        if kind == "gallery":
            opt = optimize_image(entry)
            final_path = opt.get("path", entry) if opt else entry

        name = final_path.name

        if kind == "gallery":
            rel_path = f"images/gallery/{name}"
        elif kind == "video":
            rel_path = f"videos/{name}"
        else:
            rel_path = f"documents/{name}"

        rel = rel_path.replace("\\", "/")
        item = {
            "name": name,
            "path": rel,
            "file": rel,  # script.js uyumluluğu
            "size": final_path.stat().st_size,
            "size_human": human_size(final_path.stat().st_size),
            "modified": datetime.fromtimestamp(final_path.stat().st_mtime, tz=timezone.utc).isoformat(),
            "type": kind,
        }
        if kind == "document":
            item["title"] = re.sub(r"\.(pdf|docx?|xlsx?|pptx?|txt|zip)$", "", name, flags=re.I).replace("-", " ").replace("_", " ").strip()

        if kind == "gallery" and opt:
            item["optimized"] = opt.get("optimized", False)
            if opt.get("webp"):
                item["webp"] = f"images/gallery/{opt['webp']}"
            if opt.get("size_after"):
                item["size"] = opt["size_after"]
                item["size_human"] = human_size(opt["size_after"])

        items.append(item)

    return items


def main():
    print("▶ Stagepulse Media Scanner v2 başlıyor...")
    print(f"  Klasör: {ROOT}")

    gallery_items = scan_dir(GALLERY_DIR, IMAGE_EXTS, "gallery")
    video_items = scan_dir(VIDEOS_DIR, VIDEO_EXTS, "video")
    doc_items = scan_dir(DOCS_DIR, DOC_EXTS, "document")

    # Eski script.js uyumluluğu için photos dizisi (sadece path listesi)
    photos = [item["path"] for item in gallery_items]
    videos = [item["path"] for item in video_items]
    documents = [item["path"] for item in doc_items]

    data = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        # Yeni yapı
        "gallery": gallery_items,
        "videos": video_items,
        "documents": doc_items,
        # Eski yapı (script.js bunu kullanıyor)
        "photos": photos,
        "counts": {
            "gallery": len(gallery_items),
            "videos": len(video_items),
            "documents": len(doc_items),
        },
    }

    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"✓ media.json yazıldı → {OUTPUT}")
    print(f"  Fotoğraf : {len(gallery_items)}")
    print(f"  Video    : {len(video_items)}")
    print(f"  Doküman  : {len(doc_items)}")
    print("Tamamlandı.")


if __name__ == "__main__":
    main()
