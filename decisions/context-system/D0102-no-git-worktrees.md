---
id: D0102
status: superseded
date: 2026-09-17
origin: contemporaneous
original-date:
tags: [context-system, branch]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by: D0293
---

# No git worktrees

## Context and Problem Statement
Worktree-per-task left multiple stale worktrees with uncommitted, unrecoverable work sitting undiscovered outside normal branch review

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
* Keep worktree-per-task (the state before this record).
* Check out task branches directly in the main working copy (chosen).

## Decision Outcome
Chosen option: "No git worktrees: task branches are checked out directly in the main working copy (`git checkout -b <branch>`), never under `.worktrees/`; `.worktrees/` removed from `.gitignore`", because Worktree-per-task left multiple stale worktrees with uncommitted, unrecoverable work sitting undiscovered outside normal branch review.

### Consequences
Rationale unknown — no source found.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-15

* Commit `d03aea1f` (2026-07-15): rebuilt Considered Options from its message. It also added the sibling `AGENT.md` files, which this record does not decide.
* Superseded by D0293 (commit `bd6a48d1`, PR #382, 2026-09-17): the repo moved to the official superpowers plugin, whose skills assume worktree isolation.
* Applied in: `docs/superpowers/plans/2026-07-23-context-layer-hardening.md`, `docs/superpowers/specs/2026-08-19-governance-design.md` (Problem).
