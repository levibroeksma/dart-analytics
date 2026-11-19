---
id: D0222
status: accepted
date: 2026-08-21
origin: contemporaneous
original-date:
tags: [database, migration, replay]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# The dart analytics views are scoped to the session's owning participant

## Context and Problem Statement
Guest participants (D220/D221) throw into the same `turns`/`darts` tables as the owning player, and both views project `es.player_id` with no participant filter — so a guest's darts would have entered the owner's accuracy statistics the moment a second seat could exist. Multiplayer is what makes the omission wrong, which is why it was fixed as part of that work rather than logged as a finding. `v_game_replay` is the opposite case: it projects `p.display_name` and exists to replay a session as it was played, every participant included. The guest player design spec (Read-model consequence) names the audit of existing views as part of the multiplayer work, not a finding.

## Decision Drivers
* Guest turns land in `turns` under a `GUEST` participant, so a view that computes the owner's statistics must filter on participant, or an opponent's visits enter the player's averages.
* `v_game_replay` must keep showing every participant so a session replays as it was played.

## Considered Options
* Scope `v_dart_analytics` and `v_dart_locations` to the owning participant and leave `v_game_replay` unfiltered (chosen).

## Decision Outcome
Chosen option: "Migration `0023` adds `JOIN participants p ON p.id = t.participant_id` and `AND p.player_id = es.player_id` to both `v_dart_analytics` and `v_dart_locations`. `v_game_replay` is deliberately left unfiltered.".

### Consequences
Behaviour-preserving for every existing session — a single-participant session has exactly one participant, the `PLAYER` whose `player_id` equals `es.player_id`, so no existing row is dropped. The play-time stat row on the 501 screen is deliberately NOT scoped: on a pass-and-play device that row belongs to whoever is throwing, and how it should be presented for several seats is the drawing spec's question. The results snapshot IS scoped, in the client, by filtering the fact log to the one `PLAYER` seat.

* Good, because the views stay behaviour-preserving for existing sessions: a single-participant session has one `PLAYER` participant, so no row is dropped.
* Neutral, because the play-time stat row on the 501 screen is deliberately not scoped, and its presentation for several seats is left to the drawing spec.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The verification-script drift plan creates `database/verification/0023_owner_scoped_dart_view_checks.sql` for migration `0023`. The guest plan lists migration `0023` among its files.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-08-21

* `docs/superpowers/specs/2026-08-20-guest-player-x01-design.md` (Read-model consequence): rebuilt Context and Decision Drivers.
* `docs/superpowers/plans/2026-08-20-guest-player-x01-implementation.md` (file table, migration `0023`): rebuilt Decision Drivers.
* Commit `20ca5b31` (PR #152, 2026-08-21; adds the D222 row and migration `0023`): rebuilt Context and Consequences.
* `docs/superpowers/plans/2026-08-26-db-verification-script-drift.md` (verification script `0023_owner_scoped_dart_view_checks.sql`): rebuilt Confirmation.
