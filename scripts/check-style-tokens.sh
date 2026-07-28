#!/usr/bin/env bash
# Style-token gate (app/CLAUDE.md "Style non-negotiables" / D108, D126, D128):
# no font-medium, no {...rest} spread, no raw bg-bg*/text-fg* palette
# utilities across app/src/**/*.astro and *.css. Previously enforced only by
# human review of the diff.
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

FAIL=0

FONT_MEDIUM=$(grep -rnE 'font-medium' app/src --include="*.astro" --include="*.css")
if [ -n "$FONT_MEDIUM" ]; then
  echo "FAIL: font-medium found — use font-normal/font-semibold/font-bold instead:" >&2
  echo "$FONT_MEDIUM" >&2
  FAIL=1
fi

REST_SPREAD=$(grep -rnE '\{\.\.\.rest\}' app/src --include="*.astro")
if [ -n "$REST_SPREAD" ]; then
  echo "FAIL: {...rest} found — forward leftover attributes as {...props} instead:" >&2
  echo "$REST_SPREAD" >&2
  FAIL=1
fi

RAW_PALETTE=$(grep -rnE '\b(bg-bg[a-z0-9-]*|text-fg[a-z0-9-]*)\b' app/src --include="*.astro" --include="*.css")
if [ -n "$RAW_PALETTE" ]; then
  echo "FAIL: raw palette utility found — use semantic tokens (surface/foreground/muted*/accent*/states) instead:" >&2
  echo "$RAW_PALETTE" >&2
  FAIL=1
fi

if [ "$FAIL" -ne 0 ]; then
  exit 1
fi
echo "OK: no font-medium, {...rest}, or raw bg-bg*/text-fg* palette utilities under app/src."
