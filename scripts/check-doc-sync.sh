#!/usr/bin/env bash
# Doc-sync gate (D317).
#
# THE RULE: a change that touches domain logic the architecture docs
# describe must also touch those docs. Deliberately narrow — the paths below
# were calibrated against the last 80 first-parent merges on main, tuned
# until false positives reached zero. The calibration table is in the PR
# that introduced this file.
#
# TRIGGERS (what the docs describe):
#   database/migrations/          — every migration has a spec chapter
#   app/src/services/             — the layer 06-API/ contracts describe
#   app/src/modules/game/         — Pattern 18 engines
#   app/src/modules/training/     — 09-Training/
#   app/src/modules/dartbot/      — 08-DartBot.md
#   app/src/modules/stats/        — the read-model layer
#
# NOT a trigger, deliberately: app/src/modules/ui/. It holds browser-API
# shims (wake lock and friends), and three of the four false positives the
# calibration found were the same wake-lock file. A shim owes no
# architecture entry.
#
# SATISFIED BY: any edit under docs/architecture/ or decisions/.
# NOT satisfied by docs/superpowers/**: specs and plans are non-canonical
# (D312) and rank below the code they describe, so counting them would let
# the gate pass on a document that is not authority.
#
# STYLE TWEAKS AND TEST-ONLY CHANGES DO NOT TRIP IT: neither app/tests/ nor
# app/src/components/ nor app/src/styles/ is a trigger path.
#
# NOT wired into .husky/pre-commit, on purpose: it diffs against the merge
# base, so mid-branch it would fail every commit before the one that writes
# the docs. It runs at claim time (run-all-gates) and at PR time (CI), which
# are the two moments the question "are the docs owed?" can be answered.
#
# ARGUMENTS: an optional list of changed paths, purely so the gate can be
# aimed at a fixture set to prove it FAILS. A gate not proven to bite is not
# a gate.
set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

TRIGGER='^(database/migrations/|app/src/services/|app/src/modules/(game|training|dartbot|stats)/)'
SATISFIER='^(docs/architecture/|decisions/)'
BASE_REF="${DOC_SYNC_BASE_REF:-origin/main}"

if [ "$#" -gt 0 ]; then
  CHANGED=$(printf '%s\n' "$@")
elif ! git diff --cached --quiet 2>/dev/null; then
  CHANGED=$(git diff --cached --name-only --diff-filter=ACMR)
else
  if git rev-parse --verify --quiet "$BASE_REF" >/dev/null; then
    MERGE_BASE=$(git merge-base "$BASE_REF" HEAD 2>/dev/null || echo "")
  else
    MERGE_BASE=""
  fi
  if [ -z "$MERGE_BASE" ]; then
    echo "SKIP: doc-sync — no change set to check (no staged files, no merge base with $BASE_REF)."
    exit 0
  fi
  CHANGED=$(git diff --name-only --diff-filter=ACMR "$MERGE_BASE"..HEAD)
fi

TRIGGERED=$(printf '%s\n' "$CHANGED" | grep -E "$TRIGGER" || true)
if [ -z "$TRIGGERED" ]; then
  echo "OK: doc-sync — no change under a documented domain path."
  exit 0
fi

if printf '%s\n' "$CHANGED" | grep -qE "$SATISFIER"; then
  echo "OK: doc-sync — domain paths changed and canonical docs changed with them."
  exit 0
fi

echo "FAIL: doc-sync — these files changed with no edit under docs/architecture/ or decisions/:" >&2
printf '%s\n' "$TRIGGERED" | sed 's/^/  /' >&2
cat >&2 <<'MSG'

Update the doc that describes what you changed, or add the decision that
records why it changed. docs/superpowers/ does not satisfy this gate —
specs and plans are non-canonical (D312) and rank below the code.

If the change genuinely alters nothing any doc describes, that is a real
answer — say so in the PR and narrow this gate's TRIGGER in its own change,
with the calibration re-run. Do not add a silencer.
MSG
exit 1
