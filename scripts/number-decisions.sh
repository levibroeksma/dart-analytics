#!/usr/bin/env bash
# Bot entry: number pending decisions against origin/main and renumber branch
# ids that collide with ids on main. See scripts/decisions/number.mjs.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
tree=$(git ls-tree -r --name-only origin/main decisions/)
changed_list=$(git diff --name-only origin/main...HEAD)
main_files=$(mktemp)
trap 'rm -f "$main_files"' EXIT
printf '%s\n' "$tree" | sed -n 's#^decisions/\(.*/D[0-9]\{4\}-[^/]*\.md\)$#\1#p' > "$main_files"
main_max=$(sed -n 's#.*/D\([0-9]\{4\}\)-[^/]*\.md$#\1#p' "$main_files" | sort -n | tail -1)
main_max=$((10#${main_max:-0}))
changed=()
while IFS= read -r f; do [ -n "$f" ] && changed+=("$f"); done <<< "$changed_list"
node scripts/decisions/number.mjs --root decisions --main-max "$main_max" \
  --main-files "$main_files" --changed ${changed[@]+"${changed[@]}"}
