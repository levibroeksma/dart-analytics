#!/usr/bin/env bash
# Doc-link / path-reference gate — Context Maintenance (root CLAUDE.md).
# Validates markdown links and path-like backtick refs across the canonical
# doc set. Alias/base-aware; skips bare identifiers and DECISIONS history noise
# (DECISIONS.md is outside the scan set). See D133.
set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

python3 - <<'PY'
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(".").resolve()
FAIL = 0

ALIASES = {
    "@client": "app/src/lib/client",
    "@server": "app/src/lib/server",
    "@lib": "app/src/lib",
    "@utils": "app/src/lib/utils",
    "@auth": "app/src/lib/auth",
    "@db": "app/src/db",
    "@services": "app/src/services",
    "@repositories": "app/src/repositories",
    "@routes": "app/src/pages/api",
    "@components": "app/src/components",
    "@layouts": "app/src/layouts",
    "@icons": "app/src/icons",
}

BASES = [
    Path("."),
    Path("docs/architecture"),
    Path("docs/architecture/05-Database"),
    Path("database"),
    Path("app"),
    Path("app/src"),
]

SKIP_CHARS = set("*…<>| \t\n")
PATH_LIKE = re.compile(
    r"`([^`]*?/[^`]*?\.(?:md|sh|sql|ts|astro|css))`"
)
MD_LINK = re.compile(r"\[([^\]]*)\]\(([^)]+)\)")


def err(msg: str) -> None:
    global FAIL
    print(f"FAIL: {msg}", file=sys.stderr)
    FAIL = 1


def canonical_files() -> list[Path]:
    files: list[Path] = []
    files.extend(sorted(Path("docs/architecture").rglob("*.md")))
    pairs = [
        Path("CLAUDE.md"),
        Path("AGENT.md"),
        Path("app/CLAUDE.md"),
        Path("app/AGENT.md"),
        Path("app/src/db/CLAUDE.md"),
        Path("app/src/db/AGENT.md"),
        Path("app/src/pages/api/CLAUDE.md"),
        Path("app/src/pages/api/AGENT.md"),
        Path("database/CLAUDE.md"),
        Path("database/AGENT.md"),
        Path("docs/CLAUDE.md"),
        Path("docs/AGENT.md"),
        Path("README.md"),
    ]
    for p in pairs:
        if p.is_file():
            files.append(p)
    # de-dupe while preserving order
    seen: set[Path] = set()
    out: list[Path] = []
    for p in files:
        rp = p.resolve()
        if rp in seen:
            continue
        seen.add(rp)
        out.append(p)
    return out


def should_skip_backtick(ref: str) -> bool:
    if "/" not in ref:
        return True
    if "NN" in ref:
        return True
    if any(c in SKIP_CHARS for c in ref):
        return True
    return False


def expand_alias(ref: str) -> str | None:
    for prefix, target in ALIASES.items():
        if ref == prefix or ref.startswith(prefix + "/"):
            rest = ref[len(prefix) :].lstrip("/")
            return f"{target}/{rest}" if rest else target
    return None


def candidates(ref: str, source: Path) -> list[Path]:
    expanded = expand_alias(ref)
    refs = [expanded] if expanded else [ref]
    # also try stripping a leading ./ 
    refs = [r[2:] if r.startswith("./") else r for r in refs]
    out: list[Path] = []
    for r in refs:
        out.append(source.parent / r)
        for base in BASES:
            out.append(base / r)
        out.append(ROOT / r)
    return out


def resolves(ref: str, source: Path) -> bool:
    for c in candidates(ref, source):
        try:
            if c.exists():
                return True
        except OSError:
            continue
    return False


def check_file(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    # 1) markdown links
    for m in MD_LINK.finditer(text):
        target = m.group(2).strip()
        if target.startswith(("http://", "https://", "mailto:", "#")):
            continue
        # strip anchor / query
        local = target.split("#", 1)[0].split("?", 1)[0]
        if not local:
            continue
        if not resolves(local, path):
            err(f"{path}: unresolved markdown link ({m.group(1)}) -> {target}")
    # 2) path-like backticks
    for m in PATH_LIKE.finditer(text):
        ref = m.group(1)
        if should_skip_backtick(ref):
            continue
        if not resolves(ref, path):
            err(f"{path}: unresolved path-like reference `{ref}`")


def main() -> int:
    files = canonical_files()
    if not files:
        err("no canonical docs found to scan")
        return 1
    for path in files:
        # safety: never scan superpowers historical tree even if rglob somehow includes it
        if "docs/superpowers" in path.parts:
            continue
        check_file(path)
    if FAIL:
        return 1
    print(f"OK: doc links and path-like references resolve ({len(files)} files scanned).")
    return 0


sys.exit(main())
PY
