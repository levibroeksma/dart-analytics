#!/usr/bin/env bash
# Next-decision-id helper (issue #386). DECISIONS.md's "How to add a decision"
# tells an author to derive the next id rather than guess it. The command it
# gives reads the WORKING TREE, which is correct at authoring time and stale by
# merge time: a branch cut when main was at D286 derives D287, and if two
# decisions land on main in the meantime, that id is now someone else's.
#
# This script derives against fetched origin/main UNION the working tree — the
# working tree being whichever repository the caller's cwd resolves to via
# `git rev-parse --show-toplevel` below, not this script's own worktree — so
# an id it prints is free on both. Run it when authoring a decision, and again
# immediately before opening the PR.
#
# WHAT THIS CANNOT DO: it cannot see an id that exists only on another open
# branch that has not merged. Two branches in flight can still derive the same
# id. That race is caught by scripts/check-decision-ids.sh, which CI runs on the
# pull_request MERGE ref (.github/workflows/checks.yml -> quality.yml), and is
# fixed cheaply by scripts/renumber-decision.sh. This script narrows the window;
# it does not close it, and nothing local can.
#
# BOTH ID FORMS ARE SEARCHED: migrated table rows (`| D123 |`) and block
# headings (`### D123`) share one id space. Searching one form alone
# under-reports the maximum and re-issues a live id. Both patterns are
# position-anchored for the same reason check-decision-ids.sh anchors them:
# `D18` is also darts shorthand for double 18.
#
# STDOUT CONTRACT — DEVIATION FROM THE PLAN'S DEFAULT: unlike this repo's other
# scripts/*.sh, this one never prints a trailing OK: line on success; stdout
# must stay exactly one line, `D<n>`, because Task 2 and the decision-authoring
# skill step both parse it programmatically and an extra line would break both
# callers, while the FAIL: message on a real error still goes to stderr, unchanged.
set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

if ! git fetch --quiet origin main 2>/dev/null; then
  echo "WARN: could not fetch origin/main — deriving from the working tree only" >&2
fi

ids_from_tree() {
  git grep -ohE '^\| D[0-9]+ \||^### D[0-9]+' -- 'decisions/**.md' 2>/dev/null || true
}

ids_from_main() {
  git grep -ohE '^\| D[0-9]+ \||^### D[0-9]+' origin/main -- 'decisions/**.md' 2>/dev/null || true
}

MAX=$( { ids_from_tree; ids_from_main; } \
  | grep -oE 'D[0-9]+' \
  | sed 's/D0*//' \
  | sort -n \
  | tail -1 || true )

if [ -z "${MAX:-}" ]; then
  echo "FAIL: no decision ids found under decisions/ — is this the right repo?" >&2
  exit 1
fi

echo "D$((MAX + 1))"
