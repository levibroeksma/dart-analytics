#!/usr/bin/env bash
# Findings-log gate — durable guard for FINDINGS.md (root CLAUDE.md's
# "A finding is not a work item" hard invariant; D214, which supersedes
# D107's narrower self-learning gate).
#
# Six checks:
#   1. Front matter  — the file exists, opens with an HTML comment carrying
#                      `status:`, and carries `highest-issued: F<n>`.
#   2. Field shape   — every `### F<id> — <title>` block carries all seven
#                      required fields: Status, Found, Task (on the header
#                      line, `·`-separated) plus Claim, Evidence, Impact,
#                      Proposed (one leading-anchored line each).
#   3. Id integrity  — ids are unique and none exceeds `highest-issued`.
#   4. Status vocab  — `Status:` is `Open` or `Raised`. Never `Resolved`:
#                      a resolved finding is DELETED, not restatused. This
#                      is the load-bearing difference from DECISIONS.md and
#                      the reason ids come from a high-water mark instead of
#                      a scan (deleting the highest-numbered entry must not
#                      make the next id collide with it).
#   5. Live evidence — every backtick-quoted path in an `Evidence:` line
#                      resolves to a file that exists. The check with teeth
#                      over time: a finding whose evidence was deleted or
#                      moved fails the build, so the log cannot rot into a
#                      list of claims about files that no longer exist.
#   6. ISO dates     — every `Found:` value is a real YYYY-MM-DD date.
#
# WHAT THIS GATE CANNOT DO, stated plainly so nobody mistakes its green for
# a guarantee: it proves the log is well-formed and its evidence is live. It
# cannot prove an agent logged a finding instead of fixing it — no script
# detects the absence of a fix that was never written. The CLAUDE.md
# invariant carries that obligation; this script carries only the shape.
#
# EVIDENCE-PATH HEURISTIC (check 5): a backtick span counts as a path only
# when it contains `/` or ends in a known file extension, and any trailing
# `:<line>` / `:<start>-<end>` locator is stripped before the existence
# test. Prose in an Evidence line legitimately backticks non-paths (`gh`,
# `D213`, `graphify query "<q>"`), and demanding those exist on disk would
# make the check unusable. Paths are resolved from the repo root, never
# from the caller's cwd.
#
# ARGUMENT: takes an optional path (default FINDINGS.md) purely so the
# gate can be aimed at a fixture file to prove it FAILS on malformed input.
# A gate not proven to bite is not a gate. Pre-commit and CI both invoke
# the zero-argument form.

set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

FINDINGS="${1:-FINDINGS.md}"

[ -f "$FINDINGS" ] || { echo "FAIL: $FINDINGS not found" >&2; exit 1; }

python3 - "$FINDINGS" <<'PY'
import datetime
import re
import sys
from pathlib import Path

findings_path = sys.argv[1]
FAIL = 0


def err(msg: str) -> None:
    global FAIL
    print(f"FAIL: {msg}", file=sys.stderr)
    FAIL = 1


def ok(msg: str) -> None:
    print(f"OK: {msg}")


text = Path(findings_path).read_text(encoding="utf-8")
lines = text.split("\n")

HEADING_RE = re.compile(r"^### F([0-9]+) — (.+)$")
HIGH_WATER_RE = re.compile(r"^highest-issued: F([0-9]+)\s*$", re.MULTILINE)
HEADER_FIELD_RE = re.compile(
    r"^Status:\s*(\S+)\s*·\s*Found:\s*(\S+)\s*·\s*Task:\s*(\S.*)$"
)
BODY_FIELDS = ("Claim", "Evidence", "Impact", "Proposed")
VALID_STATUS = {"Open", "Raised"}

# --- Check 1: front matter --------------------------------------------------
if not lines or not lines[0].startswith("<!--"):
    err(f"{findings_path} does not open with an HTML-comment front-matter block")
head = "\n".join(lines[:8])
if not re.search(r"^status:", head, re.MULTILINE):
    err(f"{findings_path} front matter lacks a `status:` line")

hw_match = HIGH_WATER_RE.search(head)
if hw_match is None:
    err(f"{findings_path} front matter lacks a `highest-issued: F<n>` line")
    high_water = None
else:
    high_water = int(hw_match.group(1))
    ok(f"front matter — `status:` present, high-water mark F{high_water}")

# --- Parse blocks -----------------------------------------------------------
blocks: list[dict] = []
current: dict | None = None
for lineno, line in enumerate(lines, start=1):
    m = HEADING_RE.match(line)
    if m:
        current = {
            "id": int(m.group(1)),
            "title": m.group(2),
            "lineno": lineno,
            "body": [],
        }
        blocks.append(current)
        continue
    if current is not None:
        if line.startswith("## ") or line.startswith("# "):
            current = None
            continue
        current["body"].append((lineno, line))

if not blocks:
    ok(f"{findings_path} holds no findings (an empty log is a valid state)")

# --- Checks 2, 4, 6: per-block field shape, status vocabulary, dates --------
for b in blocks:
    label = f"F{b['id']}"
    body_text = [ln for _, ln in b["body"]]
    header_line = next((ln for ln in body_text if ln.startswith("Status:")), None)
    if header_line is None:
        err(f"{findings_path}:{b['lineno']}: {label} has no `Status: … · Found: … · Task: …` header line")
    else:
        hm = HEADER_FIELD_RE.match(header_line)
        if hm is None:
            err(
                f"{findings_path}:{b['lineno']}: {label} header line is malformed — "
                f"expected `Status: <s> · Found: <YYYY-MM-DD> · Task: <branch>`, got {header_line!r}"
            )
        else:
            status, found, _task = hm.group(1), hm.group(2), hm.group(3)
            if status not in VALID_STATUS:
                err(
                    f"{findings_path}:{b['lineno']}: {label} has Status: {status} — "
                    f"only {sorted(VALID_STATUS)} are valid; a resolved finding is DELETED, never restatused"
                )
            try:
                datetime.date.fromisoformat(found)
            except ValueError:
                err(f"{findings_path}:{b['lineno']}: {label} Found: {found!r} is not an ISO YYYY-MM-DD date")
    for field in BODY_FIELDS:
        if not any(ln.startswith(f"{field}:") for ln in body_text):
            err(f"{findings_path}:{b['lineno']}: {label} is missing its required `{field}:` field")

if blocks and not FAIL:
    ok(f"field shape — all {len(blocks)} block(s) carry the seven required fields, valid Status, ISO Found date")

# --- Check 3: ids unique and within the high-water mark ---------------------
seen: dict[int, int] = {}
for b in blocks:
    if b["id"] in seen:
        err(f"{findings_path}:{b['lineno']}: duplicate id F{b['id']} (first seen at line {seen[b['id']]})")
    else:
        seen[b["id"]] = b["lineno"]
    if high_water is not None and b["id"] > high_water:
        err(
            f"{findings_path}:{b['lineno']}: F{b['id']} exceeds the high-water mark F{high_water} — "
            "bump `highest-issued:` in the same edit that issues a new id"
        )
if blocks and high_water is not None and len(seen) == len(blocks):
    ok(f"ids — {len(blocks)} unique id(s), none above the high-water mark F{high_water}")

# --- Check 5: evidence paths resolve ---------------------------------------
BACKTICK_RE = re.compile(r"`([^`]+)`")
KNOWN_EXT = (
    ".md", ".sh", ".ts", ".js", ".json", ".sql", ".yml", ".yaml",
    ".astro", ".css", ".py", ".tsv", ".txt", ".graphifyignore",
)
LOCATOR_RE = re.compile(r":\d+(-\d+)?$")


def looks_like_path(token: str) -> bool:
    if " " in token:
        return False
    stripped = LOCATOR_RE.sub("", token)
    return "/" in stripped or stripped.endswith(KNOWN_EXT) or stripped.startswith(".")


checked = 0
for b in blocks:
    for lineno, line in b["body"]:
        if not line.startswith("Evidence:"):
            continue
        for token in BACKTICK_RE.findall(line):
            if not looks_like_path(token):
                continue
            candidate = LOCATOR_RE.sub("", token)
            checked += 1
            if not Path(candidate).exists():
                err(
                    f"{findings_path}:{lineno}: F{b['id']} cites evidence `{token}` "
                    "but that path does not exist — a finding whose evidence is gone is a finding to delete"
                )
if checked:
    ok(f"evidence — all {checked} cited path(s) resolve")
elif blocks:
    ok("evidence — no path-shaped citations to resolve")

if FAIL:
    sys.exit(1)
sys.exit(0)
PY
