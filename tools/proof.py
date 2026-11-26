#!/usr/bin/env python3
import argparse
import contextlib
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROOF = ROOT / "proof"
SERVE = Path(__file__).resolve().with_name("serve.py")
CHROME_CANDIDATES = (
    os.environ.get("CHROME_PATH"),
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
)
WIDTH, HEIGHT = 1280, 720
MAX_GIF_BYTES = 3 * 1024 * 1024


def find_chrome():
    for candidate in CHROME_CANDIDATES:
        if candidate and Path(candidate).is_file():
            return Path(candidate)
    raise SystemExit("Chrome not found: set CHROME_PATH to chrome.exe")


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def wait_until_listening(process, port):
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise SystemExit(f"tools/serve.py exited with code {process.returncode}")
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=0.25)
            return
        except urllib.error.HTTPError:
            return
        except OSError:
            time.sleep(0.1)
    raise SystemExit(f"server on port {port} did not start")


@contextlib.contextmanager
def serve(capture):
    port = free_port()
    command = [sys.executable, str(SERVE), "--port", str(port), "--root", str(ROOT)]
    if capture:
        command.append("--capture")
    process = subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        wait_until_listening(process, port)
        yield port
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()


def parse_shots(text):
    try:
        shots = [int(part) for part in text.split(",") if part.strip()]
    except ValueError:
        raise SystemExit("--shots takes comma-separated whole sim seconds, e.g. 1,2,3")
    if not shots or any(shot < 0 for shot in shots):
        raise SystemExit("--shots takes comma-separated non-negative sim seconds")
    return shots


def shot_url(port, day, shot):
    return f"http://127.0.0.1:{port}/index.html?proof=day-{day}&t={shot}"


def fail(command, output):
    print("command:", subprocess.list2cmdline(command))
    print(output.strip() or "(no output)")
    raise SystemExit(1)


def capture_headless(day, shots):
    chrome = find_chrome()
    folder = PROOF / f"day-{day}"
    folder.mkdir(parents=True, exist_ok=True)
    with serve(capture=False) as port:
        for shot in shots:
            png = (folder / f"{shot:02d}.png").resolve()
            png.unlink(missing_ok=True)
            command = [
                str(chrome), "--headless=new", "--disable-gpu", "--hide-scrollbars",
                f"--window-size={WIDTH},{HEIGHT}", "--virtual-time-budget=4000",
                f"--screenshot={png}", shot_url(port, day, shot),
            ]
            try:
                result = subprocess.run(command, capture_output=True, text=True, timeout=120)
            except subprocess.TimeoutExpired as error:
                fail(command, f"timed out after 120 s\n{error.stderr or ''}")
            if not png.is_file() or png.stat().st_size == 0:
                fail(command, result.stderr or result.stdout)
            print(f"{png.relative_to(ROOT)}  {png.stat().st_size} bytes")


def wait_for_new_png(folder, before, timeout=600):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        new = sorted(set(folder.glob("*.png")) - before)
        if new:
            return new[0]
        time.sleep(0.5)
    raise SystemExit(f"no PNG appeared in {folder} within {timeout} s")


def capture_manual(day, shots):
    folder = PROOF / f"day-{day}"
    folder.mkdir(parents=True, exist_ok=True)
    with serve(capture=True) as port:
        for shot in shots:
            png = folder / f"{shot:02d}.png"
            png.unlink(missing_ok=True)
            before = set(folder.glob("*.png"))
            print(f"open {shot_url(port, day, shot)}")
            print(f"save the PNG into {folder} (or let capture.js POST it), expected {png.name}", flush=True)
            webbrowser.open(shot_url(port, day, shot))
            new = wait_for_new_png(folder, before)
            if new != png:
                new.replace(png)
            print(f"{png.relative_to(ROOT)}  {png.stat().st_size} bytes")


def run_ffmpeg(command):
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode:
        print(subprocess.list2cmdline(command))
        print(result.stderr.strip())
        raise SystemExit(1)


def build_gif(day):
    folder = PROOF / f"day-{day}"
    frames = sorted(folder.glob("*.png"))
    if not frames:
        raise SystemExit(f"no PNGs in {folder}; run shot first")
    output = folder / f"day-{day}.gif"
    with tempfile.TemporaryDirectory() as temp:
        listing = Path(temp) / "frames.txt"
        entries = "".join(f"file '{frame.as_posix()}'\nduration 1.0\n" for frame in frames)
        listing.write_text(entries + f"file '{frames[-1].as_posix()}'\n", encoding="utf-8")
        size = 0
        for fps in (12, 8, 6):
            palette = Path(temp) / "palette.png"
            scale = f"scale='min(960,iw)':-1:flags=lanczos,fps={fps}"
            run_ffmpeg(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(listing),
                        "-vf", f"{scale},palettegen=stats_mode=diff", str(palette)])
            run_ffmpeg(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(listing),
                        "-i", str(palette), "-lavfi",
                        f"{scale},paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle",
                        "-loop", "0", str(output)])
            size = output.stat().st_size
            print(f"gif {fps} fps  {size / 1024:.0f} KiB")
            if size <= MAX_GIF_BYTES:
                break
        else:
            raise SystemExit(f"{output} is {size / 1048576:.1f} MB even at 6 fps")
    print(f"wrote {output.relative_to(ROOT)}")


def main():
    parser = argparse.ArgumentParser(description="Capture VertiGO visual proof and assemble GIFs.")
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("shot", "day"):
        command = sub.add_parser(name)
        command.add_argument("--day", type=int, required=True)
        command.add_argument("--shots", required=True, help="comma-separated sim seconds, e.g. 1,2,3")
        command.add_argument("--manual", action="store_true", help="open in the default browser and wait for the PNG")
    gif = sub.add_parser("gif")
    gif.add_argument("--day", type=int, required=True)
    args = parser.parse_args()

    if args.command == "gif":
        build_gif(args.day)
        return
    index = ROOT / "index.html"
    if not index.is_file():
        raise SystemExit(f"{index} does not exist yet; nothing to capture")
    shots = parse_shots(args.shots)
    if args.manual:
        capture_manual(args.day, shots)
    else:
        capture_headless(args.day, shots)
    if args.command == "day":
        build_gif(args.day)


if __name__ == "__main__":
    main()
