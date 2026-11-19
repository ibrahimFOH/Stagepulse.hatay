from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import threading

import webview

APP_VERSION = "1.0.1"
HOST = "127.0.0.1"
PORT = 5173


def resource_path(relative: str) -> Path:
    base = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
    return base / relative


class LocalAssetServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


def main() -> None:
    assets = resource_path("assets").resolve()
    if not assets.is_dir():
        raise RuntimeError(f"Lisans yönetimi arayüzü bulunamadı: {assets}")

    handler = lambda *args, **kwargs: SimpleHTTPRequestHandler(
        *args, directory=str(assets), **kwargs
    )
    server = LocalAssetServer((HOST, PORT), handler)
    thread = threading.Thread(target=server.serve_forever, name="StagepulseLicenseUI", daemon=True)
    thread.start()
    try:
        webview.create_window(
            f"Stagepulse Lisans Yönetimi v{APP_VERSION}",
            f"http://{HOST}:{PORT}/index.html",
            width=1180,
            height=820,
            min_size=(360, 600),
            background_color="#0b0b0c",
        )
        webview.start(debug=False)
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


if __name__ == "__main__":
    main()
