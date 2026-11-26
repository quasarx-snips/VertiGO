#!/usr/bin/env python3
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "src"
HEADER = re.compile(r"^\s*//\s*origin:\s*([AHP])(?:\s*\|\s*ai-lines:\s*(\d+))?")
LIMIT = 0.33

# origin A means the whole file is machine written, H means none of it is, and P
# means partly, in which case the header must carry the machine written count.
# Deriving A and H from the file itself stops the numbers drifting as the code
# changes, which is what made the first version of this report nonsense.
rows = []
unlabelled = []
paths = sorted(SOURCE.rglob("*.js")) if SOURCE.is_dir() else []
for path in paths:
    if "vendor" in path.relative_to(SOURCE).parts:
        continue
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    origin, declared = "H", 0
    for line in lines[:20]:
        match = HEADER.match(line)
        if match:
            origin = match.group(1)
            declared = int(match.group(2) or 0)
            break
    else:
        unlabelled.append(path)
    total = len(lines)
    if origin == "A":
        ai = total
    elif origin == "H":
        ai = 0
    else:
        ai = min(declared, total)
    rows.append((path, origin, total, ai))

print(f"{'file':<44} {'o':>1} {'lines':>6} {'ai':>6}")
for path, origin, total, ai in rows:
    print(f"{str(path.relative_to(ROOT)):<44} {origin:>1} {total:>6} {ai:>6}")

ai_total = sum(row[3] for row in rows)
line_total = sum(row[2] for row in rows)
ratio = ai_total / line_total if line_total else 0.0
print(f"ai {ai_total} / total {line_total} = {ratio * 100:.1f}%")
if unlabelled:
    print("unlabelled:")
    for path in unlabelled:
        print(f"  {path.relative_to(ROOT)}")
print(f"limit {LIMIT * 100:.0f}%")
sys.exit(1 if ratio > LIMIT else 0)
