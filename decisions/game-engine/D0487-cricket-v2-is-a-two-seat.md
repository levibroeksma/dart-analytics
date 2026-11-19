---
id: D0487
status: accepted
date: 2026-10-24
origin: contemporaneous
original-date:
tags: [game-engine, ruleset]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Cricket V2 is a two-seat ruleset version on the shared duel fold

## Context and Problem Statement
D421 named multiplayer a later version; D486 built the cross-seat fold for exactly this reuse.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`CRICKET_V2` (seed `0052`) adds 1v1 against a guest to `CRICKET`. Spare marks beyond the third score marks × number value (bull 25) while the opponent has not closed the number; a number is dead once both seats close it; the game ends on the first dart that leaves the throwing seat closed out with points at least equal to the opponent's, so it cannot end level. Solo under V2 folds as V1. The fold is `foldMarksDuel` (D486) with Cricket's own hit rule; nothing new is stored, no migration. One `CricketEngine` serves both keys; setup picks V2 only when a guest is added, so solo history stays one stats group. Seat cap 2. No DartBot: no strategy can aim at an objective.", because D421 named multiplayer a later version; D486 built the cross-seat fold for exactly this reuse.

### Consequences
Tactics and Cricket share `foldMarksDuel`, `foldMarksSeats`, the `MarksEngine` base class, `recordMarksDart`'s `isEnded`, `lib/game/marks-play.data.ts`, `MarksPlayScreen.astro` and one replay presenter. A DartBot marks strategy, Cut-throat, No-Score, Single-Only, more than two seats and a Cricket stats view stay V2+ (`docs/game-rules/rulesets/cricket.md`). Spec: `docs/superpowers/specs/2026-10-24-cricket-v2-design.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-24
