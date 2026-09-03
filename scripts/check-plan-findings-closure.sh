#!/usr/bin/env bash
# Plan findings-closure gate — F59. A plan's "Closes FINDINGS.md F<id>"
# claim (in its Global Constraints or header) is only as good as an actual
# deletion step for that id somewhere in the plan; nothing before this
# mechanically checked the two lists agree. Companion to
# scripts/check-findings-log.sh, which checks FINDINGS.md's own shape —
# this checks a *plan file's* claim against its own task text.
#
# WHAT THIS CANNOT DO: it cannot verify the deletion step actually deletes
# the right block, or that a plan's code is correct — only that every id it
# claims to close has *some* step whose text names deleting that id's
# FINDINGS.md block. See docs/superpowers/specs/2026-09-03-open-findings-cleanup-design.md
# Task 3 for the companion gate-script-diff reminder, which is NOT
# mechanically checkable and is handled separately by the PostToolUse hook.
#
# ARGUMENT: the plan file to check (required — no default, unlike
# check-findings-log.sh, since there is no single canonical plan file).

set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

PLAN="${1:?usage: check-plan-findings-closure.sh <plan-file.md>}"

[ -f "$PLAN" ] || { echo "FAIL: $PLAN not found" >&2; exit 1; }

python3 - "$PLAN" <<'PY'
import re
import sys
from pathlib import Path

plan_path = sys.argv[1]
text = Path(plan_path).read_text(encoding="utf-8")

# "Closes FINDINGS.md F12" / "Closes FINDINGS.md F12, F13" / "closes F12"
# (case-insensitive on "closes"; F-ids comma-or-and-separated)
CLOSES_RE = re.compile(r"[Cc]loses(?:\s+FINDINGS\.md)?\s+((?:F\d+[,\s]*(?:and)?\s*)+)")
FID_RE = re.compile(r"F(\d+)")
# A step that names deleting/closing that id's own FINDINGS.md block.
DELETES_RE = re.compile(
    r"(delet\w*|remov\w*|clos\w*).{0,80}\bF(\d+)\b|"
    r"\bF(\d+)\b.{0,80}(delet\w*|remov\w*|clos\w*)",
    re.IGNORECASE,
)

claimed: set[int] = set()
claim_spans: list[tuple[int, int]] = []
for m in CLOSES_RE.finditer(text):
    claim_spans.append(m.span())
    for fid in FID_RE.finditer(m.group(1)):
        claimed.add(int(fid.group(1)))

if not claimed:
    print(f"OK: {plan_path} makes no 'Closes FINDINGS.md F<id>' claim — nothing to check")
    sys.exit(0)

# Mask out the claim spans themselves before scanning for deletion evidence —
# "Closes FINDINGS.md F12" would otherwise satisfy DELETES_RE on its own
# ("Closes" matches the clos\w* alternative), letting the claim sentence
# masquerade as its own deletion step.
masked = list(text)
for start, end in claim_spans:
    for i in range(start, end):
        masked[i] = " "
masked_text = "".join(masked)

deleted: set[int] = set()
for m in DELETES_RE.finditer(masked_text):
    fid = m.group(2) or m.group(3)
    if fid:
        deleted.add(int(fid))

missing = sorted(claimed - deleted)
if missing:
    ids = ", ".join(f"F{i}" for i in missing)
    print(
        f"FAIL: {plan_path} claims to close {ids} but no step's text names "
        f"deleting/closing that id's FINDINGS.md block",
        file=sys.stderr,
    )
    sys.exit(1)

print(f"OK: {plan_path} — all {len(claimed)} claimed closure(s) have a matching deletion step")
sys.exit(0)
PY
