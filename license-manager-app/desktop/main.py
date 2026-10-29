from pathlib import Path
import sys
import webview

def resource_path(relative):
    return str(Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent)) / relative)

if __name__ == "__main__":
    webview.create_window("Stagepulse Lisans Yönetimi", url=resource_path("assets/index.html"), width=1180, height=820, min_size=(360, 600), background_color="#0b0b0c")
    webview.start(debug=False, http_server=False)
