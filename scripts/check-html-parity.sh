#!/usr/bin/env bash
# HTML parity check for markup-only refactors. Every page prerenders, so
# `astro build` writes each page's full HTML; this compares that HTML byte for
# byte against a base saved from the tree before the refactor.
#   bash scripts/check-html-parity.sh --save   build, save the HTML as the base
#   bash scripts/check-html-parity.sh          build, compare with the base
# PARITY_DIST=<dir> replaces the build output (no build runs);
# PARITY_BASE=<dir> replaces app/.parity/base.
#
# Not a CI gate: the base comes from another commit. Run it by hand around a
# template split.
#
# One id is random per build (`CountdownResumePrompt.astro` mints its SVG
# gradient ids with `crypto.randomUUID()`); MASK below blanks them on both sides.
# Nothing else is normalised: whitespace counts.
#
# WHAT THIS CANNOT CATCH: a component no page renders; markup a client script
# builds at run time; a change in a hashed asset under dist/_astro/.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE="${PARITY_BASE:-$ROOT/app/.parity/base}"
DIST="${PARITY_DIST:-}"

if [ -z "$DIST" ]; then
  (cd "$ROOT/app" && PUBLIC_NEON_AUTH_BASE_URL=https://example.invalid npm run build > /dev/null 2>&1) \
    || { echo "html parity: build failed" >&2; exit 1; }
  DIST="$ROOT/app/dist"
fi

MASK='s/(paused-play-[a-z]+)-[0-9a-f]{8}/\1-ID/g'
masked() { sed -E "$MASK" "$1"; }

pages() { (cd "$1" && find . -name '*.html' | sed 's#^\./##' | LC_ALL=C sort); }

if [ "${1:-}" = "--save" ]; then
  rm -rf "$BASE"
  mkdir -p "$BASE"
  pages "$DIST" | while IFS= read -r page; do
    mkdir -p "$BASE/$(dirname "$page")"
    cp "$DIST/$page" "$BASE/$page"
  done
  echo "html parity: base saved ($(pages "$BASE" | wc -l | tr -d ' ') files)"
  exit 0
fi

[ -d "$BASE" ] || { echo "html parity: no base: run --save on the tree before the change" >&2; exit 1; }

FAIL=0
COUNT=0
while IFS= read -r page; do
  COUNT=$((COUNT + 1))
  if [ ! -f "$BASE/$page" ] || [ ! -f "$DIST/$page" ]; then
    echo "DIFF $page (present on one side only)" >&2
    FAIL=1
  elif ! cmp -s <(masked "$BASE/$page") <(masked "$DIST/$page"); then
    echo "DIFF $page" >&2
    cmp <(masked "$BASE/$page") <(masked "$DIST/$page") 2>&1 | sed -E 's#^/dev/fd/[0-9]+ /dev/fd/[0-9]+ ##' | head -1 >&2
    FAIL=1
  fi
done < <({ pages "$BASE"; pages "$DIST"; } | LC_ALL=C sort -u)

if [ "$FAIL" -ne 0 ]; then exit 1; fi
echo "html parity: $COUNT files identical"
