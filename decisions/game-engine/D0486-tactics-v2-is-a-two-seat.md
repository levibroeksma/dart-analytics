---
id: D0486
status: accepted
date: 2026-10-23
origin: contemporaneous
original-date:
tags: [game-engine, ruleset, 501]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Tactics V2 is a two-seat ruleset version with a cross-seat fold

## Context and Problem Statement
a dart's points depend on the opponent's marks at that moment, so the V1 per-seat fold cannot express them; D422 named multiplayer a later version.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`TACTICS_V2` (seed `0051`) adds 1v1 to `TACTICS`. Spare marks beyond the third score marks × number value (bull 25) while the opponent has not closed the number; a number is dead once both seats close it; the auto rule is points first (a double or treble on a 15–20 number you own scores on it and marks Doubles/Triples only once the number is dead); the game ends on the first dart that leaves the throwing seat closed out with points at least equal to the opponent's, so it cannot end level. Solo under V2 folds as V1. Points, dead numbers and the winner are folded from both seats' dart facts in log order by `foldMarksDuel` (`marks-duel.module.ts`); nothing new is stored, no migration. One `TacticsEngine` serves both keys; setup picks V2 only when a guest is added, so solo history stays one stats group. Seat cap 2; no DartBot. Tactics plays on `SeatedPlayScreen` so the seat-switch animation is the 501 one.", because a dart's points depend on the opponent's marks at that moment, so the V1 per-seat fold cannot express them; D422 named multiplayer a later version.

### Consequences
Cricket multiplayer can reuse `foldMarksDuel` with its own hit rule; the dual-purpose player choice, Strict, Minnesota Cricket and a Tactics stats view stay V2+ (`docs/game-rules/rulesets/tactics.md`). `recordMarksDart` takes an optional `isEnded`. Spec: `docs/superpowers/specs/2026-10-23-tactics-v2-design.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-23
