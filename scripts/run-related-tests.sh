#!/usr/bin/env bash
# Pre-commit related-tests row (#1322): runs only the Vitest files that import
# a staged app/src or app/tests file (`vitest related`), in seconds. The full
# suite runs at pre-push and in CI.
#
# WHAT THIS CANNOT CATCH: a test that reads a source file as text, not through
# an import (the board parity test does); a test broken by an unstaged change.
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
[ -d app/node_modules ] || { echo "SKIP: app/node_modules absent" >&2; exit 0; }
mapfile -t FILES < <(git diff --cached --name-only --diff-filter=ACMR \
  | grep -E '^app/(src|tests)/.*\.(ts|tsx|js|mjs|astro)$' | sed 's#^app/##')
[ "${#FILES[@]}" -eq 0 ] && exit 0
cd app && npx --no-install vitest related --run --passWithNoTests "${FILES[@]}"
