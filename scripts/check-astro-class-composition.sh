#!/usr/bin/env bash
# Class-composition gate (docs/architecture/07-Frontend/05-Astro-Components.md):
# build-time class merges use cn(); never Astro class:list or .filter(Boolean).join.
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

FAIL=0

CLASS_LIST=$(grep -RIn --include='*.astro' 'class:list' app/src 2>/dev/null || true)
if [ -n "$CLASS_LIST" ]; then
  echo "FAIL: Astro class:list found — compose with cn() in frontmatter // Styles (class={className}):" >&2
  echo "$CLASS_LIST" >&2
  FAIL=1
fi

MANUAL_JOIN=$(grep -RIn --include='*.astro' '\.filter(Boolean)\.join(' app/src 2>/dev/null || true)
if [ -n "$MANUAL_JOIN" ]; then
  echo "FAIL: manual class merge (.filter(Boolean).join) found — use cn():" >&2
  echo "$MANUAL_JOIN" >&2
  FAIL=1
fi

if [ "$FAIL" -ne 0 ]; then
  exit 1
fi

echo "OK: no class:list or manual class-join in app/src/**/*.astro."
