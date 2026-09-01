"""Extract the longest Zstandard-looking Base64 code from saved HTML.

This script never evaluates page content; it only treats it as text.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: extract_public_sample.py INPUT_HTML OUTPUT_CODE", file=sys.stderr)
        return 2
    source = Path(sys.argv[1]).read_text(encoding="utf-8")
    candidates = re.findall(r"KLUv/[A-Za-z0-9+/=]{100,}", source)
    if not candidates:
        print("no Zstandard-looking code found", file=sys.stderr)
        return 1
    code = max(candidates, key=len)
    output = Path(sys.argv[2])
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(code + "\n", encoding="ascii")
    print(f"wrote {len(code)} characters to {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
