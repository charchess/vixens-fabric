#!/usr/bin/env python3
"""Emit GitHub warning annotations for legacy identifiers without failing CI."""
from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

FORBIDDEN = ("-recovery", "synelia", "-umi")


def tracked_files(root: Path) -> list[Path]:
    result = subprocess.run(
        ["git", "ls-files", "-z"], cwd=root, check=True, capture_output=True
    )
    return [root / raw.decode("utf-8") for raw in result.stdout.split(b"\0") if raw]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path.cwd())
    args = parser.parse_args()
    root = args.root.resolve()
    findings = 0
    for path in tracked_files(root):
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        relative = path.relative_to(root)
        for number, line in enumerate(text.splitlines(), start=1):
            lowered = line.lower()
            for marker in FORBIDDEN:
                if marker in lowered:
                    print(
                        f"::warning file={relative},line={number},title=Legacy identifier::"
                        f"found prohibited legacy marker {marker!r}"
                    )
                    findings += 1
    print(f"legacy identifier warnings: {findings}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
