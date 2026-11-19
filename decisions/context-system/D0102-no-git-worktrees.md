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
<!-- backfill: pending -->

# No git worktrees

## Context and Problem Statement
Worktree-per-task left multiple stale worktrees with uncommitted, unrecoverable work sitting undiscovered outside normal branch review

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "No git worktrees: task branches are checked out directly in the main working copy (`git checkout -b <branch>`), never under `.worktrees/`; `.worktrees/` removed from `.gitignore`", because Worktree-per-task left multiple stale worktrees with uncommitted, unrecoverable work sitting undiscovered outside normal branch review.

### Consequences
Rationale unknown — backfill pending.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-07-15
