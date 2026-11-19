---
id: D0468
status: accepted
date: 2026-10-17
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset, scoring, visit]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Track kernel: a reducer driven by a record of policy functions

## Context and Problem Statement
a pure-data enum config would force each shipped engine's special cases (Shanghai's instant win, Target Scoring's chain) into one generic switch past fallow's complexity limit; policies keep each special case local to the one ruleset that has it, and the projection lets the oracle compare old and new engines on identical state.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`modules/game/track-kernel.module.ts` holds the Track family's only reducer, `applyTrackDart` (judge → points → `onDart` → visit close → `onVisitClose`), and `foldTrackSeats`; a ruleset is a `TrackRules<TExt>` record of named policies (`track-policies.ts`) built per read from its configuration snapshot, with game-owned extras in `TrackSeat.ext`. A migrated engine keeps its exported reducer, fold and `state()` shape by projecting `TrackSeat` to its legacy seat state. Doubles Training is the first bound engine. Match outcome stays in each fold until a second engine shares it; the umbrella `RuleKernel` interface waits for a second family.".

### Consequences
PRs 2–7 of `docs/superpowers/specs/2026-10-17-track-kernel-design.md` add policies with their first caller and flip their `scripts/engine-kernels.txt` row. Spec: that file; plan: `docs/superpowers/plans/2026-10-17-track-kernel.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-17
