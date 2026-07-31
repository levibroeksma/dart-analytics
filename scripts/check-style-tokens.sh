#!/usr/bin/env bash
# Style-token gate (app/CLAUDE.md "Style non-negotiables" / D108, D126, D128, D161, D175):
# - no font-medium, no {...rest} spread, no raw bg-bg*/text-fg* palette utilities
# - no Tailwind v3 prefix-important (!utility) — use utility! (v4)
# - no leading-dash arbitrary negatives (-left-[45%]) — use left-[-45%]
# Scan: app/src/**/*.{astro,css}.
#
# Prefix-! patterns (avoid Alpine/JS !ident and :class boolean negation):
#   1. Static class= / class={`...`} only — (^|[^:]) so :class= is excluded
#   2. Quoted/backticked compound !util-… or !util-[…] / !util[…] (cn multiline, :class compounds)
#   3. Bare "!flex" on the same line as cn(
# Gaps (accepted): variable-held "!flex"; bare :class={`!flex`}; @apply !util
#   (@apply skipped — collides with CSS !important).
# Neg-arbitrary: token-anchor (^|[\s"'`=]) not \b (quote/- boundary); [^]] for BSD grep.
#   -left-[45%] banned; left-[-45%] / -mt-4 / -rotate-45 OK; grid-cols-[13] not matched.
#   Gap (accepted): multi-segment forms like -inset-x-[10%] are NOT caught — the
#   token-anchor only matches a single word segment before the bracket
#   (-word-[...]), and the anchor's required boundary char blocks matching the
#   trailing -x-[…] alone since the preceding char there is a letter, not a
#   boundary. No known occurrence in app/src as of 2026-07-31.
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

PREFIX_IMPORTANT=$(
  {
    grep -rnE '(^|[^:])class="[^"]*![a-z]|(^|[^:])class='\''[^'\'']*![a-z]|(^|[^:])class=\{`[^`]*![a-z]' \
      app/src --include="*.astro" --include="*.css" || true
    grep -rnE '["'\''`]![a-z][a-z0-9]*(-[a-z0-9./%-]+|-\[[^]]+\]|\[[^]]+\])' \
      app/src --include="*.astro" --include="*.css" || true
    grep -rnE 'cn\([^)]*["'\''`]![a-z]+["'\''`]' \
      app/src --include="*.astro" || true
  } | sort -u
)
if [ -n "$PREFIX_IMPORTANT" ]; then
  echo "FAIL: Tailwind prefix-important (!utility) found — use suffix form (utility!) instead:" >&2
  echo "$PREFIX_IMPORTANT" >&2
  FAIL=1
fi

NEG_ARBITRARY=$(grep -rnE '(^|[\s"'\'\''`=])-[a-z][a-z0-9]*-\[[^]]+\]' app/src --include="*.astro" --include="*.css")
if [ -n "$NEG_ARBITRARY" ]; then
  echo "FAIL: leading-dash arbitrary utility (-prop-[…]) found — put the minus inside the brackets (prop-[-…]):" >&2
  echo "$NEG_ARBITRARY" >&2
  FAIL=1
fi

if [ "$FAIL" -ne 0 ]; then
  exit 1
fi
echo "OK: no font-medium, {...rest}, raw bg-bg*/text-fg*, prefix-important (!utility), or leading-dash arbitrary (-prop-[…]) under app/src."
