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
# RESERVATIONS COUNT AS TAKEN: a plan under docs/superpowers/plans/ names the id
# its decision will use (`Decision id: **D123**`, or the later `**Decision id:**
# D317` spelling) tasks before the block exists, and those plans merge to main
# ahead of the decisions they reserve. Ignoring them hands the next author an id
# an in-flight plan is already holding — which is why this branch's own id had to
# skip D315, D316 and D317 to reach D318. They are unioned into the maximum
# against both refs, so the printed id clears the ledger and the queue.
#
# SIDE EFFECT: this script runs `git fetch origin main`, which writes the local
# origin/main remote-tracking ref. Advisory does not mean read-only.
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

# Both historical spellings: `- Decision id: **D123**` and `**Decision id:** D317
# (reserved; ...)`. The asterisks are tolerated on either side of the colon, and
# the id taken is the first D<digits> after it.
RESERVED_RE='Decision id\*{0,2}:\*{0,2}[[:space:]]*\*{0,2}D[0-9]+'

reserved_from_tree() {
  git grep -ohE "$RESERVED_RE" -- 'docs/superpowers/plans/**.md' 2>/dev/null || true
}

reserved_from_main() {
  git grep -ohE "$RESERVED_RE" origin/main -- 'docs/superpowers/plans/**.md' 2>/dev/null || true
}

MAX=$( { ids_from_tree; ids_from_main; reserved_from_tree; reserved_from_main; } \
  | grep -oE 'D[0-9]+' \
  | sed 's/D0*//' \
  | sort -n \
  | tail -1 || true )

if [ -z "${MAX:-}" ]; then
  echo "FAIL: no decision ids found under decisions/ — is this the right repo?" >&2
  exit 1
fi

echo "D$((MAX + 1))"
