#!/usr/bin/env python3
import argparse
import base64
import json
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
TYPES = {
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".txt": "text/plain; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
}
CAPTURE_DAY = re.compile(r"[A-Za-z0-9._-]+")


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self._file(True)

    def do_HEAD(self):
        self._file(False)

    def do_POST(self):
        if not self.server.capture or urlsplit(self.path).path != "/_capture":
            self._method_not_allowed()
            return
        self._capture()

    def _method_not_allowed(self):
        self._reply(405, b"method not allowed", "text/plain; charset=utf-8")

    do_PUT = do_DELETE = do_PATCH = do_OPTIONS = _method_not_allowed

    def _file(self, send_body):
        path = unquote(urlsplit(self.path).path)
        target = (self.server.root / path.lstrip("/")).resolve()
        root = self.server.root
        if not target.is_file() or (target != root and root not in target.parents):
            self._reply(404, b"not found", "text/plain; charset=utf-8")
            return
        payload = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", TYPES.get(target.suffix.lower(), "application/octet-stream"))
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if send_body:
            self.wfile.write(payload)

    def _capture(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            message = json.loads(self.rfile.read(length))
            day = message["day"]
            if not CAPTURE_DAY.fullmatch(day):
                raise ValueError("day must match [A-Za-z0-9._-]+")
            png = base64.b64decode(message["png"].split(",", 1)[1], validate=True)
            folder = self.server.root / "proof" / day
            folder.mkdir(parents=True, exist_ok=True)
            sequence = self.server.sequence
            while (folder / f"{sequence:02d}.png").exists():
                sequence += 1
            (folder / f"{sequence:02d}.png").write_bytes(png)
            self.server.sequence = sequence + 1
        except (IndexError, KeyError, TypeError, ValueError) as error:
            self._reply(400, str(error).encode(), "text/plain; charset=utf-8")
            return
        self._reply(204, b"", "text/plain; charset=utf-8")

    def _reply(self, status, body, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)


def main():
    parser = argparse.ArgumentParser(description="Serve the VertiGO repo root.")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--capture", action="store_true", help="accept POST /_capture into proof/")
    args = parser.parse_args()
    root = args.root.resolve()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    server.root = root
    server.capture = args.capture
    server.sequence = 1
    server.daemon_threads = True
    print(f"VertiGO at http://127.0.0.1:{args.port}/ (root {root})", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("server stopped", flush=True)
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
