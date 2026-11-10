#!/usr/bin/env bash
# Fixture test for .claude/hooks/block-main-commit.py. Builds a throwaway git
# repo, checks out `main` or `task/x`, and pipes a Bash tool payload to the
# hook from inside it.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOK="$ROOT/.claude/hooks/block-main-commit.py"
PASSED=0
FAILED=0
D="$(mktemp -d)"
trap 'rm -rf "$D"' EXIT

git -C "$D" init -q -b main
git -C "$D" -c user.name=t -c user.email=t@t -c commit.gpgsign=false commit -q --allow-empty -m init
git -C "$D" branch -q task/x

# expect <deny|allow> <branch> <command>
expect() {
  local out
  git -C "$D" checkout -q "$2"
  out="$(cd "$D" && jq -n --arg c "$3" '{tool_name:"Bash",tool_input:{command:$c}}' | python3 "$HOOK" 2>&1)"
  if { [ "$1" = deny ] && grep -q '"permissionDecision": "deny"' <<< "$out"; } || { [ "$1" = allow ] && [ -z "$out" ]; }; then
    PASSED=$((PASSED + 1))
  else
    FAILED=$((FAILED + 1)); echo "FAIL: on $2, want $1: $3" >&2; echo "$out" | sed 's/^/    /' >&2
  fi
}

expect deny main 'git commit -m x'
expect deny main $'git add .\ngit commit -m x'
expect deny main 'git -C . commit -m x'
expect deny main 'git -c user.name=a commit -m x'
expect deny main '(git commit -m x)'
expect deny main 'git merge task/x'
expect deny task/x 'git push origin HEAD:main'
expect allow task/x $'git push -u origin task/x\ngh pr create --base main'
expect allow task/x 'git commit -m "docs: never git push origin main"'
expect allow task/x 'git commit -m x'
expect allow main 'echo "git commit"'

echo "block-main-commit: $PASSED passed, $FAILED failed"
[ "$FAILED" -eq 0 ]
