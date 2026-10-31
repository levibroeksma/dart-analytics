#!/usr/bin/env bash
# Fixture test for .claude/hooks/reuse-lookup.py (PreToolUse Write).
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOK="$ROOT/.claude/hooks/reuse-lookup.py"
PASSED=0
FAILED=0

T="$(mktemp -d)"
TMP="$(mktemp -d)"
trap 'rm -rf "$T" "$TMP"' EXIT
mkdir -p "$T/docs/architecture/07-Frontend" "$T/graphify-out" "$T/app/src/lib" "$T/app/src/components/ui"
cat > "$T/docs/architecture/07-Frontend/08-Component-Inventory.md" <<'MD'
| Component | Purpose | Props |
| --- | --- | --- |
| `Badge.astro` | Small inline status pill | `variant` |
| `Toggle.astro` | On/off switch | `checked` |
| `RankBadge.astro` | Rank pill | `rank` |
MD
mkdir -p "$T/app/src/components/atoms" "$T/app/src/services"
printf 'x\n' > "$T/app/src/components/ui/Badge.astro"
printf 'x\n' > "$T/app/src/components/atoms/RankBadge.astro"
cat > "$T/graphify-out/graph.json" <<'JSON'
{"nodes":[{"label":"formatScore","norm_label":"formatscore","source_file":"app/src/lib/score.ts","source_location":"L1"},
{"label":"other","norm_label":"other","source_file":"docs/x.md","source_location":"L1"}],"links":[]}
JSON
printf 'export const formatScore = 1;\n' > "$T/app/src/lib/score.ts"
printf 'x\n' > "$T/app/src/lib/existing.ts"
git -C "$T" init -q && git -C "$T" add -A

# run <stdin> [session] : sets OUT and CODE.
run() {
  OUT="$(printf '%s' "$1" | env REUSE_ROOT="$T" TMPDIR="$TMP" python3 "$HOOK" 2>/dev/null)"; CODE=$?
}

# payload <path> <content> <session>
payload() {
  python3 - "$@" <<'PY'
import json, sys
path, content, sid = sys.argv[1:]
print(json.dumps({"tool_name": "Write", "tool_input": {"file_path": path, "content": content}, "session_id": sid}))
PY
}

ok() { PASSED=$((PASSED + 1)); }
bad() { FAILED=$((FAILED + 1)); echo "FAIL: $1 (exit $CODE)" >&2; echo "$OUT" | sed 's/^/    /' >&2; }

expect_deny() { # name needle...
  local name="$1"; shift
  if [ "$CODE" -eq 0 ] && python3 - "$OUT" "$@" <<'PY'
import json, sys
o = json.loads(sys.argv[1])["hookSpecificOutput"]
r = o["permissionDecisionReason"]
sys.exit(0 if o["permissionDecision"] == "deny" and "retry" in r and all(n in r for n in sys.argv[2:]) else 1)
PY
  then ok; else bad "$name"; fi
}
expect_allow() { if [ "$CODE" -eq 0 ] && [ -z "$OUT" ]; then ok; else bad "$1"; fi; }

P=$(payload "$T/app/src/components/ui/StatusBadge.astro" "<div/>" s1)
run "$P"; expect_deny "new astro denies with inventory match" "Badge.astro" "app/src/components/ui/Badge.astro" "RankBadge.astro" "app/src/components/atoms/RankBadge.astro" "stating why none fits"
run "$P"; expect_allow "same session second write passes"

P=$(payload "$T/app/src/lib/score-format.ts" "export function formatScore() {}" s2)
run "$P"; expect_deny "new ts denies with graph match" "app/src/lib/score.ts"

P=$(payload "$T/app/src/lib/existing.ts" "export const formatScore = 2;" s3)
run "$P"; expect_allow "overwrite existing passes"

P=$(payload "$T/app/src/lib/zzz-qqq.ts" "export const zzzQqq = 1;" s4)
run "$P"; expect_allow "no matching tokens passes"

P=$(payload "$T/app/src/services/x.ts" "export function formatScore() {}" s6)
run "$P"; expect_allow "unwatched services dir passes"

P=$(payload "$T/app/src/pages/x.astro" "<div/>" s5)
run "$P"; expect_allow "unwatched dir passes"

run "not json"; expect_allow "bad stdin fails open"

# Worktree: no override, CLAUDE_PROJECT_DIR is the outer copy, file is in a
# nested git repo -> root comes from git, so the lookup still applies there.
N="$T/.worktrees/w"
mkdir -p "$N"
cp -r "$T/docs" "$T/app" "$N/"
git -C "$N" init -q && git -C "$N" add -A
P=$(payload "$N/app/src/components/ui/StatusBadge.astro" "<div/>" s7)
OUT="$(printf '%s' "$P" | env -u REUSE_ROOT CLAUDE_PROJECT_DIR="$T" TMPDIR="$TMP" python3 "$HOOK" 2>/dev/null)"; CODE=$?
expect_deny "worktree new file uses nested git root" "Badge.astro" "app/src/components/ui/Badge.astro"

echo "reuse-lookup: $PASSED passed, $FAILED failed"
[ "$FAILED" -eq 0 ]
