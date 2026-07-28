#!/usr/bin/env bash
# tsconfig/vitest alias-sync gate (D113): app/tsconfig.json declared `@lib` in
# compilerOptions.paths before vitest.config.ts's resolve.alias carried a
# matching entry; a test importing `@lib` through vi.mock() never exercised
# real module resolution, so the gap stayed invisible until a genuine
# (non-mocked) import broke. This script fails when the two alias sets ever
# diverge again.
#
# ALLOWLIST: aliases below are TS-path-only by design and never a valid
# import target from a `.ts` test file, so they are exempt from requiring a
# vitest.config.ts counterpart:
#   @styles -> app/src/styles (CSS files; Vitest's node environment cannot
#     import a stylesheet, and nothing under app/tests/ should ever try).
set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

TSCONFIG="app/tsconfig.json"
VITEST_CONFIG="app/vitest.config.ts"
ALLOWLIST_TSCONFIG_ONLY="@styles"

for f in "$TSCONFIG" "$VITEST_CONFIG"; do
  if [ ! -f "$f" ]; then
    echo "FAIL: $f not found" >&2
    exit 1
  fi
done

TSCONFIG_ALIASES=$(python3 -c "
import json
with open('$TSCONFIG', encoding='utf-8') as fh:
    data = json.load(fh)
paths = data.get('compilerOptions', {}).get('paths', {})
for key in paths:
    print(key.rstrip('/*'))
" | sort -u)

VITEST_ALIASES=$(grep -oE '"@[A-Za-z0-9]+"[[:space:]]*:' "$VITEST_CONFIG" \
  | grep -oE '"@[A-Za-z0-9]+"' | tr -d '"' | sort -u || true)

FAIL=0

while IFS= read -r alias; do
  [ -z "$alias" ] && continue
  case " $ALLOWLIST_TSCONFIG_ONLY " in
    *" $alias "*) continue ;;
  esac
  echo "FAIL: $alias is in $TSCONFIG's compilerOptions.paths but missing from $VITEST_CONFIG's resolve.alias — a genuine (non-mocked) import through this alias will fail to resolve in tests" >&2
  FAIL=1
done < <(comm -23 <(printf '%s\n' "$TSCONFIG_ALIASES") <(printf '%s\n' "$VITEST_ALIASES"))

while IFS= read -r alias; do
  [ -z "$alias" ] && continue
  echo "FAIL: $alias is in $VITEST_CONFIG's resolve.alias but missing from $TSCONFIG's compilerOptions.paths — TypeScript will not resolve this alias outside tests" >&2
  FAIL=1
done < <(comm -13 <(printf '%s\n' "$TSCONFIG_ALIASES") <(printf '%s\n' "$VITEST_ALIASES"))

if [ "$FAIL" -ne 0 ]; then
  exit 1
fi

COUNT=$(printf '%s\n' "$TSCONFIG_ALIASES" | wc -l | tr -d ' ')
echo "OK: $COUNT alias(es) in sync between $TSCONFIG and $VITEST_CONFIG (allowlisted tsconfig-only: $ALLOWLIST_TSCONFIG_ONLY)."
