---
id: D0421
status: accepted
date: 2026-10-06
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset, visit, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Solo Cricket is a close-out drill with no win condition

## Context and Problem Statement
with one seat there is no opponent to own a number against, so points, dead numbers and the score-compare win have nothing to act on (`docs/game-rules/rulesets/cricket.md`). Fewest darts to close out is the standard solo Cricket measure and a pure fold of dart facts.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`CRICKET` / `CRICKET_V1` (seed `0033`) ships solo only. Objectives 20–15 + Bull are an engine constant. A dart adds marks (single 1, double 2, treble 3; outer bull 1, inner bull 2), capped at 3 per objective; overflow is discarded. The dart that closes the seventh objective ends the run immediately, mid-visit if need be. The result is darts thrown, MPR (capped marks ÷ darts × 3) and darts to close per objective — all derived, none stored. Darts carry no intent. The engine is seat-aware with one seat, so multiplayer adds seating and points, not a rewrite.".

### Consequences
multiplayer, points and Cut-throat are a new ruleset version. A Cricket trend section needs a `v_cricket_*` view and a migration. Rules: `docs/game-rules/rulesets/cricket.md`.

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
