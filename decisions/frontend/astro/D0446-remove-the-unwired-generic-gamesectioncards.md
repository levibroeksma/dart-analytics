---
id: D0446
status: accepted
date: 2026-10-11
origin: contemporaneous
original-date:
tags: [frontend/astro, component, layout, page]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Remove the unwired generic `GameSectionCards`

## Context and Problem Statement
D385 unwired it from `/statistics` while Score Training's dedicated layout was built, and no page has imported it since. Nothing in a build renders it, so its markup cannot be verified, and it kept resurfacing in duplication reviews (#914 task B: 13 repeated stat-figure blocks in 5 grids) as a refactor target with no live consumer.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`components/layout/statistics/GameSectionCards.astro` is deleted, with its File Inventory row, Component Inventory row and `.fallowrc.jsonc` entry point. Recover it with `git show e95aa97:app/src/components/layout/statistics/GameSectionCards.astro`.".

### Consequences
`routine-stats.store.ts` `stepGame` is no longer read by any component. It is left in place, with its comment updated, as a separate cleanup. A future generic cards component should be built against the dedicated section factories (D385), not restored as-is. Older specs and plans under `docs/superpowers/` that name the file are historical and unchanged.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-11
Supersedes: none (ends the "temporarily unwired" state of D385 for this component).
