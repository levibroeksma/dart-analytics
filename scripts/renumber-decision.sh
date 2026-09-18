#!/usr/bin/env bash
# Decision-id renumber helper (issue #386). When CI's check-decision-ids.sh
# reports that a branch's id collided with one main issued in the meantime, the
# fix is mechanical but spread out: the decision block itself, CLAUDE.md rule
# lines, 00-File-Inventory.md rows, .gitignore comments, plan and spec files,
# and the PR body all cite the id. Missing one leaves a dangling reference that
# no gate catches.
#
# The blast radius also includes the id gate's own oracle: scripts/decision-
# row-hashes.tsv, scripts/decision-map.txt, scripts/split-decisions.sh, and
# the three decision scripts' own headers all cite ids as prose or data. The
# on-main guard below makes this mostly unreachable in practice — every id
# those files cite is already on main, so none of them can ever be OLD — but
# that is worth saying rather than leaving implicit.
#
# This rewrites every tracked occurrence and reports what it touched, so the
# diff can be eyeballed before committing. The PR body is NOT rewritten — it
# lives on GitHub, not in the tree. Fix it by hand; the script reminds you.
#
# SAFETY: refuses to run with a dirty index (so the rewrite is reviewable as its
# own diff), refuses to renumber to an id that already has a row or heading in
# decisions/**.md, and never touches decisions/** blocks other than by the
# substitution itself — a renumbered id is still the same append-only block,
# not an edit to a different one.
set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

OLD="${1:-}"
NEW="${2:-}"

if ! [[ "$OLD" =~ ^D(0[1-9]|[1-9][0-9]*)$ ]] || ! [[ "$NEW" =~ ^D(0[1-9]|[1-9][0-9]*)$ ]]; then
  echo "usage: bash scripts/renumber-decision.sh <old-id> <new-id>   (e.g. D287 D291)" >&2
  exit 1
fi

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "FAIL: working tree is not clean — commit or unstage first so the rewrite is its own diff" >&2
  exit 1
fi

if git grep -qE "^\| ${NEW} \||^### ${NEW}([^0-9]|\$)" -- 'decisions/**.md'; then
  echo "FAIL: ${NEW} already exists in decisions/ — derive a free id with scripts/next-decision-id.sh" >&2
  exit 1
fi

# The 20 decision ids never issued (numbering artifacts from the original
# ledger split — see scripts/check-decision-ids.sh's BASELINE_IDS comment).
# They never appear in decisions/**, so the exists-check above can never
# catch one as NEW; it has to be refused explicitly, here.
NEVER_ISSUED_IDS=" D18 D19 D29 D38 D39 D42 D43 D44 D45 D46 D47 D48 D49 D53 D54 D55 D56 D57 D58 D59 "
if [[ "$NEVER_ISSUED_IDS" == *" ${NEW} "* ]]; then
  echo "FAIL: ${NEW} is one of the 20 never-issued ids — a numbering artifact that is never filled, not a decision — derive a free id with scripts/next-decision-id.sh" >&2
  exit 1
fi

if ! git fetch --quiet origin main 2>/dev/null; then
  echo "WARN: could not fetch origin/main — checking ${OLD} against a possibly stale local ref" >&2
fi

if git grep -qE "^\| ${OLD} \||^### ${OLD} " origin/main -- 'decisions/**.md' 2>/dev/null; then
  echo "FAIL: ${OLD} is already on origin/main — this tool only moves an id that exists solely on the current branch" >&2
  exit 1
fi

FILES=$(git grep -l "\b${OLD}\b" -- . ':!node_modules' || true)

if [ -z "$FILES" ]; then
  echo "FAIL: ${OLD} does not appear in any tracked file" >&2
  exit 1
fi

echo "Rewriting ${OLD} -> ${NEW}:"
while IFS= read -r file; do
  count=$(grep -oE "\b${OLD}\b" "$file" | wc -l | tr -d ' ' || true)
  perl -pi -e "s/\b${OLD}\b/${NEW}/g" "$file"
  echo "  ${file} (${count})"
done <<< "$FILES"

echo
echo "OK: rewrote ${OLD} -> ${NEW}. Two things this did NOT do:"
echo "  1. the PR body on GitHub still cites ${OLD} — edit it with 'gh pr edit'"
echo "  2. nothing was committed — review 'git diff' first"
