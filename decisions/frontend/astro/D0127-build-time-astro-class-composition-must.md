---
id: D0127
status: accepted
date: 2026-07-22
origin: contemporaneous
original-date:
tags: [frontend/astro, .astro, cn(), class composition]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Build-time Astro class composition must use `cn()`

## Context and Problem Statement
Prevents new UI primitives from regressing on `05-Astro-Components.md`

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Build-time Astro class composition must use `cn()`; `class:list` and `.filter(Boolean).join` banned in `app/src/**/*.astro`, enforced by `scripts/check-astro-class-composition.sh` in Context Maintenance + GitHub `checks` workflow", because Prevents new UI primitives from regressing on `05-Astro-Components.md`.

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
Decided: 2026-07-22
