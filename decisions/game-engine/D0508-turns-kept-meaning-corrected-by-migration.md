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

# `turns.kept` meaning corrected by migration `0052`; the replay carries `kept` (`0053`)

## Context and Problem Statement
the D344 in-place carve-out needs `db:status` and `db:status:prod` proof that `0051` is pending everywhere, and this session had no `DATABASE_URL`. Without `kept` in the view a stored keep replayed as a dartless setting turn, read `Retry`, and the rebuilt active seat and phase went wrong from that turn on.

## Decision Drivers
* A replay must rebuild a keep, so `v_game_replay` has to expose `kept` (spec status note, 2026-10-30).
* `0051`'s column comment named the wrong meaning for a kept turn (spec status note, 2026-10-30).

## Considered Options
* Edit `0051` in place under the D344 carve-out: Context says it needs `db:status` and `db:status:prod` proof that `0051` is pending, and the session had no `DATABASE_URL`.
* New migrations `0052` and `0053`.

## Decision Outcome
Chosen option: "a kept turn is the Follow the Leader leader's dartless keep: when every other seat failed, the leader keeps the target unchanged; the turn has no darts and `total_score` 0. `0051`'s column comment said a kept turn was a visit that matched the leader; migration `0052_turns_kept_comment.sql` replaces that comment instead of editing `0051` in place. Migration `0053_replay_view_kept.sql` appends `kept` to `v_game_replay`, and the statistics replay carries it end to end: `ReplayRow`/`ReplayTurn`, `rowsToTurns`, `ReplayTurnSchema` (`kept`, default `false`), `turnFactOf`, `findReplayTurnPage` and `findStepFoldRows`.".

### Consequences
the 05-Database and API docs state the corrected meaning; `database/verification/0053_replay_view_kept_checks.sql` proves the view column. D509 stands; its "`v_*` views untouched" reading (spec §6) no longer holds.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`database/verification/0053_replay_view_kept_checks.sql` proves the `kept` column on the view.

## Pros and Cons of the Options
### Edit `0051` in place
* Bad, because the carve-out needs `db:status` and `db:status:prod` proof, which the session lacked (Context).

### New migrations `0052` and `0053`
* Good, because `0051` stays unedited (header of `0052_turns_kept_comment.sql`: "0051 is left untouched (applied-migration rule)").

## Evidence / More Information
Decided: 2026-10-30

* `docs/superpowers/specs/2026-10-29-follow-the-leader-design.md` (status note, 2026-10-30): rebuilt Decision Drivers.
* Commit `71bcf1f7` (PR #1157; adds migrations `0051`–`0053`): rebuilt Considered Options, Confirmation and Pros and Cons.
