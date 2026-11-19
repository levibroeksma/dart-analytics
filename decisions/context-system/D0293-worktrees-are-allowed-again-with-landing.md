---
id: D0293
status: accepted
date: 2026-09-17
origin: contemporaneous
original-date:
tags: [context-system, CLAUDE.md, skill, branch]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes: D0102
superseded-by:
---

# Worktrees are allowed again, with landing as the cleanup trigger

## Context and Problem Statement
the repo moved from a customized copy of the superpowers skills to the official plugin, whose skills (`using-git-worktrees`, `executing-plans`, `subagent-driven-development`, `finishing-a-development-branch`) assume worktree isolation and carry their own cleanup step. D102 banned worktrees because worktree-per-task left stale worktrees holding uncommitted, unrecoverable work outside branch review — a gap the plugin's `finishing-a-development-branch` now closes by removing the worktree only after a merge succeeds. Keeping the ban meant every plugin skill had to be locally contradicted, which is the condition issue #356 records.

## Decision Drivers
* The repo moved from customised superpowers skill copies to the official plugin.
* The plugin's `using-git-worktrees`, `executing-plans`, `subagent-driven-development` and `finishing-a-development-branch` skills assume worktree isolation and carry their own cleanup step.
* D102's ban rested on stale worktrees holding uncommitted work outside branch review.
* Issue #356 records that keeping the ban means locally contradicting every plugin skill.

## Considered Options
* Keep the D102 ban on git worktrees (the prior state).
* Allow worktrees, with removal after the branch lands (chosen).

## Decision Outcome
Chosen option: "task branches may be worked in a git worktree under `.claude/worktrees/` or checked out directly in the main working copy. The root `CLAUDE.md` No-git-worktrees invariant, `app/CLAUDE.md`'s restatement and `writing-plans`' context note are replaced by the permissive rule; `.claude/worktrees/` is gitignored, and a worktree is removed once its branch lands.".

### Consequences
the plugin's skills run unmodified, and parallel agents can hold separate checkouts instead of serialising on one working copy. D102's failure mode returns as a live risk: nothing mechanically proves a landed branch's worktree was removed, so `git worktree list` showing a worktree whose branch is merged is the signal to prune. Issue #356 (plugin `executing-plans` contradicts the invariant) is resolved by this decision rather than by editing the plugin.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### Keep the D102 ban on git worktrees
* Bad, because every plugin skill that assumes worktree isolation had to be locally contradicted (issue #356).

### Allow worktrees, with removal after the branch lands
* Good, because the plugin's `finishing-a-development-branch` removes the worktree only after a merge succeeds, which closes the gap D102 named.

## Evidence / More Information
Decided: 2026-09-17
Supersedes: D102
Referenced by D0312's `Supersedes:` line.

* Commit `bd6a48d1` (PR #382, adds the D293 row; replaces the root `CLAUDE.md` invariant and gitignores `.claude/worktrees/`): rebuilt Decision Drivers, Considered Options and Pros and Cons. The commit message cites issue #356.
