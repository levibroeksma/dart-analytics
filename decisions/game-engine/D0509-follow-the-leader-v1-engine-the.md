---
id: D0509
status: accepted
date: 2026-10-29
origin: contemporaneous
original-date:
tags: [game-engine, engine, undo, visit, turns, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Follow the Leader V1 engine: the Elimination kernel grows a visit-close hook, a shared slot and rota override; `turns.kept`; shell visit actions

## Context and Problem Statement
whether a seat failed, matched or must set depends on the whole visit, so the per-dart hook cannot decide it; the leader and target live in no seat, hence the shared slot. A stored `kept` flag makes a keep a fact the fold replays rather than an inference from a missing turn.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`EliminationRules` gains three optional members, so Killer's fold is unchanged (pinned by a regression test): `onVisitClose(visit, seats, shared)` runs once when a turn closes (`completedAt` set) and returns seat changes plus the next `shared`, `initShared` seeds the `shared` slot on `EliminationMatch`, and `activeOverride(seats, shared)` names the seat to act next (the rota stays on a seat owed a re-throw). Follow the Leader (`follow-the-leader.engine.module.ts`, policy `follow-the-leader-policy.ts`) resolves a visit at close, not per dart: target, leader, `failed` set and lives all come from `resolveVisit`. Migration `0051` adds `turns.kept BOOLEAN NOT NULL DEFAULT false`; a keep is a closed, dartless turn with `kept = true`, and the upload validator, not a CHECK, requires no darts and a total of 0. The game shell gains `DartGameSpec.visitActions` (STOP closes an open darted turn early, KEEP writes a kept turn), undone like a dart. V1 seats two (kernel and tests cover 3 to 4), key `FOLLOW_THE_LEADER_V1`, `SHARED` stage, no DartBot, no stats page, `STATS_TAGS` `["board"]`. Replay result labels: `Keep`, `Fail`, `Retry`, `Set`, `Match`.".

### Consequences
seed `0055` adds the `FOLLOW_THE_LEADER` game type, `FOLLOW_THE_LEADER_V1` and a `{"lives": 3}` preset, with `0007` capability rows (50) and tag rows in `0042`; `follow-the-leader.md` gains `Game type:`. `SEAT_CAPS`, `SEAT_FLOORS`, setup, play, results and card follow in PR 2; `follow-the-leader.md` keeps `Current version: none` until then. Spec: `docs/superpowers/specs/2026-10-29-follow-the-leader-design.md`.
Rulings (user decision 2026-10-29 where the rules file is silent):

| Ruling | Reading |
| ------ | ------- |
| Stop before any match | Refused by the engine (`canStop` needs a match). A validator sees finished turns only, so it cannot enforce it |
| Closure | Stored via `completedAt`, never inferred; rehydration and undo replay the one rule |
| Opening and leader turns | One dart each; an off-board dart is stored, closes its turn, and the same seat throws again; no life lost, rota does not move |
| Failed | No dart of the visit matched. A matcher that matched, then lost a life to an off-board last dart, did not fail and blocks a keep |
| Match on the third dart | No spare dart; the seat loses nothing, target and leader stand |
| `keepAllowed` | Every other seat failed and no re-throw is owed; a leader whose setting dart missed the board cannot keep |
| Replay label | An off-board setting dart with no life lost reads `Retry`, not `Fail` |

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-29
