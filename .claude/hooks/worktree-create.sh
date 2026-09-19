#!/usr/bin/env bash
# WorktreeCreate hook — places every Claude-created worktree at .worktrees/
# of the main checkout, the only location the Hard Invariants allow (D312,
# D319) and one of the two prefixes superpowers:finishing-a-development-branch
# claims at cleanup.
#
# Why this exists rather than a permission rule: entering a worktree outside
# .claude/worktrees/ costs an approval prompt on every EnterWorktree call, and
# the docs are explicit that no permission rule suppresses it — "An
# EnterWorktree permission rule or choosing 'don't ask again' doesn't suppress
# this prompt; only bypassPermissions mode skips it." Claude Code's own
# default path is the one the repo forbids, so the way out is to stop entering
# worktrees mid-session and start sessions in them instead: `claude --worktree
# <name>` runs this hook at launch, and the session is already isolated before
# the first tool call. superpowers:using-git-worktrees Step 0 then detects the
# existing isolation and skips creation entirely. (D321)
#
# Contract, established by probe on 2.1.267 rather than from the docs, whose
# hook-reference schema disagreed with the worked example on the worktrees
# page:
#   stdin  — JSON: session_id, transcript_path, cwd, scratchpad_dir,
#            hook_event_name, name. There is no repo_root and no branch field;
#            the base and the branch name are this script's decisions.
#   stdout — the absolute path of a directory that already exists. A command
#            hook echoes the bare path; hookSpecificOutput.worktreePath is the
#            http/callback form and is not read here.
#   exit   — non-zero aborts worktree creation; diagnostics go to stderr.
# A dot-prefixed path component is accepted: the binary's "dot segments"
# refusal is about "." and ".." spellings, and .worktrees/<name> was created
# and entered cleanly under probe.
#
# No WorktreeRemove counterpart is configured on purpose. With none, Claude
# Code falls back to `git worktree remove`, which is exactly right for a real
# linked worktree; a hook would only reimplement it. Removal stays shared with
# the finishing skill and scripts/check-worktree-location.sh.
set -u

fail() { echo "worktree-create: $*" >&2; exit 1; }

INPUT=$(cat)

NAME=$(printf '%s' "$INPUT" | python3 -c '
import json, sys
try:
    print((json.load(sys.stdin).get("name") or "").strip())
except Exception:
    print("")
') || fail "could not parse the hook payload"

[ -n "$NAME" ] || fail "the hook payload carried no worktree name"

case "$NAME" in
  /*|*..*|*./*) fail "refusing the unsafe worktree name '$NAME'" ;;
esac

COMMON=$(git rev-parse --git-common-dir 2>/dev/null) || fail "not in a git repository"
ROOT=$(dirname "$(cd "$COMMON" && pwd)")

# --git-common-dir is the main checkout's git directory even when this hook
# runs from inside a linked worktree, so worktrees never nest: a session
# started in .worktrees/a that creates b puts it at .worktrees/b, not
# .worktrees/a/.worktrees/b.
DIR="$ROOT/.worktrees/$NAME"

# A name that already names a registered worktree reopens it, matching the
# documented behaviour of reusing a --worktree name.
if [ -d "$DIR" ]; then
  git -C "$ROOT" worktree list --porcelain | grep -qxF "worktree $DIR" \
    || fail "$DIR already exists but is not a registered worktree"
  echo "$DIR"
  exit 0
fi

# The repo's branch convention is <type>/<slug>, which EnterWorktree and
# --worktree both accept as a name. A name already in that shape is used
# verbatim; a bare name gets Claude Code's own worktree-<name> default.
case "$NAME" in
  */*) BRANCH="$NAME" ;;
  *)   BRANCH="worktree-$NAME" ;;
esac

# Base every worktree on origin/main, per the Hard Invariant's creation
# recipe. The fetch is best-effort and capped: an offline session should get
# a worktree on a slightly stale base, not no worktree.
git -C "$ROOT" fetch --quiet origin main >/dev/null 2>&1 || true
BASE=origin/main
git -C "$ROOT" rev-parse --verify --quiet "$BASE" >/dev/null || fail "$BASE is not available locally; fetch it once and retry"

if git -C "$ROOT" rev-parse --verify --quiet "refs/heads/$BRANCH" >/dev/null; then
  git -C "$ROOT" worktree add "$DIR" "$BRANCH" >&2 || fail "git worktree add failed for existing branch $BRANCH"
else
  git -C "$ROOT" worktree add "$DIR" -b "$BRANCH" "$BASE" >&2 || fail "git worktree add failed for new branch $BRANCH"
fi

[ -d "$DIR" ] || fail "git reported success but $DIR does not exist"

echo "$DIR"
