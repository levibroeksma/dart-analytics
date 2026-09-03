#!/usr/bin/env bash
# PostToolUse hook wrapper for F59 — fires on every Write/Edit tool call
# (matcher in .claude/settings.json), filters to docs/superpowers/plans/*.md,
# then:
#   1. Runs check-plan-findings-closure.sh against the written file —
#      BLOCKING (exit 2) on a closure mismatch, per the user's own
#      "block on closure mismatch, warn on diffs" scoping decision.
#   2. Prints a non-blocking stderr reminder if the plan's text names a
#      scripts/*.sh path inside a fenced code block — not mechanically
#      verifiable (would require executing the plan's own proposed change
#      against the live repo), so this is a reminder, not a check.
#
# Reads the tool-call JSON on stdin; exits 0 silently for any tool call
# that isn't a Write/Edit of a docs/superpowers/plans/*.md file.

set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

INPUT="$(cat)"

FILE_PATH="$(python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
print(data.get("tool_input", {}).get("file_path", ""))
' <<<"$INPUT")"

case "$FILE_PATH" in
  */docs/superpowers/plans/*.md|docs/superpowers/plans/*.md) ;;
  *) exit 0 ;;
esac

[ -f "$FILE_PATH" ] || exit 0

if ! bash scripts/check-plan-findings-closure.sh "$FILE_PATH" 1>&2; then
  echo "BLOCKED: $FILE_PATH has an unclosed FINDINGS.md claim — see above, fix before this write/edit can stand." >&2
  exit 2
fi

if grep -q '```' "$FILE_PATH" && grep -qE '\bscripts/[A-Za-z0-9_.-]+\.sh\b' "$FILE_PATH"; then
  N="$(grep -cE '\bscripts/[A-Za-z0-9_.-]+\.sh\b' "$FILE_PATH")"
  echo "REMINDER: $FILE_PATH names $N scripts/*.sh reference(s) — run any proposed gate-script/checklist diff against the current repo before publishing this plan (not mechanically checked)." >&2
fi

exit 0
