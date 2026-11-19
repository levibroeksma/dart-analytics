---
id: D0359
status: accepted
date: 2026-09-23
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Warm-Up Advanced is a second Warm-Up template, not a new ruleset or type

## Context and Problem Statement
the author wants the same warm-up with a smaller target; section targets are already template configuration (`WarmUpPhaseConfig`), and `dartboardHighlightPath` already outlines a single-number slice. A routine-step override would tie the variant to one routine; a template lets any custom routine pick it from the catalog.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: ""Warm-Up Advanced" (seed `0026`) is a second `WARM_UP` system template pinned to `WARM_UP_V1`. Its five sections keep Warm-Up's names and equal weights but each aims at one number — Upper 20, Lower 3, Right 6, Left 11 — then the bull. No engine, config schema, adapter or UI change.".

### Consequences
the routine builder lists two Warm-Up templates. A further variant is another template row. Rules: `docs/game-rules/training/exercises/warm-up.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-23
