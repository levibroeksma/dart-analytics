#!/usr/bin/env bash
# Pending-decision gate: a PR cannot merge while a pending-*.md file or a
# [pending:<slug>] / [pending:<domain>/<slug>] citation exists. The bot
# (number-decisions.sh) numbers them first.
set -euo pipefail
exclusions="$(cd "$(dirname "$0")" && pwd)/decisions/pending-exclusions.txt"
cd "$(git rev-parse --show-toplevel)"
specs=()
while IFS= read -r line; do
  case "$line" in "" | "#"*) continue ;; esac
  specs+=(":!$line")
done < "$exclusions"
fail=0
files=""
while IFS= read -r f; do
  [ -n "$f" ] && [ -e "$f" ] && files+="$f"$'\n'
done < <(git ls-files -co --exclude-standard 'decisions/**/pending-*.md')
files="${files%$'\n'}"
if [ -n "$files" ]; then
  echo "FAIL: pending decision files:" >&2
  echo "$files" >&2
  fail=1
fi
hits=$(git grep -nE '\[pending:[a-z0-9]' -- . "${specs[@]}" || true)
if [ -n "$hits" ]; then
  echo "FAIL: [pending:...] citations:" >&2
  echo "$hits" >&2
  fail=1
fi
[ "$fail" -eq 0 ] && echo "PASS: no pending decisions"
exit "$fail"
