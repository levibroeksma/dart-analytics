#!/usr/bin/env sh
# Runs the pre-commit gates listed in scripts/precommit-gates.tsv, from the
# repo root. A row with a regex runs only when a staged path matches it.
# Called by .husky/pre-commit.
# PRECOMMIT_STAGED=<file of paths> replaces `git diff --cached --name-only`;
# PRECOMMIT_GATES=<tsv> replaces the gate table; PRECOMMIT_DRY=1 prints the
# gates that would run instead of running them.
set -e
GATES="${PRECOMMIT_GATES:-scripts/precommit-gates.tsv}"
STAGED="$(mktemp)"
trap 'rm -f "$STAGED"' EXIT
if [ -n "${PRECOMMIT_STAGED:-}" ]; then
  cat "$PRECOMMIT_STAGED" > "$STAGED"
else
  git diff --cached --name-only > "$STAGED"
fi

RAN=0
SKIPPED=0
TAB="$(printf '\t')"
while IFS="$TAB" read -r gate re; do
  case "$gate" in ''|'#'*) continue ;; esac
  if [ ! -f "$gate" ]; then
    echo "pre-commit: $gate missing" >&2
    exit 1
  fi
  if [ -n "$re" ] && ! grep -Eq -- "$re" "$STAGED"; then
    SKIPPED=$((SKIPPED + 1))
    continue
  fi
  if [ -n "${PRECOMMIT_DRY:-}" ]; then
    echo "$gate"
  elif ! OUT=$(bash "$gate" 2>&1); then
    echo "$OUT" >&2
    echo "pre-commit: $gate failed" >&2
    exit 1
  fi
  RAN=$((RAN + 1))
done < "$GATES"
echo "pre-commit: $RAN gates passed, $SKIPPED skipped by path"
