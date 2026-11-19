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

# The Elimination kernel folds darts across seats; Killer V1 binds first, two seats, engine-only

## Context and Problem Statement
no shipped engine is in this family, so the kernel is proved by TDD against `killer.md` and one golden trace rather than an oracle. Darts change other seats, so the stage is shared and the fold is dart-by-dart. Setup and the play screen seat two, so V1 does too.

## Decision Drivers
* No shipped engine is in this family, so there is no oracle; the kernel is proved by TDD against `killer.md` and one golden trace.
* Setup and the play screen seat two, so V1 seats exactly 2 while the kernel stays N-seat.
* No DartBot strategy chooses among opponents' doubles, and V1 ships no career stats page.

## Considered Options
* Seat 3-4 players in Killer V1.
* Build the kernel with a bound `DartGameSpec` and 2 seats (chosen).

## Decision Outcome
Chosen option: "`elimination-kernel.module.ts` folds every dart of a `SHARED` log: `EliminationRules` names `startingLives`, `initExt` and `onDart` (thrower, seats, dart → `SeatChange[]`). Lives clamp at 0, a seat at 0 is out and joins `outOrder`, a change to an out seat is ignored, and `eliminationWinner` decides the match. A visit is open while its turn has no `completedAt`; the rota passes to the next seat still in. Killer V1 (`killer.engine.module.ts`, policy `killerHit`) is a `DartGameSpec` on the existing game shell, the first `SHARED` one: per-dart effects, an own double toggles Killer status every time, player-chosen numbers 1–20 in `seat_numbers` (seat order), intent `NO_INTENT`, `isVisitOpen` = open turn, fewer than 3 darts, match in progress. V1 seats exactly 2; the kernel is N-seat. No DartBot (`RULESET_DARTBOT` omits `KILLER_V1`); no stats page (`STATS_TAGS` `["board"]`, `RESULT_DIRECTION` `null`); a minimal `REPLAY_PRESENTERS.KILLER`. The validator requires two distinct numbers.".

### Consequences
seed `0054` adds the `KILLER` game type, `KILLER_V1` and a `{"lives": 3}` preset in the engine PR, because `RULESET_CAPABILITIES` is total and its seed parity test needs the `0007` rows, which join `ruleset_versions`; `SEAT_CAPS.KILLER_V1 = 2` lands with it so the seeded game is not capped at one seat. A floor of two seats still needs a check that sees participants (PR 2). No migration. Setup, play screen, results and card follow in PR 2; `killer.md` keeps `Current version: none` until then. Spec: `docs/superpowers/specs/2026-10-27-elimination-kernel-design.md`.
* Bad, because V1 ships without a DartBot seat and without a stats page; the results modal carries the result.
* Neutral, because the kernel stays N-seat and its tests cover 3-4 seats.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/game/elimination-kernel.module.test.ts`, `elimination-policies.test.ts` and `killer.engine.module.test.ts` check the kernel and Killer V1.

## Pros and Cons of the Options
### Seat 3-4 players in V1
* Bad, because setup (`lib/game/guest-list.ts`) allows one guest or bot and `SeatedPlayScreen` draws two seats.

### Kernel plus Killer V1 as a `DartGameSpec`
* Good, because the kernel ignores changes to an out seat, so a policy need not check.

## Evidence / More Information
Decided: 2026-10-27

* `docs/superpowers/specs/2026-10-27-elimination-kernel-design.md` (§ 1 decisions E1-E9, § 2, § 3): rebuilt Decision Drivers, Considered Options, Pros and Cons, Consequences and Confirmation.
* Commit `b4b42150` (PR #1123, 2026-10-27; adds the D501 row and the kernel tests): confirmed Confirmation.
* Applied in: `docs/superpowers/plans/2026-10-28-elimination-kernel-pr2.md`, `docs/superpowers/plans/2026-10-29-follow-the-leader.md`.
