---
id: D0168
status: accepted
date: 2026-07-28
origin: contemporaneous
original-date:
tags: [context-system, CLAUDE.md, branch, PR]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Split `branch-stack-cap`/`test-repointing-heuristic` out of `checks.yml` into new

## Context and Problem Statement
`checks.yml`'s original `branches: [main]` filter meant both PR-state jobs only ran for PRs targeting `main`, so `branch-stack-cap` could never evaluate a PR targeting a stacked non-main branch — the exact D147 incident shape — making the root `CLAUDE.md` claim that D147 is "mechanically enforced on every PR" false (final whole-branch review)

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Split `branch-stack-cap`/`test-repointing-heuristic` out of `checks.yml` into new `.github/workflows/pr-gates.yml` with an unfiltered `pull_request: types: [opened, synchronize, reopened]` trigger; `checks.yml` keeps only the `quality` job on `branches: [main]`. Also dropped `--depth=1` from the test-repointing job's `git fetch` (it grafted the base tip as parentless, breaking the three-dot diff once `main` advanced past the branch point)".

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
Decided: 2026-07-28
