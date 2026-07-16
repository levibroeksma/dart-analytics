#!/usr/bin/env bash
# AGENT.md mirror checker — every CLAUDE.md must have a byte-identical
# AGENT.md sibling (Context Map: "exact mirror... edit both together").
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

FAIL=0
for claude in $(git ls-files '*CLAUDE.md'); do
  dir=$(dirname "$claude")
  agent="$dir/AGENT.md"
  if [ -f "$agent" ]; then
    diff -q "$claude" "$agent" >/dev/null 2>&1 \
      || { echo "FAIL: $claude and $agent have diverged" >&2; FAIL=1; }
  fi
done

[ $FAIL -eq 0 ] && echo "OK: every CLAUDE.md/AGENT.md pair is identical."
exit $FAIL
