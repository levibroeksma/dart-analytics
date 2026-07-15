#!/usr/bin/env bash
# Context-map consistency checker — part of the mandatory Context Maintenance
# protocol (root CLAUDE.md). Fails when the context system has gone stale:
#   1. a path referenced from a CLAUDE.md / README.md / 00-Context-Map.md does not exist
#   2. a doc quotes a migration range that disagrees with database/migrations/
#   3. a canonical doc under docs/architecture/ or database/ lacks a status front-matter header
#   4. a doc under docs/architecture/ is not registered in 00-Context-Map.md
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

MAP="docs/architecture/00-Context-Map.md"
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
ACTUAL_MAX=$(ls database/migrations/ | grep -oE '^[0-9]{4}' | sort | tail -1)
if [ -n "$ACTUAL_MAX" ]; then
  for f in CLAUDE.md DECISIONS.md $(git ls-files 'docs/architecture/*.md' 'database/*.md'); do
    head -6 "$f" | grep -q '^status: historical' && continue
    for q in $(grep -hoE '0001.?[–-].?.?[0-9]{4}' "$f" 2>/dev/null | grep -oE '[0-9]{4}$' | sort -u); do
      [ "$q" \> "0002" ] && [ "$q" != "$ACTUAL_MAX" ] \
        && err "$f quotes migration range ending $q but chain ends at $ACTUAL_MAX"
    done
  done
fi

# --- 3. Front-matter headers -----------------------------------------------
for f in $(git ls-files 'docs/architecture/*.md' 'database/*.md' | grep -v -e 'CLAUDE.md' -e 'AGENT.md'); do
  head -1 "$f" | grep -q '^<!--' && head -6 "$f" | grep -q '^status:' \
    || err "$f lacks status front-matter header"
done

# --- 4. Map registration ----------------------------------------------------
for f in $(git ls-files 'docs/architecture/*.md' | grep -v -e 'CLAUDE.md' -e 'AGENT.md'); do
  base=$(basename "$f")
  grep -q "$base" "$MAP" || err "$f is not registered in $MAP"
done

if [ $FAIL -eq 0 ]; then
  echo "OK: context map, references, migration ranges, and front-matter are consistent."
fi
exit $FAIL
