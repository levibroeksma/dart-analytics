#!/usr/bin/env bash
# Style-token gate (app/CLAUDE.md "Style non-negotiables" / D108, D126, D128, D161, D175):
# - no {...rest} spread, no raw bg-bg*/text-fg* palette utilities (font-medium allowed since D428)
# - no Tailwind important modifier at all — neither prefix (!utility) nor
#   suffix (utility!, formerly the sanctioned v4 form under D175 — see D226)
# - no leading-dash arbitrary negatives (-left-[45%]) — use left-[-45%]
# Scan: app/src/**/*.{astro,css}.
#
# Prefix-! patterns (avoid Alpine/JS !ident and :class boolean negation):
#   1. Static class= / class={`...`} only — (^|[^:]) so :class= is excluded
#   2. Quoted/backticked compound !util-… or !util-[…] / !util[…] (cn multiline, :class compounds)
#   3. Bare "!flex" on the same line as cn(
# Gaps (accepted): variable-held "!flex"; bare :class={`!flex`}; @apply !util
#   (@apply skipped — collides with CSS !important).
# Neg-arbitrary: token-anchor (^|[[:space:]"'`=(]) not \b (quote/-/paren boundary);
#   [^]] for BSD grep. Use POSIX [[:space:]] inside a bracket expression — \s is
#   NOT a whitespace shorthand there, it matches a literal backslash or 's'.
#   -left-[45%] and -inset-x-[10%] banned (multi-segment prop via (-[a-z0-9]+)*);
#   left-[-45%] / -mt-4 / -rotate-45 OK; grid-cols-[13] not matched. Mid-attribute
#   occurrences (preceded by whitespace, not just quote/start) are caught too.
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

FAIL=0

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

IMPORTANT_MODIFIER=$(
  {
    # Prefix form: !utility (banned since D175)
    grep -rnE '(^|[^:])class="[^"]*![a-z]|(^|[^:])class='\''[^'\'']*![a-z]|(^|[^:])class=\{`[^`]*![a-z]' \
      app/src --include="*.astro" --include="*.css" || true
    grep -rnE '["'\''`]![a-z][a-z0-9]*(-[a-z0-9./%-]+|-\[[^]]+\]|\[[^]]+\])' \
      app/src --include="*.astro" --include="*.css" || true
    grep -rnE 'cn\([^)]*["'\''`]![a-z]+["'\''`]' \
      app/src --include="*.astro" || true
    # Suffix form: utility! (banned since D226 — supersedes D175's endorsement)
    grep -rnE '(^|[^:])class="[^"]*[a-zA-Z0-9_./%]!([[:space:]]|")' \
      app/src --include="*.astro" --include="*.css" || true
    grep -rnE "(^|[^:])class='[^']*[a-zA-Z0-9_./%]!([[:space:]]|')" \
      app/src --include="*.astro" --include="*.css" || true
    grep -rnE '(^|[^:])class=\{`[^`]*[a-zA-Z0-9_./%]!([[:space:]]|`)' \
      app/src --include="*.astro" --include="*.css" || true
    grep -rnE 'cn\([^)]*["'\''`][a-zA-Z0-9_./%-]+!["'\''`]' \
      app/src --include="*.astro" || true
  } | sort -u
)
if [ -n "$IMPORTANT_MODIFIER" ]; then
  echo "FAIL: Tailwind important modifier found (prefix !utility or suffix utility!) — compose overrides through cn()'s merge ordering, or extend the primitive's own variant/prop surface instead:" >&2
  echo "$IMPORTANT_MODIFIER" >&2
  FAIL=1
fi

NEG_ARBITRARY=$(grep -rnE '(^|[[:space:]"'\''`=(])-[a-z][a-z0-9]*(-[a-z0-9]+)*-\[[^]]+\]' app/src --include="*.astro" --include="*.css")
if [ -n "$NEG_ARBITRARY" ]; then
  echo "FAIL: leading-dash arbitrary utility (-prop-[…]) found — put the minus inside the brackets (prop-[-…]):" >&2
  echo "$NEG_ARBITRARY" >&2
  FAIL=1
fi

# Overlay gate (D429): full-viewport overlays and dialog roles live only in
# ui/Modal.astro — every modal renders through the sheet shell.
# OVERLAY_PENDING is the migration ratchet; it must end empty.
OVERLAY_ALLOW="app/src/components/ui/Modal.astro"
OVERLAY_PENDING=(
)
OVERLAY_FILES=$(grep -rlE 'fixed inset-0|role="dialog"' app/src --include="*.astro" | sort)
OVERLAY_BAD=""
for f in $OVERLAY_FILES; do
  [ "$f" = "$OVERLAY_ALLOW" ] && continue
  skip=0
  for p in "${OVERLAY_PENDING[@]+"${OVERLAY_PENDING[@]}"}"; do
    [ "$f" = "$p" ] && skip=1
  done
  [ "$skip" -eq 0 ] && OVERLAY_BAD="$OVERLAY_BAD$f"$'\n'
done
if [ -n "$OVERLAY_BAD" ]; then
  echo "FAIL: overlay outside ui/Modal.astro — render it through Modal (sheet shell):" >&2
  printf '%s' "$OVERLAY_BAD" >&2
  FAIL=1
fi

if [ "$FAIL" -ne 0 ]; then
  exit 1
fi
echo "OK: no {...rest}, raw bg-bg*/text-fg*, important modifier (prefix or suffix), or leading-dash arbitrary (-prop-[…]) under app/src."
