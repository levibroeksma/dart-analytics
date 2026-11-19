---
id: D0136
status: accepted
date: 2026-07-24
origin: contemporaneous
original-date:
tags: [context-system, CI, Prettier, format, husky, pre-commit, PR]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Prettier enforced locally via husky + lint-staged pre-commit (`app/` prepare → repo-root

## Context and Problem Statement
PRs were failing solely on format drift; catch at commit and before PR instead of only in CI

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Prettier enforced locally via husky + lint-staged pre-commit (`app/` prepare → repo-root `.husky/`) and mandatory agent/pre-PR `npm run format` + clean `format:check`; CI remains fail-only `format:check` with no Actions auto-format", because PRs were failing solely on format drift; catch at commit and before PR instead of only in CI.

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
Decided: 2026-07-24
