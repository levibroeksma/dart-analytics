#!/usr/bin/env bash
# Pending-decision gate: a PR cannot merge while a pending-*.md file or a
# [pending:<slug>] / [pending:<domain>/<slug>] citation exists. The bot
# (number-decisions.sh) numbers them first.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
fail=0
files=$(git ls-files 'decisions/**/pending-*.md')
if [ -n "$files" ]; then
  echo "FAIL: pending decision files:" >&2
  echo "$files" >&2
  fail=1
fi
hits=$(git grep -n '\[pending:' -- . \
  ':!decisions/TEMPLATE.md' ':!DECISIONS.md' ':!docs/superpowers/' \
  ':!app/tests/scripts/decisions/' ':!scripts/check-decision-pending.sh' || true)
if [ -n "$hits" ]; then
  echo "FAIL: [pending:...] citations:" >&2
  echo "$hits" >&2
  fail=1
fi
[ "$fail" -eq 0 ] && echo "PASS: no pending decisions"
exit "$fail"
