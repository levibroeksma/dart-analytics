#!/usr/bin/env bash
# Fixture test for .claude/hooks/edit-gate.py (PreToolUse Edit|Write).
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOK="$ROOT/.claude/hooks/edit-gate.py"
PASSED=0
FAILED=0
A=app/src/components/a/X.astro

# tree <content|-> : root with scripts/ symlinked; X.astro present unless "-".
tree() {
  local t
  t="$(mktemp -d)"
  ln -s "$ROOT/scripts" "$t/scripts"
  if [ "$1" != "-" ]; then
    mkdir -p "$t/$(dirname "$A")"
    printf '%s\n' "$1" > "$t/$A"
  fi
  echo "$t"
}

# run <root> <stdin> [VAR=val...] : sets OUT and CODE.
run() {
  local t="$1" in="$2"
  shift 2
  OUT="$(printf '%s' "$in" | env EDIT_GATE_ROOT="$t" "$@" python3 "$HOOK" 2>/dev/null)"; CODE=$?
}

# payload <tool> <path> <k=v>... : JSON via python for safe quoting.
payload() {
  python3 - "$@" <<'PY'
import json, sys
tool, path, *kv = sys.argv[1:]
ti = {"file_path": path}
for item in kv:
    k, v = item.split("=", 1)
    ti[k] = v
print(json.dumps({"tool_name": tool, "tool_input": ti, "session_id": "s", "cwd": "/"}))
PY
}

ok() { PASSED=$((PASSED + 1)); }
bad() { FAILED=$((FAILED + 1)); echo "FAIL: $1 (exit $CODE)" >&2; echo "$OUT" | sed 's/^/    /' >&2; }

expect_deny() {
  local name="$1"
  if [ "$CODE" -eq 0 ] && python3 - "$OUT" <<'PY'
import json, sys
o = json.loads(sys.argv[1])["hookSpecificOutput"]
r = o["permissionDecisionReason"]
sys.exit(0 if o["permissionDecision"] == "deny" and "x-bind" in r and "fix and retry" in r else 1)
PY
  then ok; else bad "$name"; fi
}

expect_allow() {
  if [ "$CODE" -eq 0 ] && [ -z "$OUT" ]; then ok; else bad "$1"; fi
}

T=$(tree -)
run "$T" "$(payload Write "$T/$A" 'content=<div x-bind:class="y"></div>')"
expect_deny "write new astro with x-bind"
run "$T" "$(payload Write "$T/$A" 'content=<div :class="y"></div>')"
expect_allow "write clean astro"
rm -rf "$T"

T=$(tree '<div class="a"></div>')
run "$T" "$(payload Edit "$T/$A" 'old_string=class="a"' 'new_string=x-bind:class="a"')"
expect_deny "edit adds x-bind"
rm -rf "$T"

T=$(tree $'<div x-bind:class="y"></div>\n<p>old</p>')
run "$T" "$(payload Edit "$T/$A" 'old_string=old' 'new_string=new')"
expect_allow "edit unrelated line with pre-existing x-bind"
rm -rf "$T"

T=$(tree '<div></div>')
run "$T" "$(payload Edit "$T/$A" 'old_string=nope' 'new_string=x-bind:y')"
expect_allow "edit old_string absent"
rm -rf "$T"

T=$(tree -)
run "$T" "$(payload Write /etc/x.astro 'content=x-bind:y')"
expect_allow "path outside root"
run "$T" "$(payload Write "$T/README.md" 'content=x-bind:y')"
expect_allow "non-matching extension"
run "$T" 'not json'
expect_allow "invalid json"
run "$T" "$(payload Write "$T/$A" 'content=<div x-bind:class="y"></div>')" EDIT_GATE_TIMEOUT=0.001
expect_allow "timeout fails open"
rm -rf "$T"

T=$(mktemp -d)
run "$T" "$(payload Write "$T/$A" 'content=<div x-bind:class="y"></div>')"
expect_allow "scripts missing fails open"
rm -rf "$T"

# Worktree: no override, CLAUDE_PROJECT_DIR is the outer copy, file is in a
# nested git repo -> root comes from git, so the check still applies.
T=$(mktemp -d)
N="$T/.worktrees/w"
mkdir -p "$N"
git -C "$N" init -q
ln -s "$ROOT/scripts" "$N/scripts"
OUT="$(payload Write "$N/$A" 'content=<div x-bind:class="y"></div>' | env -u EDIT_GATE_ROOT CLAUDE_PROJECT_DIR="$T" python3 "$HOOK" 2>/dev/null)"; CODE=$?
expect_deny "worktree file uses nested git root"
rm -rf "$T"

echo "edit-gate: $PASSED passed, $FAILED failed"
[ "$FAILED" -eq 0 ]
