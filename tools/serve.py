#!/usr/bin/env python3
import argparse
import base64
import json
import mimetypes
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
GUESS = {
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
}
DAY = re.compile(r"[A-Za-z0-9._-]+")


def content_type(path):
    return (
        GUESS.get(path.suffix.lower())
        or mimetypes.guess_type(path.name)[0]
        or "application/octet-stream"
    )


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self._file(True)

    def do_HEAD(self):
        self._file(False)

    def do_POST(self):
        if self.server.capture and urlsplit(self.path).path == "/_capture":
            self._capture()
        else:
            self._refuse()

    def _refuse(self):
        self._send(405, b"method not allowed", "text/plain; charset=utf-8")

    do_PUT = do_DELETE = do_PATCH = do_OPTIONS = _refuse

    def _file(self, send_body):
        path = unquote(urlsplit(self.path).path)
        if path.endswith("/"):
            path += "index.html"
        target = (self.server.root / path.lstrip("/")).resolve()
        root = self.server.root
        if not target.is_file() or (target != root and root not in target.parents):
            self._send(404, b"not found", "text/plain; charset=utf-8")
            return
        self._send(200, target.read_bytes() if send_body else b"", content_type(target))

    def _capture(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            message = json.loads(self.rfile.read(length))
            day = message["day"]
            if not DAY.fullmatch(day):
                raise ValueError("day must match [A-Za-z0-9._-]+")
            png = base64.b64decode(message["png"].split(",", 1)[1], validate=True)
        except (IndexError, KeyError, TypeError, ValueError) as error:
            self._send(400, str(error).encode(), "text/plain; charset=utf-8")
            return
        folder = self.server.root / "proof" / day
        folder.mkdir(parents=True, exist_ok=True)
        sequence = self.server.sequence
        while (folder / f"{sequence:02d}.png").exists():
            sequence += 1
        (folder / f"{sequence:02d}.png").write_bytes(png)
        self.server.sequence = sequence + 1
        self._send(204, b"", "text/plain; charset=utf-8")

    def _send(self, status, body, kind):
        self.send_response(status)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD" and body:
            self.wfile.write(body)


def main():
    parser = argparse.ArgumentParser(description="Serve the VertiGO repo root.")
    parser.add_argument("--port", type=int, default=8090)
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
