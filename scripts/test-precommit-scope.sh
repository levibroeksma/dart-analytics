#!/usr/bin/env bash
# Fixture test for scripts/run-precommit-gates.sh's path scoping.
# PRECOMMIT_STAGED=<file of paths> replaces the staged list, PRECOMMIT_DRY=1
# prints the gates instead of running them, PRECOMMIT_GATES=<tsv> replaces
# scripts/precommit-gates.tsv.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN="$ROOT/scripts/run-precommit-gates.sh"
PASSED=0
FAILED=0
D="$(mktemp -d)"
trap 'rm -rf "$D"' EXIT
SCOPED="check-type-barrels.sh check-game-rules.sh test-check-game-rules.sh check-tag-seeds.sh test-check-tag-seeds.sh"
ALWAYS="$(grep -cvE '^#|^$|	.' "$ROOT/scripts/precommit-gates.tsv")"

ok() { PASSED=$((PASSED + 1)); }
bad() { FAILED=$((FAILED + 1)); echo "FAIL: $1" >&2; sed 's/^/    /' "$D/out" >&2; }
# plan <staged path or ""> : dry-run output in $D/out
plan() { printf '%s' "${1:+$1$'\n'}" > "$D/staged"; (cd "$ROOT" && PRECOMMIT_STAGED="$D/staged" PRECOMMIT_DRY=1 sh "$RUN" > "$D/out" 2>&1); }
has() { grep -qx "scripts/$1" "$D/out"; }
count() { grep -c '^scripts/' "$D/out"; }

plan "docs/architecture/01-Principles.md"
none=1; for s in $SCOPED; do has "$s" && none=0; done
if [ "$(count)" = "$ALWAYS" ] && [ "$none" = 1 ]; then ok; else bad "doc path runs only the always-gates"; fi

plan "app/src/lib/game/x.ts"
if has check-type-barrels.sh && ! has check-tag-seeds.sh; then ok; else bad "app/src path runs type-barrels, not tag-seeds"; fi

plan "docs/game-rules/rulesets/501.md"
if has check-game-rules.sh && has test-check-game-rules.sh && has check-tag-seeds.sh && has test-check-tag-seeds.sh && ! has check-type-barrels.sh; then ok; else bad "game-rules path runs the four rules/tag gates"; fi

plan "scripts/check-type-barrels.sh"
if has check-type-barrels.sh; then ok; else bad "a gate's own script path runs that gate"; fi

plan ""
if [ "$(count)" = "$ALWAYS" ]; then ok; else bad "empty staged list runs only the always-gates"; fi

plan "docs/a b/app/src/x.ts"
if ! has check-type-barrels.sh; then ok; else bad "a path with a space stays one entry"; fi

printf 'scripts/nope.sh\t\n' > "$D/gates.tsv"; : > "$D/staged"
if ! (cd "$ROOT" && PRECOMMIT_GATES="$D/gates.tsv" PRECOMMIT_STAGED="$D/staged" PRECOMMIT_DRY=1 sh "$RUN" > "$D/out" 2>&1) && grep -qF "pre-commit: scripts/nope.sh missing" "$D/out"; then ok; else bad "a row naming a missing script fails"; fi

echo "precommit-scope: $PASSED passed, $FAILED failed"
[ "$FAILED" -eq 0 ]
