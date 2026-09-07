#!/usr/bin/env python3
"""Build the Stagepulse media index and normalize gallery photos to WebP."""
from __future__ import annotations

import json
import mimetypes
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTO_DIR = ROOT / "images" / "gallery" / "photo"
VIDEO_DIR = ROOT / "images" / "gallery" / "video"
LEGACY_GALLERY_DIR = ROOT / "images" / "gallery"
DOCS_DIR = ROOT / "documents"
MEDIA_JSON = ROOT / "media.json"

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".bmp", ".tif", ".tiff"}
RASTER_TO_WEBP = IMAGE_EXTS - {".webp"}
VIDEO_EXTS = {".mp4", ".webm", ".mov"}
PDF_EXTS = {".pdf"}


def iso(path: Path) -> str:
    return datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat()


def human(n: int) -> str:
    value = float(n)
    for unit in ("B", "KB", "MB", "GB"):
        if value < 1024 or unit == "GB":
            return f"{value:.1f} {unit}" if unit != "B" else f"{int(value)} B"
        value /= 1024
    return f"{value:.1f} GB"


def mime(path: Path) -> str:
    return mimetypes.guess_type(path.name)[0] or "application/octet-stream"


def all_files(directory: Path, extensions: set[str], recursive: bool = True) -> list[Path]:
    if not directory.exists():
        return []
    it = directory.rglob("*") if recursive else directory.glob("*")
    return sorted(p for p in it if p.is_file() and p.suffix.lower() in extensions)


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def optimize_photo(src: Path) -> Path:
    """Convert any supported raster photo to high-quality WebP."""
    if src.suffix.lower() == ".webp":
        return src
    from PIL import Image  # type: ignore

    out = src.with_suffix(".webp")
    with Image.open(src) as im:
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGBA" if "A" in im.getbands() else "RGB")
        im.save(out, "WEBP", quality=90, method=6)
    if not out.exists() or out.stat().st_size <= 0:
        raise RuntimeError(f"WebP dönüşümü başarısız: {src}")
    src.unlink()
    return out


def normalize_photo_directory(directory: Path) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    for src in all_files(directory, IMAGE_EXTS):
        optimize_photo(src)


def photo_record(path: Path) -> dict:
    r = rel(path)
    return {
        "name": path.name,
        "path": r,
        "file": r,
        "size": path.stat().st_size,
        "size_human": human(path.stat().st_size),
        "modified": iso(path),
        "type": "gallery",
        "optimized": True,
    }


def logical_name(path: Path) -> str:
    """Normalize harmless filename separators so renamed copies are not published twice."""
    return path.stem.replace("_", " ").strip().casefold()


def main() -> None:
    PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    VIDEO_DIR.mkdir(parents=True, exist_ok=True)
    DOCS_DIR.mkdir(parents=True, exist_ok=True)

    normalize_photo_directory(PHOTO_DIR)
    for src in all_files(LEGACY_GALLERY_DIR, RASTER_TO_WEBP, recursive=False):
        optimize_photo(src)

    photos: list[dict] = []
    seen_names: set[str] = set()
    # Dedicated photo queue wins over legacy root duplicates.
    for path in all_files(PHOTO_DIR, {".webp"}):
        key = logical_name(path)
        if key in seen_names:
            continue
        seen_names.add(key)
        photos.append(photo_record(path))
    for path in sorted(LEGACY_GALLERY_DIR.glob("*.webp")):
        key = logical_name(path)
        if key in seen_names:
            continue
        seen_names.add(key)
        photos.append(photo_record(path))

    videos: list[dict] = []
    for path in all_files(VIDEO_DIR, VIDEO_EXTS):
        r = rel(path)
        videos.append({
            "name": path.name,
            "path": r,
            "file": r,
            "size": path.stat().st_size,
            "size_human": human(path.stat().st_size),
            "modified": iso(path),
            "type": "video",
            "mime": mime(path),
        })

    documents: list[dict] = []
    for path in all_files(DOCS_DIR, PDF_EXTS):
        r = rel(path)
        documents.append({
            "name": path.name,
            "path": r,
            "file": r,
            "size": path.stat().st_size,
            "size_human": human(path.stat().st_size),
            "modified": iso(path),
            "type": "document",
            "title": path.stem.replace("-", " ").replace("_", " ").strip(),
        })

    source_media = (
        all_files(PHOTO_DIR, IMAGE_EXTS)
        + all_files(LEGACY_GALLERY_DIR, IMAGE_EXTS, recursive=False)
        + all_files(VIDEO_DIR, VIDEO_EXTS)
        + all_files(DOCS_DIR, PDF_EXTS)
    )
    if source_media and not (photos or videos or documents):
        raise RuntimeError("Medya bulundu ancak media.json boş üretildi; yayın durduruldu.")

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "gallery": photos,
        "videos": videos,
        "documents": documents,
        "photos": [x["path"] for x in photos],
        "counts": {"gallery": len(photos), "videos": len(videos), "documents": len(documents)},
    }
    MEDIA_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
