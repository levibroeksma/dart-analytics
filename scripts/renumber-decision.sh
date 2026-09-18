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
# own-block guard below makes this mostly unreachable in practice — every id
# those files cite has main's own block behind it, so none of them can ever be
# OLD — but that is worth saying rather than leaving implicit.
#
# This rewrites every tracked occurrence and reports what it touched, so the
# diff can be eyeballed before committing. The PR body is NOT rewritten — it
# lives on GitHub, not in the tree. Fix it by hand; the script reminds you.
#
# SAFETY: five refusals. A malformed or zero-padded id; a NEW that already has a
# row or heading in decisions/**.md; a NEW in the 20-id never-issued set; an OLD
# whose block in this tree is origin/main's own, or is declared twice (the
# unresolved post-merge state — see the guard below for why those are one test);
# and a dirty working tree, so the rewrite is reviewable as its own diff. It
# never touches decisions/** blocks other than by the substitution itself — a
# renumbered id is still the same append-only block, not an edit to a different
# one.
#
# SIDE EFFECT: this script runs `git fetch origin main`, which writes the local
# origin/main remote-tracking ref. Advisory does not mean read-only.
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

FILES=$(git grep -l "\b${OLD}\b" -- . ':!node_modules' || true)

if [ -z "$FILES" ]; then
  echo "FAIL: ${OLD} does not appear in any tracked file" >&2
  exit 1
fi

# The headline case is an id main has SINCE ISSUED to a different decision, so
# OLD being present on origin/main is the norm, not a defect — a guard that
# refuses on presence alone refuses every real collision. What must never happen
# is rewriting main's own block. Pre-merge this tree holds only the branch's
# block, so the substitution is safe; post-merge it holds both, and a blind
# rewrite would rename main's too. OLD's declaration lines under decisions/**
# tell those states apart: two of them is the unresolved post-merge tree, and
# one that is byte-identical to a line on origin/main IS main's block.
DECL_RE="^\| ${OLD} \||^### ${OLD}([^0-9]|\$)"
OLD_DECLS=$(git grep -hE "$DECL_RE" -- 'decisions/**.md' 2>/dev/null || true)
OLD_DECL_COUNT=$(printf '%s\n' "$OLD_DECLS" | grep -c . || true)

if [ "$OLD_DECL_COUNT" -eq 0 ]; then
  echo "FAIL: ${OLD} has no row or heading in decisions/**.md — this tool renumbers a decision's own block, not a bare citation of one" >&2
  exit 1
fi

if [ "$OLD_DECL_COUNT" -gt 1 ]; then
  echo "FAIL: ${OLD} is declared ${OLD_DECL_COUNT} times in decisions/**.md — that is the post-merge state where the branch's block and main's share one id; resolve the merge first, then renumber" >&2
  exit 1
fi

if ! git fetch --quiet origin main 2>/dev/null; then
  echo "WARN: could not fetch origin/main — checking ${OLD} against a possibly stale local ref" >&2
fi

MAIN_DECLS=$(git grep -hE "$DECL_RE" origin/main -- 'decisions/**.md' 2>/dev/null || true)

if printf '%s\n' "$MAIN_DECLS" | grep -qxF -- "$OLD_DECLS"; then
  echo "FAIL: ${OLD}'s block in this tree is origin/main's own — renumbering it would rewrite someone else's decision; this tool only moves a block the branch itself authored" >&2
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
