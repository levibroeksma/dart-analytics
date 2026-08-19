#!/usr/bin/env bash
# AGENT.md stub checker — every CLAUDE.md must have an AGENT.md sibling whose
# only content is the pointer stub below. AGENT.md is not a rule source; it
# redirects to the sibling CLAUDE.md, which is the single authority (D213).
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

STUB=$(cat <<'EOF'
# AGENT.md

Not a rule source. The authority for this directory is the sibling
`CLAUDE.md` — read that instead. Rules live there and only there.
EOF
)

FAIL=0
for claude in $(git ls-files '*CLAUDE.md'); do
  dir=$(dirname "$claude")
  agent="$dir/AGENT.md"
  if [ ! -f "$agent" ]; then
    echo "FAIL: $claude has no AGENT.md sibling" >&2
    FAIL=1
    continue
  fi
  if [ "$(cat "$agent")" != "$STUB" ]; then
    echo "FAIL: $agent is not the pointer stub — AGENT.md must not carry rules" >&2
    FAIL=1
  fi
done

[ $FAIL -eq 0 ] && echo "OK: every AGENT.md is the pointer stub redirecting to its CLAUDE.md."
exit $FAIL
