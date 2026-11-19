---
id: D0169
status: accepted
date: 2026-07-28
origin: contemporaneous
original-date:
tags: [context-system, gate, Prettier, format, husky, pre-commit, branch]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# `.husky/pre-commit` gains `set -e`

## Context and Problem Statement
Prettier failures no longer blocked commits, silently regressing D136's "catch format issues at commit" guarantee (final whole-branch review)

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`.husky/pre-commit` gains `set -e`; previously its two top-level statements were not `&&`-joined, so a failing `npx lint-staged` did not stop the hook and the hook's exit code was only the final structural-gate chain's", because Prettier failures no longer blocked commits, silently regressing D136's "catch format issues at commit" guarantee (final whole-branch review).

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
