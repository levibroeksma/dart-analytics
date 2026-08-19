#!/usr/bin/env bash
# Context-map consistency checker — part of the mandatory Context Maintenance
# protocol (root CLAUDE.md). Fails when the context system has gone stale:
#   1. a path referenced from a CLAUDE.md / README.md / 00-Context-Map.md does not exist
#   2. a doc quotes a migration range that disagrees with database/migrations/
#   3. a canonical doc under docs/architecture/, database/, or decisions/ lacks a status front-matter header
#   4. a doc under docs/architecture/ is not registered in 00-Context-Map.md
#
# decisions/** glob note: `git ls-files 'decisions/**/*.md'` only matches
# files at least one directory below decisions/ under this repo's git
# (2.43) — it would silently return just the 4 files under
# decisions/frontend/ and miss the 6 top-level ones (architecture.md,
# database.md, api.md, game-engine.md, testing.md, context-system.md). This
# script uses `decisions/**.md` instead, verified to return all 10.
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

# Check 2's ranges are written with a U+2013 en-dash. Under a POSIX/C locale
# that is three bytes, the `.?` slots in the pattern below are consumed by its
# continuation bytes, and every range silently stops matching — the check then
# passes by finding nothing rather than by finding nothing wrong. CI runs in a
# UTF-8 locale and does match, so the two disagree. Pin the locale so a stale
# range fails everywhere or nowhere.
UTF8_LOCALE=$(locale -a 2>/dev/null | grep -iE '(^C|en_US)\.utf-?8$' | head -1)
if [ -n "$UTF8_LOCALE" ]; then
  export LC_ALL="$UTF8_LOCALE"
else
  echo "WARN: no UTF-8 locale available; migration-range checks may under-report" >&2
fi

MAP="docs/architecture/00-Context-Map.md"
INVENTORY="docs/architecture/00-File-Inventory.md"
FAIL=0
err() { echo "FAIL: $*" >&2; FAIL=1; }

# --- 1. Referenced paths resolve -------------------------------------------
ROUTING_FILES=$(git ls-files '*CLAUDE.md' '*README.md' "$MAP" | grep -v node_modules | grep -v '^docs/superpowers/')
for f in $ROUTING_FILES; do
  refs=$(grep -oE '`[A-Za-z0-9_./-]+\.(md|sql|sh)`' "$f" 2>/dev/null | tr -d '`' | sort -u)
  for ref in $refs; do
    found=0
    for base in "" "docs/architecture/" "docs/architecture/05-Database/" \
                "docs/architecture/06-API/" "docs/architecture/07-Frontend/" \
                "docs/" "database/" "$(dirname "$f")/"; do
      [ -e "${base}${ref}" ] && { found=1; break; }
    done
    [ $found -eq 1 ] || err "$f references missing file: $ref"
  done
done

# --- 2. Migration range consistency ----------------------------------------
# decisions/** is excluded: a decision records what was true when it was made,
# and check-decision-ids.sh hashes the migrated rows so they cannot be edited
# to follow the chain. Demanding both is a contradiction, and the ledger is the
# side that must not move. Lines naming seeds are skipped too — seeds carry
# their own numbering, which the chain max says nothing about.
ACTUAL_MAX=$(ls database/migrations/ | grep -oE '^[0-9]{4}' | sort | tail -1)
if [ -n "$ACTUAL_MAX" ]; then
  for f in CLAUDE.md DECISIONS.md $(git ls-files 'docs/architecture/*.md' 'database/*.md'); do
    head -6 "$f" | grep -q '^status: historical' && continue
    for q in $(grep -hiE '0001.?[–-].?.?[0-9]{4}' "$f" 2>/dev/null \
      | grep -iv 'seed' \
      | grep -oE '0001.?[–-].?.?[0-9]{4}' | grep -oE '[0-9]{4}$' | sort -u); do
      [ "$q" \> "0002" ] && [ "$q" != "$ACTUAL_MAX" ] \
        && err "$f quotes migration range ending $q but chain ends at $ACTUAL_MAX"
    done
  done
fi

# --- 3. Front-matter headers -----------------------------------------------
for f in $(git ls-files 'docs/architecture/*.md' 'database/*.md' 'decisions/**.md' | grep -v -e 'CLAUDE.md' -e 'AGENT.md'); do
  head -1 "$f" | grep -q '^<!--' && head -6 "$f" | grep -q '^status:' \
    || err "$f lacks status front-matter header"
done

# --- 4. Inventory registration ----------------------------------------------
# Registration moved out of the map when it was split into router / inventory /
# history (D213): the router is deliberately small and no longer lists files.
for f in $(git ls-files 'docs/architecture/*.md' | grep -v -e 'CLAUDE.md' -e 'AGENT.md'); do
  base=$(basename "$f")
  grep -q "$base" "$INVENTORY" || err "$f is not registered in $INVENTORY"
done

if [ $FAIL -eq 0 ]; then
  echo "OK: context map, references, migration ranges, and front-matter are consistent."
fi
exit $FAIL
