#!/usr/bin/env bash
# Worktree location gate — Hard Invariants (root CLAUDE.md).
#
# D312 moved worktrees from .claude/worktrees/ to .worktrees/ because
# superpowers:finishing-a-development-branch only claims cleanup for
# .worktrees/ and worktrees/ prefixes and leaves everything else to "the
# host environment" — so a worktree at the old path was never removed by
# the skill that promised to remove it, while the invariant said one left
# behind is a defect. That decision's own Consequences paragraph records
# the gap this gate closes: "nothing mechanically proves a landed branch's
# worktree was removed, so `git worktree list` showing a worktree whose
# branch is merged is the signal to prune."
#
# Two hard assertions plus one advisory:
#
#   1. every worktree INSIDE the repo root lives under .worktrees/
#   2. the legacy .claude/worktrees/ directory does not exist
#   3. (warning) no .worktrees/ worktree holds a branch already merged
#      into origin/main
#
# Assertion 1 is deliberately scoped to worktrees inside the repo root. A
# checkout beside the repo (a sibling directory on its own branch) is a
# separate working copy, not a task worktree; the plugin never claimed it
# and failing on it would make the gate red for something this rule was
# never about.
#
# Assertion 3 warns rather than fails because worktrees are shared across
# concurrent sessions: another session landing its branch must not break
# an unrelated commit here. The warning is the prune signal D312 asked for;
# acting on it is the owning session's job.
#
# CI has no task worktrees, so 1 and 2 pass vacuously there.
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

# In a linked worktree --show-toplevel is the worktree, not the repo. The
# common git dir always belongs to the main working copy.
ROOT=$(dirname "$(cd "$(git rev-parse --git-common-dir)" && pwd)")
FAIL=0
err() { echo "FAIL: $*" >&2; FAIL=1; }

# --- 1. In-repo worktrees live under .worktrees/ ----------------------------
WORKTREES=$(git worktree list --porcelain | awk '/^worktree /{print substr($0,10)}')
for wt in $WORKTREES; do
  [ "$wt" = "$ROOT" ] && continue
  case "$wt" in
    "$ROOT"/.worktrees/*) ;;
    "$ROOT"/*)
      err "worktree outside .worktrees/: ${wt#"$ROOT"/} — move it to .worktrees/ (D312)" ;;
    *) ;; # sibling checkout, out of scope
  esac
done

# --- 2. The legacy path is gone --------------------------------------------
if [ -d "$ROOT/.claude/worktrees" ]; then
  err ".claude/worktrees/ still exists — D312 retired it; remove the directory"
fi

# --- 3. Advisory: a landed branch still holding a worktree ------------------
if git rev-parse --verify --quiet origin/main >/dev/null; then
  MERGED=$(git branch --merged origin/main --format='%(refname:short)')
  git worktree list --porcelain | awk '
    /^worktree /{wt=substr($0,10)}
    /^branch /{print wt "\t" substr($0,8)}' \
  | while IFS="$(printf '\t')" read -r wt ref; do
      case "$wt" in "$ROOT"/.worktrees/*) ;; *) continue ;; esac
      branch=${ref#refs/heads/}
      # A branch still sitting on origin/main's tip has landed nothing yet;
      # it is trivially "merged" and is not a prune signal.
      [ "$(git rev-parse "$branch")" = "$(git rev-parse origin/main)" ] && continue
      if echo "$MERGED" | grep -qx "$branch"; then
        echo "WARN: ${wt#"$ROOT"/} holds '$branch', already merged into origin/main — prune it (D293)."
      fi
    done
fi

[ $FAIL -eq 0 ] && echo "OK: worktrees live under .worktrees/; legacy path absent."
exit $FAIL
