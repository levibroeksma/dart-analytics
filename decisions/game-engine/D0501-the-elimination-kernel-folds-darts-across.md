---
id: D0501
status: accepted
date: 2026-10-27
origin: contemporaneous
original-date:
tags: [game-engine, engine, visit, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# The Elimination kernel folds darts across seats; Killer V1 binds first, two seats, engine-only

## Context and Problem Statement
no shipped engine is in this family, so the kernel is proved by TDD against `killer.md` and one golden trace rather than an oracle. Darts change other seats, so the stage is shared and the fold is dart-by-dart. Setup and the play screen seat two, so V1 does too.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`elimination-kernel.module.ts` folds every dart of a `SHARED` log: `EliminationRules` names `startingLives`, `initExt` and `onDart` (thrower, seats, dart → `SeatChange[]`). Lives clamp at 0, a seat at 0 is out and joins `outOrder`, a change to an out seat is ignored, and `eliminationWinner` decides the match. A visit is open while its turn has no `completedAt`; the rota passes to the next seat still in. Killer V1 (`killer.engine.module.ts`, policy `killerHit`) is a `DartGameSpec` on the existing game shell, the first `SHARED` one: per-dart effects, an own double toggles Killer status every time, player-chosen numbers 1–20 in `seat_numbers` (seat order), intent `NO_INTENT`, `isVisitOpen` = open turn, fewer than 3 darts, match in progress. V1 seats exactly 2; the kernel is N-seat. No DartBot (`RULESET_DARTBOT` omits `KILLER_V1`); no stats page (`STATS_TAGS` `["board"]`, `RESULT_DIRECTION` `null`); a minimal `REPLAY_PRESENTERS.KILLER`. The validator requires two distinct numbers.".

### Consequences
seed `0054` adds the `KILLER` game type, `KILLER_V1` and a `{"lives": 3}` preset in the engine PR, because `RULESET_CAPABILITIES` is total and its seed parity test needs the `0007` rows, which join `ruleset_versions`; `SEAT_CAPS.KILLER_V1 = 2` lands with it so the seeded game is not capped at one seat. A floor of two seats still needs a check that sees participants (PR 2). No migration. Setup, play screen, results and card follow in PR 2; `killer.md` keeps `Current version: none` until then. Spec: `docs/superpowers/specs/2026-10-27-elimination-kernel-design.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-27
