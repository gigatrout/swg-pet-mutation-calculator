#!/usr/bin/env python3
"""Desktop launcher for the Hydro Point Distribution calculator (embedded web UI)."""

from __future__ import annotations

import http.server
import socket
import socketserver
import sys
import threading
import webbrowser
from pathlib import Path
from typing import Optional

APP_TITLE = "Hydro Point Calculator"
WINDOW_WIDTH = 1280
WINDOW_HEIGHT = 900
MIN_WIDTH = 900
MIN_HEIGHT = 640


def resource_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS)  # type: ignore[attr-defined]
    return Path(__file__).resolve().parent


def web_dir() -> Path:
    return resource_root() / "web"


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def start_server(directory: Path, port: int) -> socketserver.TCPServer:
    class QuietHandler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(directory), **kwargs)

        def log_message(self, format: str, *args) -> None:  # noqa: A003
            return

    server = socketserver.TCPServer(("127.0.0.1", port), QuietHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server


def open_webview(url: str) -> None:
    import webview

    window = webview.create_window(
        APP_TITLE,
        url,
        width=WINDOW_WIDTH,
        height=WINDOW_HEIGHT,
        min_size=(MIN_WIDTH, MIN_HEIGHT),
    )
    webview.start()


def open_browser_fallback(url: str, server: socketserver.TCPServer) -> None:
    webbrowser.open(url)
    try:
        input("Calculator running. Press Enter to quit.\n")
    except KeyboardInterrupt:
        pass
    finally:
        server.shutdown()


def main() -> int:
    assets = web_dir()
    index = assets / "index.html"
    if not index.is_file():
        print(f"Missing web assets: {index}", file=sys.stderr)
        return 1

    port = find_free_port()
    url = f"http://127.0.0.1:{port}/"
    server: Optional[socketserver.TCPServer] = None
    try:
        server = start_server(assets, port)
        try:
            open_webview(url)
        except ImportError:
            print("pywebview not installed — opening in your default browser.")
            open_browser_fallback(url, server)
    finally:
        if server is not None:
            server.shutdown()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
