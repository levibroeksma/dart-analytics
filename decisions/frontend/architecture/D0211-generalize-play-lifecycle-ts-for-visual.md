---
id: D0211
status: accepted
date: 2026-08-15
origin: contemporaneous
original-date:
tags: [frontend/architecture]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes: D0209
superseded-by:
---
<!-- backfill: pending -->

# Generalize play-lifecycle.ts for VISUAL_BOARD input

## Context and Problem Statement
D209 excluded Bob's 27 from `play-lifecycle.ts` specifically because `VISUAL_BOARD` needed the board-tap DOM bridge and the 1.5s reveal-then-clear timer the shared module didn't have. With Singles Training and Doubles Training now needing exactly that shape too, re-forking a second and third time would reintroduce the class of duplication D208/D209 paid down. Generalizing is additive and safe: every existing `play-lifecycle.ts` consumer's `inputModeKey` is never `VISUAL_BOARD`, so the new branch is dead code on their path.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`play-lifecycle.ts` (`playCommitDart`, `playUndoVisit`, `runPlayAgain`) now optionally supports board input — an additive `hiddenTimer` field on `PlayLifecycleContext` and a mode-gated reveal-then-clear branch, plus a new shared `playVisitMarkers` helper — rather than re-forking Singles/Doubles Training into bespoke play-data modules the way Bob's 27 did.".

### Consequences
Bob's 27 itself is unchanged — its own `commitDart`/`undoVisit`/`visitMarkers` stay bespoke, not a forced migration onto the now-generalized shared module. A fourth ruleset needing board input reuses `play-lifecycle.ts` directly with no further architectural change.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-15
