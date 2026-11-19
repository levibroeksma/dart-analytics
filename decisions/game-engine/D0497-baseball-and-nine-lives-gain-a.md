---
id: D0497
status: accepted
date: 2026-10-26
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Baseball and Nine Lives gain a second seat in place, with no new ruleset version

## Context and Problem Statement
both games already fold per seat on the Track kernel, so a second seat needed an outcome and a cap, not a rule or schema change; a new ruleset version would have forked sessions whose config and snapshot do not change (D245).

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`SEAT_CAPS` lifts `BASEBALL_V1` and `AROUND_THE_CLOCK_V3` from one seat to two. Baseball resolves through `scoreCompareOutcome` (most runs wins, equal runs is a `TIE`, shown as "Tie — same runs!"). Nine Lives resolves through the new pure `livesOutcome` in `match-outcome.module.ts`, composed from `raceWinner` and `eliminationWinner`: the first seat to hit the bull wins at once, else the survivor wins the moment the other seat is out. The Around the Clock engine takes the `livesOutcome` branch only when the snapshot carries `lives`, so V1/V2 1v1 stays fewest-darts. For a lives snapshot `refusal` and `wouldComplete` read the match status, so the seat that did not win is never handed a dart; the `activeSeat` predicate is unchanged, so after a decided match `activeParticipantRef` still names the other seat. Baseball's `wouldComplete` also requires every other seat to have closed inning 9.".

### Consequences
no migration, seed or capability row; statistics and `v_*` views are untouched, and the derived-aims fold already reads the owner's darts alone. `soloTitle` in `around-the-clock-play.data.ts` now titles only one-seat snapshots, so a 1v1 with the first seat out reads as the survivor's win. DartBot, more than two seats, teams, Extra innings and the Bullseye Tiebreaker stay `V2+`/`Deferred` in `docs/game-rules/rulesets/baseball-darts.md` and `nine-lives.md`. Spec: `docs/superpowers/specs/2026-10-26-baseball-nine-lives-1v1-design.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-26
