#!/usr/bin/env bash
# Fixture test for scripts/check-context-budget.sh: a drifting File Inventory row
# fails; --update rewrites only that row; a rerun passes; pack totals are untouched.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GATE="$ROOT/scripts/check-context-budget.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

FAILED=0
fail() { FAILED=$((FAILED + 1)); echo "FAIL: $1" >&2; }

ARCH="$TMP/docs/architecture"
mkdir -p "$ARCH"
head -c 4000 /dev/zero | tr '\0' 'a' > "$ARCH/01-A.md"
head -c 4000 /dev/zero | tr '\0' 'b' > "$ARCH/02-B.md"
printf '# Context Packs\n\n| Task | Load | Budget |\n| --- | --- | --- |\n| Any | `01-A.md` | ~1k |\n\n# Authority Order\n' > "$ARCH/00-Context-Map.md"
cat > "$ARCH/00-File-Inventory.md" <<'MD'
# File Inventory

| File | Purpose | Status | Tokens |
| --- | --- | --- | --- |
| `01-A.md` | ok row | canonical | ~1k |
| `02-B.md` | drifting row | canonical | ~5k |
MD

run() { CONTEXT_BUDGET_ROOT="$TMP" bash "$GATE" "$@" 2>&1; }

out="$(run)"; code=$?
[ "$code" -ne 0 ] || fail "drifting row should fail without --update"
grep -qF "02-B.md claimed=~5k computed=~1k" <<< "$out" || fail "failure should name the row and computed value"

cp "$ARCH/00-File-Inventory.md" "$TMP/before.md"
cp "$ARCH/00-Context-Map.md" "$TMP/map-before.md"
out="$(run --update)"; code=$?
[ "$code" -eq 0 ] || fail "--update should exit 0: $out"
grep -qF "UPDATED: 02-B.md ~5k -> ~1k" <<< "$out" || fail "--update should report the row"

changed="$(diff "$TMP/before.md" "$ARCH/00-File-Inventory.md" | grep -c '^>')"
[ "$changed" -eq 1 ] || fail "--update should change exactly one line, changed $changed"
grep -qF '| `02-B.md` | drifting row | canonical | ~1k |' "$ARCH/00-File-Inventory.md" || fail "drifting row not rewritten"
grep -qF '| `01-A.md` | ok row | canonical | ~1k |' "$ARCH/00-File-Inventory.md" || fail "in-tolerance row changed"
cmp -s "$TMP/map-before.md" "$ARCH/00-Context-Map.md" || fail "Context Map was rewritten"

out="$(run)" || fail "rerun without flag should pass: $out"
grep -q '^OK' <<< "$out" || fail "rerun should report OK"
out="$(run --update)"
grep -q 'UPDATED' <<< "$out" && fail "second --update should change nothing"

if [ "$FAILED" -eq 0 ]; then echo "test-check-context-budget: PASS"; exit 0; fi
exit 1
