---
id: D0308
status: accepted
date: 2026-09-17
origin: contemporaneous
original-date:
tags: [frontend/architecture, barrel, types]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# `training/` is the umbrella domain; trivia and exercises are its sub-domains

## Context and Problem Statement
D265 retired "trivia" as a UI category — Quick Subtract is a flat card under `/training`, a sibling of Balanced Training — but only the page routes moved, leaving three source folders named after an IA that no longer exists (issue #297). `/training` bundles trivia tools and routine exercises, so one umbrella with named sub-domains says what the app is, where three flat siblings said what it used to be.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`lib/`, `modules/` and `components/layout/` each carry one `training/` domain with three children — `trivia/`, `exercises/`, `routines/`. `docs/architecture/09-Training/` and `docs/game-rules/training/` mirror it. `components/layout/games/`, `services/exercise-rulesets/` and `docs/game-rules/rulesets/` stay outside the umbrella.".

### Consequences
the type-barrel chain gained a level — `training/types.ts` is now a pure barrel raising its three children, and the routine declarations live in `training/routines/types.ts`, because `check-type-barrels.sh` rule 2 forbids raising a grandchild. `services/exercise-rulesets/` keeps its name and does not mirror `lib/training/exercises/`: the two sit on opposite sides of the Worker/browser boundary and were never a mirrored pair. Games are not training, so `components/layout/games/` stays where it is.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-17
Refines: D261, D265
