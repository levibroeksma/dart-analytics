#!/usr/bin/env bash
# Stop-event context-drift reminder (D317).
#
# Silent on a clean turn — a turn that owes nothing costs nothing. Speaks
# only when scripts/check-doc-sync.sh says the branch has changed domain
# logic with no canonical-doc edit, so this is a reminder of the same rule
# the gate enforces, not a second rule. One definition of drift.
#
# Output contract: {"decision":"block","reason":...}, confirmed by live
# probe on 2.1.236 — the reason arrives as a "Stop hook feedback:" message.
# (hookSpecificOutput.additionalContext also works on Stop; decision/reason
# is preferred because the feedback is labelled as such.) The identifiers
# being present in the binary was never evidence that Stop accepts them.
#
# Re-entrancy: a Stop hook that returns blocking output makes the model
# continue, which fires Stop again. stop_hook_active is true on that second
# firing; bail immediately or this loops.
set -u

INPUT=$(cat)

if printf '%s' "$INPUT" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
git rev-parse --show-toplevel >/dev/null 2>&1 || exit 0

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
[ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ] && exit 0

DRIFT=$(bash scripts/check-doc-sync.sh 2>&1) && exit 0

printf '%s' "{\"decision\":\"block\",\"reason\":$(printf '%s' "This branch has changed domain logic with no canonical-doc edit. Update docs/architecture/ or add a decisions/ entry before finishing, or say plainly why none is owed. Detail:
$DRIFT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')}"
exit 0
