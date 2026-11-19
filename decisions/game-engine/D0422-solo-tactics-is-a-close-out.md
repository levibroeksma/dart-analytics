---
id: D0422
status: accepted
date: 2026-10-06
origin: contemporaneous
original-date:
tags: [game-engine, engine]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Solo Tactics is a close-out drill; dual-purpose is an auto rule until Multiplayer

## Context and Problem Statement
with no points the player choice never beats the auto rule, so storing it buys nothing until Multiplayer.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`TACTICS` / `TACTICS_V1` (seed `0034`) ships solo only, with no win condition, as Cricket (D421). Objectives 20–15, Bull, Doubles, Triples are an engine constant. A double/treble on 15–20 marks its number while open, else the Doubles/Triples category; a double/treble on 1–14 marks the category; the bull never feeds D/T. Cap 3 per objective; overflow is discarded. All derived from dart facts — no migration, no stored choice.", because with no points the player choice never beats the auto rule, so storing it buys nothing until Multiplayer.

### Consequences
the player choice, multiplayer, points and a Tactics stats view are a later version. Rules: `docs/game-rules/rulesets/tactics.md`. Spec: `docs/superpowers/specs/2026-10-06-tactics-v1-design.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-06
