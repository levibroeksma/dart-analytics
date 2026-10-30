#!/usr/bin/env bash
# Class-composition gate (docs/architecture/07-Frontend/05-Astro-Components.md):
# build-time class merges use cn(); never Astro class:list or .filter(Boolean).join.
set -u
cd "${CHECK_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || echo .)}"

# Per-file mode: relpaths as args (relative to the root) scan only those files.
FILE_MODE=0
TARGETS=(app/src)
if [ "$#" -gt 0 ]; then
  FILE_MODE=1
  TARGETS=()
  for a in "$@"; do [ -f "$a" ] && TARGETS+=("$a"); done
  [ "${#TARGETS[@]}" -eq 0 ] && exit 0
fi

FAIL=0

CLASS_LIST=$(grep -RHIn --include='*.astro' 'class:list' "${TARGETS[@]}" 2>/dev/null || true)
if [ -n "$CLASS_LIST" ]; then
  echo "FAIL: Astro class:list found — compose with cn() in frontmatter // Styles (class={className}):" >&2
  echo "$CLASS_LIST" >&2
  FAIL=1
fi

MANUAL_JOIN=$(grep -RHIn --include='*.astro' '\.filter(Boolean)\.join(' "${TARGETS[@]}" 2>/dev/null || true)
if [ -n "$MANUAL_JOIN" ]; then
  echo "FAIL: manual class merge (.filter(Boolean).join) found — use cn():" >&2
  echo "$MANUAL_JOIN" >&2
  FAIL=1
fi

if [ "$FAIL" -ne 0 ]; then
  exit 1
fi

[ "$FILE_MODE" -eq 1 ] && exit 0
echo "OK: no class:list or manual class-join in app/src/**/*.astro."
