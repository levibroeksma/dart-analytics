---
id: D0157
status: accepted
date: 2026-07-28
origin: contemporaneous
original-date:
tags: [context-system, CI, Prettier, husky, pre-commit, PR]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# `.husky/pre-commit` runs the 7 existing structural `check-*.sh` gates (file-locations

## Context and Problem Statement
These gates only ran in CI, after push; violations were caught in PR review instead of at commit time, same latency pattern D136 already fixed for Prettier

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`.husky/pre-commit` runs the 7 existing structural `check-*.sh` gates (file-locations, agent-mirrors, astro-class-composition, astro-conventions, game-engines, refinement-coverage, type-barrels) in addition to Prettier lint-staged", because These gates only ran in CI, after push; violations were caught in PR review instead of at commit time, same latency pattern D136 already fixed for Prettier.

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
