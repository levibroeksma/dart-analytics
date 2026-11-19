#!/usr/bin/env bash
# Bot entry: number pending decisions against origin/main.
# Next id = max(main max id, branch max id) + 1; see scripts/decisions/number.mjs.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
main_max=$(git ls-tree -r --name-only origin/main decisions/ \
  | sed -n 's#.*/D\([0-9]\{4\}\)-.*\.md$#\1#p' | sort -n | tail -1)
main_max=$((10#${main_max:-0}))
changed=()
while IFS= read -r f; do changed+=("$f"); done < <(git diff --name-only origin/main...HEAD)
node scripts/decisions/number.mjs --root decisions --main-max "$main_max" --changed ${changed[@]+"${changed[@]}"}
