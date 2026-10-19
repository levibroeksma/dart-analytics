#!/usr/bin/env bash
# Style-token gate (app/CLAUDE.md "Style non-negotiables" / D108, D126, D128, D161, D175):
# - no {...rest} spread, no raw bg-bg*/text-fg* palette utilities (font-medium allowed since D428)
# - no Tailwind important modifier at all — neither prefix (!utility) nor
#   suffix (utility!, formerly the sanctioned v4 form under D175 — see D226)
# - no leading-dash arbitrary negatives (-left-[45%]) — use left-[-45%]
# Scan: app/src/**/*.{astro,css}.
# - no Tailwind arbitrary value/modifier/property/variant (D451): prop-[…],
#   /[…], [prop:value], [&…], and v4 variable shorthand prop-(--x),
#   prop-(type:--x), /(--x) in app/src .astro/.ts (tests excluded) and in
#   @apply lines of app/src/styles/*.css. Exceptions: ARBITRARY_ALLOW rows
#   ("path|match", match = exact substring the regex extracts), one reason
#   comment each; a row that no longer matches fails, so dead rows cannot
#   linger as cover.
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

ARB_RE='[a-z][a-z0-9-]*-\[[^] ]+\]|/\[[^] ]+\]|\[[a-z-]+:[^] ]+\]|\[&[^] ]+\]|[a-z][a-z0-9-]*-\(([a-z-]+:)?--[a-z0-9-]+\)|/\(--[a-z0-9-]+\)'
ARBITRARY_ALLOW=(
  # responsive card grid; no stock grid-cols-N auto-fills tracks at a minimum width
  "app/src/pages/games/index.astro|grid-cols-[repeat(auto-fill,minmax(320px,1fr))]"
  # layout-property animation; no stock transition group covers top/left/width/height
  "app/src/components/ui/GrowingCard.astro|transition-[top,left,width,height]"
  # CSS grid accordion; stock grid-rows-N means repeat(N, …), not a track size
  "app/src/components/forms/Select.astro|grid-rows-[0fr]"
  "app/src/components/forms/Select.astro|grid-rows-[1fr]"
  "app/src/components/forms/Select.astro|transition-[grid-template-rows]"
  # viewport-fraction cap; no stock dvh fraction
  "app/src/components/forms/Select.astro|max-h-[60dvh]"
  # left is in no stock transition group
  "app/src/components/forms/SlideToStart.astro|transition-[left,scale]"
  # sheet height = viewport minus margin
  "app/src/components/ui/Modal.astro|max-h-[calc(100dvh-2rem)]"
  # one-off grid templates; tokenise on second use
  "app/src/components/layout/games/setup/FiveOhOneSetupForm.astro|grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)]"
  "app/src/components/layout/games/setup/FiveOhOneSetupForm.astro|grid-cols-[minmax(0,1fr)_72px]"
  "app/src/components/layout/games/SinglePlayerSummary.astro|grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]"
  "app/src/components/layout/games/setup/SetupShell.astro|grid-cols-[40px_1fr_40px]"
  # glass utilities' top-lit wash; v4 has no theme namespace for gradient position
  "app/src/styles/global.css|bg-radial-[at_50%_0%]"
  # regex literals, not classes
  "app/src/lib/game/rulesets/config-codec.ts|/[A-Z]"
  "app/src/modules/stats/routine-scope.module.ts|name-[0-9a-f]"
)
ARB_HITS=$(
  {
    grep -rnoE "$ARB_RE" app/src --include="*.astro" --include="*.ts" --exclude="*.test.ts" || true
    grep -rnE '@apply' app/src/styles --include="*.css" | while IFS= read -r line; do
      loc=${line%%:*}
      rest=${line#*:}
      num=${rest%%:*}
      printf '%s\n' "${rest#*:}" | grep -oE "$ARB_RE" | sed "s|^|$loc:$num:|"
    done
  } | sort -u
)
ARB_BAD=""
ARB_USED=""
while IFS= read -r hit; do
  [ -z "$hit" ] && continue
  file=${hit%%:*}
  rest=${hit#*:}
  match=${rest#*:}
  allowed=0
  for row in ${ARBITRARY_ALLOW[@]+"${ARBITRARY_ALLOW[@]}"}; do
    if [ "$row" = "$file|$match" ]; then
      allowed=1
      ARB_USED="$ARB_USED$row"$'\n'
    fi
  done
  [ "$allowed" -eq 0 ] && ARB_BAD="$ARB_BAD$hit"$'\n'
done <<< "$ARB_HITS"
ARB_STALE=""
for row in ${ARBITRARY_ALLOW[@]+"${ARBITRARY_ALLOW[@]}"}; do
  printf '%s' "$ARB_USED" | grep -qxF -- "$row" || ARB_STALE="$ARB_STALE$row"$'\n'
done
if [ -n "$ARB_BAD" ]; then
  echo "FAIL: Tailwind arbitrary value found (D451). Fix in this order:" >&2
  echo "  1. stock v4 class (spacing takes any 0.25 step: h-4.5, gap-0.75; h-lh; scale-106; flex-2)" >&2
  echo "  2. existing @theme token in app/src/styles/global.css (text-*, rounded-*, grid-cols-*)" >&2
  echo "  3. new token in global.css first (D428), then use it" >&2
  echo "  4. @utility in global.css for a repeated composite" >&2
  echo "  5. last resort: an ARBITRARY_ALLOW row in this script, with a reason (reviewed)" >&2
  echo "  A .ts regex literal is not a class: add its row under '# regex literals, not classes'." >&2
  echo "  See docs/architecture/07-Frontend/07-Style-Guide.md §Arbitrary values." >&2
  printf '%s' "$ARB_BAD" >&2
  FAIL=1
fi
if [ -n "$ARB_STALE" ]; then
  echo "FAIL: ARBITRARY_ALLOW row matches nothing — delete it:" >&2
  printf '%s' "$ARB_STALE" >&2
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
echo "OK: no {...rest}, raw bg-bg*/text-fg*, important modifier (prefix or suffix), leading-dash arbitrary (-prop-[…]) or unlisted arbitrary value under app/src."
