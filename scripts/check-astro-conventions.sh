#!/usr/bin/env bash
# Astro template conventions (05-Astro-Components / 10-Frontend-Agent-Guide):
# 1) every opening tag with x-show also has x-cloak
# 2) no HTML comments <!-- --> in the template region (after frontmatter)
set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

python3 - "$@" <<'PY'
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path("app/src")
fail = 0


def template_region(text: str) -> str:
    """Return markup after the closing --- of frontmatter, or full text if none."""
    if not text.startswith("---"):
        return text
    end = text.find("\n---", 3)
    if end == -1:
        return text
    # skip the closing --- line
    after = text.find("\n", end + 1)
    return text if after == -1 else text[after + 1 :]


def opening_tags(template: str) -> list[tuple[int, str]]:
    """Return (line_in_template, full_tag) for each opening/self-closing tag."""
    tags: list[tuple[int, str]] = []
    i = 0
    while True:
        start = template.find("<", i)
        if start == -1:
            break
        # skip closing tags and comments / doctype
        if template.startswith("</", start) or template.startswith("<!--", start) or template.startswith("<!", start):
            i = start + 1
            continue
        # find end of tag, respecting quotes
        j = start + 1
        quote = None
        while j < len(template):
            ch = template[j]
            if quote:
                if ch == quote:
                    quote = None
            elif ch in "\"'":
                quote = ch
            elif ch == ">":
                break
            j += 1
        else:
            break
        tag = template[start : j + 1]
        line = template.count("\n", 0, start) + 1
        tags.append((line, tag))
        i = j + 1
    return tags


def check_file(path: Path) -> None:
    global fail
    text = path.read_text(encoding="utf-8")
    template = template_region(text)
    # HTML comments in template
    for m in re.finditer(r"<!--", template):
        line = template.count("\n", 0, m.start()) + 1
        # map to file line: frontmatter offset
        offset = text.find(template)
        file_line = text.count("\n", 0, offset + m.start()) + 1 if offset >= 0 else line
        print(f"FAIL: {path}:{file_line}: HTML comment <!-- --> forbidden in .astro template; use {{/* */}}", file=sys.stderr)
        fail = 1
    for line, tag in opening_tags(template):
        if re.search(r"\bx-show\b", tag) and not re.search(r"\bx-cloak\b", tag):
            offset = text.find(template)
            file_line = text.count("\n", 0, offset) + line if offset >= 0 else line
            print(f"FAIL: {path}:{file_line}: x-show without x-cloak on the same element", file=sys.stderr)
            fail = 1


def main() -> int:
    global fail
    files = sorted(ROOT.rglob("*.astro"))
    if not files:
        print("FAIL: no .astro files under app/src", file=sys.stderr)
        return 1
    for path in files:
        check_file(path)
    if fail:
        return 1
    print("OK: Astro x-show/x-cloak pairing and no template HTML comments.")
    return 0


sys.exit(main())
PY
