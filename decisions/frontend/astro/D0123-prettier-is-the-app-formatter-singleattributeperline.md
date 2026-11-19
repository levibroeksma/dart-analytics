---
id: D0123
status: accepted
date: 2026-07-21
origin: contemporaneous
original-date:
tags: [frontend/astro, .astro]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Prettier is the `app/` formatter (`singleAttributePerLine`)

## Context and Problem Statement
FOUC-safe Alpine markup, consistent authoring, mechanical drift prevention

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Prettier is the `app/` formatter (`singleAttributePerLine`); `.astro` template comments are `{/* */}` only; CI enforces `x-show`↔`x-cloak` and bans template `<!-- -->` via `scripts/check-astro-conventions.sh`; TS inline body comments banned under `app/src/**/*.ts` (JSDoc-above; agent-enforced)", because FOUC-safe Alpine markup, consistent authoring, mechanical drift prevention.

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
Decided: 2026-07-21
