---
id: D0515
status: accepted
date: 2026-10-30
origin: contemporaneous
original-date:
tags: [game-engine, ruleset, scoring]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Mickey Mouse V1 is its own ruleset on the Marks kernel; the kernel gains `dipOf`

## Context and Problem Statement
the double-dip needs two marks from one dart, which `MarksHit` could not express; the kernel rule M4 lands a feature with its first caller. The rules doc left the closed-number and Tactics-variant questions open; the plan's calls C1–C6 settle them.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`MICKEY_MOUSE_V1` is a one-seat Marks game with twelve objectives (20…12, Doubles, Triples, Bull) and no points. `MarksRules.dipOf?(seat, observation)` returns a second `MarksHit` a dart earns on another objective; `tallyMarksDart`/`applyMarksDart` take it as an optional `dip`, applied after the primary hit under the same cap, with `spare` and treble tallies from the primary hit only. A double or treble on a number already closed still marks Doubles or Triples; on 1–11 it marks only the category. Overflow marks are dropped. Mickey Mouse is not a Tactics variant.".

### Consequences
Cricket and Tactics set no `dipOf` and their goldens do not change. Scored Mickey Mouse (V2+) revisits the duel path when a scoring dip is written. Plan: `docs/superpowers/plans/2026-10-30-mickey-mouse-v1.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-30
