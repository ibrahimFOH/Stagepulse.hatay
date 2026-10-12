#!/usr/bin/env python3
import json
import pathlib
import re
from urllib.parse import urlparse

ROOT = pathlib.Path(__file__).resolve().parents[1]
paths = [ROOT / "latest.json", ROOT / "app-update.json"]
documents = [json.loads(path.read_text(encoding="utf-8")) for path in paths]
web_updater = (ROOT / "portal" / "app-update.js").read_text(encoding="utf-8")

if documents[0] != documents[1]:
    raise SystemExit("latest.json and app-update.json must describe identical update state")
if not re.search(r"info\?\.staff\?\.web_version|info\?\.admin\?\.web_version|info\?\.release|info\.staff\.web_version|info\.admin\.web_version|info\.release", web_updater):
    raise SystemExit("Portal web updater must consume the canonical update manifest schema")

document = documents[0]
if set(document) != {"release", "updated_at", "status", "staff", "admin"}:
    raise SystemExit("Update manifest has unexpected or missing top-level fields")
if document["status"] not in {"verified", "no_verified_release"}:
    raise SystemExit("Invalid update manifest status")
if not re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z", document["updated_at"]):
    raise SystemExit("updated_at must be an ISO-8601 UTC timestamp")

for platform in ("staff", "admin"):
    item = document[platform]
    required = {"platform", "apk_version", "web_version", "minimum_version", "apk_url", "apk_sha256", "notes"}
    if set(item) != required or item["platform"] != platform:
        raise SystemExit(f"Invalid {platform} manifest shape")
    if type(item["apk_version"]) is not int or type(item["minimum_version"]) is not int:
        raise SystemExit(f"{platform} version codes must be integers")
    if item["apk_version"] < 0 or not 0 <= item["minimum_version"] <= item["apk_version"]:
        raise SystemExit(f"Invalid {platform} version policy")
    if not re.fullmatch(r"\d+\.\d+\.\d+", item["web_version"]):
        raise SystemExit(f"Invalid {platform} web_version")

    if document["status"] == "verified":
        major, minor, patch = map(int, item["web_version"].split("."))
        if minor > 999 or patch > 999:
            raise SystemExit(f"{platform} MINOR and PATCH components must not exceed 999")
        expected_version_code = major * 1_000_000 + minor * 1_000 + patch
        if item["apk_version"] != expected_version_code:
            raise SystemExit(
                f"{platform} apk_version does not match web_version: "
                f"expected {expected_version_code}, got {item['apk_version']}"
            )

        if not isinstance(document["release"], str) or not re.fullmatch(
            rf"v{re.escape(item['web_version'])}-build\.\d+", document["release"]
        ):
            raise SystemExit(f"{platform} release tag does not match its web_version")

        parsed = urlparse(item["apk_url"])
        prefix = "/ibrahimFOH/Stagepulse.hatay/releases/download/"
        if parsed.scheme != "https" or parsed.hostname != "github.com" or not parsed.path.startswith(prefix):
            raise SystemExit(f"{platform} APK URL is not a trusted release URL")
        path_parts = parsed.path.split("/")
        expected_asset = (
            f"Stagepulse-Personel-v{item['web_version']}.apk"
            if platform == "staff"
            else f"Stagepulse-Admin-v{item['web_version']}.apk"
        )
        if len(path_parts) != 7 or path_parts[-2] != document["release"] or path_parts[-1] != expected_asset:
            raise SystemExit(f"{platform} APK URL does not match the release tag and package")
        if not re.fullmatch(r"[0-9a-f]{64}", item["apk_sha256"]):
            raise SystemExit(f"{platform} APK SHA-256 is invalid")
    elif item["apk_version"] != 0 or item["minimum_version"] != 0 or item["apk_url"] or item["apk_sha256"]:
        raise SystemExit(f"Unverified {platform} entry must not advertise an APK")

print("Update manifests are synchronized and valid")
