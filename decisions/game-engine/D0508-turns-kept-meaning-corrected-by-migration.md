---
id: D0508
status: accepted
date: 2026-10-30
origin: contemporaneous
original-date:
tags: [game-engine, visit, turns, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# `turns.kept` meaning corrected by migration `0052`; the replay carries `kept` (`0053`)

## Context and Problem Statement
the D344 in-place carve-out needs `db:status` and `db:status:prod` proof that `0051` is pending everywhere, and this session had no `DATABASE_URL`. Without `kept` in the view a stored keep replayed as a dartless setting turn, read `Retry`, and the rebuilt active seat and phase went wrong from that turn on.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "a kept turn is the Follow the Leader leader's dartless keep: when every other seat failed, the leader keeps the target unchanged; the turn has no darts and `total_score` 0. `0051`'s column comment said a kept turn was a visit that matched the leader; migration `0052_turns_kept_comment.sql` replaces that comment instead of editing `0051` in place. Migration `0053_replay_view_kept.sql` appends `kept` to `v_game_replay`, and the statistics replay carries it end to end: `ReplayRow`/`ReplayTurn`, `rowsToTurns`, `ReplayTurnSchema` (`kept`, default `false`), `turnFactOf`, `findReplayTurnPage` and `findStepFoldRows`.".

### Consequences
the 05-Database and API docs state the corrected meaning; `database/verification/0053_replay_view_kept_checks.sql` proves the view column. D509 stands; its "`v_*` views untouched" reading (spec §6) no longer holds.

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
