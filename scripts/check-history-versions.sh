#!/usr/bin/env bash
# Version-order guard for docs/architecture/00-Context-Map-History.md.
# Parallel branches each prepend an entry at the top, so two PRs can claim the
# same version. `.gitattributes` unions that file on a local merge (no
# conflict), which leaves both entries; this gate then fails and the agent
# renumbers its own entry. Entries at or above HISTORY_FLOOR must be unique
# and strictly descending in file order; older entries predate the guard.
# Optional $1 overrides the file (used by test-check-history-versions.sh).
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

FILE="${1:-docs/architecture/00-Context-Map-History.md}"
FLOOR="${HISTORY_FLOOR:-1.200.0}"

if [ ! -f "$FILE" ]; then
  echo "FAIL: $FILE not found" >&2
  exit 1
fi

previous=""
status=0
while read -r version; do
  [ "$(printf '%s\n%s\n' "$FLOOR" "$version" | sort -V | head -1)" = "$FLOOR" ] || continue
  if [ -n "$previous" ]; then
    if [ "$version" = "$previous" ]; then
      echo "FAIL: version $version appears twice in $FILE — renumber your entry above the newest one" >&2
      status=1
    elif [ "$(printf '%s\n%s\n' "$previous" "$version" | sort -V | head -1)" = "$previous" ]; then
      echo "FAIL: version $version follows $previous in $FILE — entries must descend from the top" >&2
      status=1
    fi
  fi
  previous="$version"
done < <(grep -oE '^> \*\*Version:\*\* [0-9]+\.[0-9]+\.[0-9]+' "$FILE" | awk '{print $3}')

if [ "$status" -eq 0 ]; then
  echo "OK: history versions at or above $FLOOR are unique and descending."
fi
exit "$status"
