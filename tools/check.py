#!/usr/bin/env python3
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ABSOLUTE_ASSET = re.compile(r"""(?:src|href)\s*=\s*["']/""")
problems = []


def read_lines(path):
    return path.read_text(encoding="utf-8", errors="replace").splitlines()


for entry in (ROOT / "index.html", ROOT / "styles", ROOT / "src"):
    files = [entry] if entry.is_file() else sorted(entry.rglob("*")) if entry.is_dir() else []
    for path in files:
        if not path.is_file() or path.suffix not in {".html", ".css", ".js", ".mjs"}:
            continue
        for number, line in enumerate(read_lines(path), 1):
            if ABSOLUTE_ASSET.search(line):
                problems.append(f"{path.relative_to(ROOT)}:{number}: absolute asset path")

vendor = ROOT / "src" / "vendor" / "three.min.js"
if not vendor.is_file():
    problems.append("src/vendor/three.min.js: missing")

source = ROOT / "src"
if source.is_dir():
    for path in sorted(source.rglob("*.js")):
        if "vendor" in path.relative_to(source).parts:
            continue
        count = len(read_lines(path))
        if count > 400:
            problems.append(f"{path.relative_to(ROOT)}: {count} lines (over 400)")

for problem in problems:
    print(problem)
print("ok" if not problems else f"{len(problems)} problem(s)")
sys.exit(1 if problems else 0)
