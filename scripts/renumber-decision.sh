#!/usr/bin/env bash
# Decision-id renumber helper (issue #386). When CI's check-decision-ids.sh
# reports that a branch's id collided with one main issued in the meantime, the
# fix is mechanical but spread out: the decision block itself, CLAUDE.md rule
# lines, 00-File-Inventory.md rows, .gitignore comments, plan and spec files,
# and the PR body all cite the id. Missing one leaves a dangling reference that
# no gate catches.
#
# This rewrites every tracked occurrence and reports what it touched, so the
# diff can be eyeballed before committing. The PR body is NOT rewritten — it
# lives on GitHub, not in the tree. Fix it by hand; the script reminds you.
#
# SAFETY: refuses to run with a dirty index (so the rewrite is reviewable as its
# own diff), refuses to renumber to an id that already exists anywhere, and
# never touches decisions/** blocks other than by the substitution itself —
# a renumbered id is still the same append-only block, not an edit to a
# different one.
set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

OLD="${1:-}"
NEW="${2:-}"

if ! [[ "$OLD" =~ ^D[0-9]+$ ]] || ! [[ "$NEW" =~ ^D[0-9]+$ ]]; then
  echo "usage: bash scripts/renumber-decision.sh <old-id> <new-id>   (e.g. D287 D291)" >&2
  exit 1
fi

if [ -n "$(git diff --cached --name-only)" ]; then
  echo "FAIL: index is not empty — commit or unstage first so the rewrite is its own diff" >&2
  exit 1
fi

if git grep -qE "^\| ${NEW} \||^### ${NEW} " -- 'decisions/**.md'; then
  echo "FAIL: ${NEW} already exists in decisions/ — derive a free id with scripts/next-decision-id.sh" >&2
  exit 1
fi

FILES=$(git grep -l "\b${OLD}\b" -- . ':!node_modules' || true)

if [ -z "$FILES" ]; then
  echo "FAIL: ${OLD} does not appear in any tracked file" >&2
  exit 1
fi

echo "Rewriting ${OLD} -> ${NEW}:"
while IFS= read -r file; do
  count=$(grep -cE "\b${OLD}\b" "$file" || true)
  perl -pi -e "s/\b${OLD}\b/${NEW}/g" "$file"
  echo "  ${file} (${count})"
done <<< "$FILES"

echo
echo "OK: rewrote ${OLD} -> ${NEW}. Two things this did NOT do:"
echo "  1. the PR body on GitHub still cites ${OLD} — edit it with 'gh pr edit'"
echo "  2. nothing was committed — review 'git diff' first"
