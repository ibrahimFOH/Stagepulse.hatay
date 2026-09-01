#!/usr/bin/env python3
"""Build the Stagepulse media index and optimize gallery images.

- New raster photos are converted to WebP with quality-preserving settings.
- Existing WebP files are kept as-is unless the source is clearly larger than
  a safe quality target and can be regenerated.
- The generated media.json keeps legacy images/gallery files compatible while
  adding images/gallery/photo and images/gallery/video.
"""
from __future__ import annotations

import json
import mimetypes
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTO_DIR = ROOT / "images" / "gallery" / "photo"
VIDEO_DIR = ROOT / "images" / "gallery" / "video"
LEGACY_GALLERY_DIR = ROOT / "images" / "gallery"
DOCS_DIR = ROOT / "documents"
MEDIA_JSON = ROOT / "media.json"

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}
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


def run(*args: str) -> None:
    subprocess.run(args, cwd=ROOT, check=True)


def optimize_photo(src: Path) -> Path | None:
    if src.suffix.lower() == ".webp":
        return src
    out = src.with_suffix(".webp")
    # Pillow is installed by the workflow. Keep dimensions and use high-quality
    # WebP to reduce bytes without deliberately lowering image resolution.
    from PIL import Image  # type: ignore

    with Image.open(src) as im:
        if im.mode not in ("RGB", "RGBA"):
            if "A" in im.getbands():
                im = im.convert("RGBA")
            else:
                im = im.convert("RGB")
        im.save(out, "WEBP", quality=90, method=6)

    if out.exists() and out.stat().st_size > 0:
        return out
    return None


def all_files(directory: Path, extensions: set[str], recursive: bool = True) -> list[Path]:
    if not directory.exists():
        return []
    it = directory.rglob("*") if recursive else directory.glob("*")
    return sorted(p for p in it if p.is_file() and p.suffix.lower() in extensions)


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def main() -> None:
    PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    VIDEO_DIR.mkdir(parents=True, exist_ok=True)
    DOCS_DIR.mkdir(parents=True, exist_ok=True)

    # Optimize only newly introduced JPG/PNG/GIF/AVIF files in the explicit
    # photo directory. Legacy gallery files remain untouched unless manually
    # migrated, preventing accidental mass rewrites.
    for src in all_files(PHOTO_DIR, IMAGE_EXTS):
        if src.suffix.lower() == ".webp":
            continue
        optimize_photo(src)
        try:
            src.unlink()
        except OSError:
            pass

    photos: list[dict] = []
    seen: set[str] = set()

    # Explicit new photo directory.
    for path in all_files(PHOTO_DIR, {".webp"}):
        r = rel(path)
        if r in seen:
            continue
        seen.add(r)
        photos.append({
            "name": path.name,
            "path": r,
            "file": r,
            "size": path.stat().st_size,
            "size_human": human(path.stat().st_size),
            "modified": iso(path),
            "type": "gallery",
            "optimized": True,
        })

    # Backward compatibility for existing images/gallery/*.webp files.
    for path in sorted(LEGACY_GALLERY_DIR.glob("*.webp")):
        r = rel(path)
        if r in seen:
            continue
        seen.add(r)
        photos.append({
            "name": path.name,
            "path": r,
            "file": r,
            "size": path.stat().st_size,
            "size_human": human(path.stat().st_size),
            "modified": iso(path),
            "type": "gallery",
            "optimized": True,
        })

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
        title = path.stem.replace("-", " ").replace("_", " ").strip()
        documents.append({
            "name": path.name,
            "path": r,
            "file": r,
            "size": path.stat().st_size,
            "size_human": human(path.stat().st_size),
            "modified": iso(path),
            "type": "document",
            "title": title,
        })

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
