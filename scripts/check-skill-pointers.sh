#!/usr/bin/env bash
# Skill / rule pointer gate — Context Maintenance (root CLAUDE.md).
#
# D311's finding was that none of the eight vendored skill copies was
# registered in 00-File-Inventory.md, so no gate script ever read them and
# every upstream drift landed unobserved. This gate closes that for the
# files the repo does own. Three assertions:
#
#   1. every .claude/skills/*/SKILL.md is registered in 00-File-Inventory.md
#   2. every .claude/rules/*.md is registered in 00-File-Inventory.md
#   3. every `superpowers:<name>` named in a LIVE tracked Markdown file
#      resolves to a skill directory in the installed plugin cache
#
# Assertion 3 is SKIPPED, not failed, when the cache is absent: CI installs
# no plugins, so demanding it there would make the gate permanently red for
# a reason CI cannot fix. Local runs carry the check; CI runs 1 and 2.
#
# Assertion 3's scan set deliberately excludes the append-only and historical
# trees — decisions/**, docs/superpowers/**, docs/braindump/** and
# 00-Context-Map-History.md. D311's own Consequences paragraph records that
# mentions there are provenance, not live pointers, and decisions cannot be
# edited to follow an upstream rename even if one happened. This mirrors the
# carve-out check-doc-links.sh already makes for the same trees.
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

INVENTORY="docs/architecture/00-File-Inventory.md"
FAIL=0
err() { echo "FAIL: $*" >&2; FAIL=1; }

if [ ! -f "$INVENTORY" ]; then
  echo "FAIL: missing $INVENTORY" >&2
  exit 1
fi

# --- 1 + 2. Registration ----------------------------------------------------
for f in $(git ls-files '.claude/skills/*/SKILL.md' '.claude/rules/*.md'); do
  grep -qF "\`$f\`" "$INVENTORY" \
    || err "$f is not registered in $INVENTORY"
done

# --- 3. superpowers: pointers resolve --------------------------------------
CACHE_ROOT="${SUPERPOWERS_CACHE_ROOT:-$HOME/.claude/plugins/cache/claude-plugins-official/superpowers}"
if [ ! -d "$CACHE_ROOT" ]; then
  echo "SKIP: plugin cache not found at $CACHE_ROOT — superpowers: pointers unchecked."
else
  NAMES=$(git grep -hoE 'superpowers:[a-z][a-z0-9-]*' -- '*.md' \
    ':!decisions' ':!docs/superpowers' ':!docs/braindump' \
    ':!docs/architecture/00-Context-Map-History.md' \
    | sed 's/^superpowers://' | sort -u)
  for name in $NAMES; do
    found=0
    for d in "$CACHE_ROOT"/*/skills/"$name"; do
      [ -d "$d" ] && { found=1; break; }
    done
    [ $found -eq 1 ] \
      || err "superpowers:$name does not resolve under $CACHE_ROOT"
  done
fi

[ $FAIL -eq 0 ] && echo "OK: skill/rule inventory rows present and superpowers: pointers resolve."
exit $FAIL
