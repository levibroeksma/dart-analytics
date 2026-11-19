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
<!-- backfill: pending -->

# The dart analytics views are scoped to the session's owning participant

## Context and Problem Statement
Guest participants (D220/D221) throw into the same `turns`/`darts` tables as the owning player, and both views project `es.player_id` with no participant filter — so a guest's darts would have entered the owner's accuracy statistics the moment a second seat could exist. Multiplayer is what makes the omission wrong, which is why it was fixed as part of that work rather than logged as a finding. `v_game_replay` is the opposite case: it projects `p.display_name` and exists to replay a session as it was played, every participant included.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Migration `0023` adds `JOIN participants p ON p.id = t.participant_id` and `AND p.player_id = es.player_id` to both `v_dart_analytics` and `v_dart_locations`. `v_game_replay` is deliberately left unfiltered.".

### Consequences
Behaviour-preserving for every existing session — a single-participant session has exactly one participant, the `PLAYER` whose `player_id` equals `es.player_id`, so no existing row is dropped. The play-time stat row on the 501 screen is deliberately NOT scoped: on a pass-and-play device that row belongs to whoever is throwing, and how it should be presented for several seats is the drawing spec's question. The results snapshot IS scoped, in the client, by filtering the fact log to the one `PLAYER` seat.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-21
