#!/usr/bin/env bash
# Gate-wiring gate: the hand-kept gate lists must agree with scripts/.
#   1. every scripts/check-*.sh and scripts/test-*.sh is named in
#      .github/workflows/quality.yml or pr-gates.yml;
#   2. every one of them is named in .claude/skills/run-all-gates/SKILL.md;
#   3. every row of scripts/precommit-gates.tsv names an existing script;
#   4. every scripts/check-*.sh is in that table or in NOT_IN_PRECOMMIT below;
#   5. every script .claude/hooks/edit-gate.py names exists.
#
# WHAT THIS CANNOT CATCH: a script named in a comment but run nowhere; a gate
# wired with the wrong arguments or working directory.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
CI=".github/workflows/quality.yml .github/workflows/pr-gates.yml"
SKILL=".claude/skills/run-all-gates/SKILL.md"
TABLE="scripts/precommit-gates.tsv"

# check-*.sh gates that run in CI and the skill only, each with its reason.
NOT_IN_PRECOMMIT="
check-doc-sync.sh          fails the code commit that precedes its docs commit
check-context-map.sh       docs gate; CI and skill only
check-doc-links.sh         docs gate; CI and skill only
check-context-budget.sh    docs gate; CI and skill only
check-decision-ids.sh      silent unless decisions/** changed
check-dupes.sh             needs fallow
check-quality-benchmarks.sh needs fallow
check-test-repointing.sh   advisory, diff-based (pr-gates.yml)
"

FAIL=0
N=0
for f in scripts/check-*.sh scripts/test-*.sh; do
  b="$(basename "$f")"
  N=$((N + 1))
  # shellcheck disable=SC2086
  grep -qF -- "$b" $CI || { echo "not in CI (quality.yml / pr-gates.yml): $b" >&2; FAIL=1; }
  grep -qF -- "$b" "$SKILL" || { echo "not in run-all-gates skill: $b" >&2; FAIL=1; }
  case "$b" in check-*)
    if ! grep -q "^scripts/$b	" "$TABLE" && ! grep -q "^$b " <<< "$NOT_IN_PRECOMMIT"; then
      echo "not in pre-commit table or NOT_IN_PRECOMMIT: $b" >&2; FAIL=1
    fi ;;
  esac
done

while IFS=$'\t' read -r gate _; do
  case "$gate" in ''|'#'*) continue ;; esac
  [ -f "$gate" ] || { echo "pre-commit table names a missing script: $gate" >&2; FAIL=1; }
done < "$TABLE"

for s in $(grep -oE 'scripts/[a-z0-9-]+\.sh' .claude/hooks/edit-gate.py | sort -u); do
  [ -f "$s" ] || { echo "edit-gate.py names a missing script: $s" >&2; FAIL=1; }
done

if [ "$FAIL" -ne 0 ]; then exit 1; fi
echo "OK: $N gate scripts wired in quality.yml and run-all-gates; pre-commit rows resolve."
