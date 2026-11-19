---
id: D0212
status: accepted
date: 2026-08-15
origin: contemporaneous
original-date:
tags: [database, migration, table, column, view]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Darts equipment lives on `players`, not `player_settings` or a new table

## Context and Problem Statement
two alternatives were weighed and rejected during design. `player_settings` was rejected because its semantics are gameplay-mode defaults copied onto a session at start — equipment is not a game-start default and copying it onto sessions would misrepresent it as one. A new `player_equipment` table was rejected as premature: the ask is one current dart set, not a collection, and a dedicated table for a single scalar pair is YAGNI until multiple dart sets are actually needed.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`darts_description` (nullable `TEXT`) and `darts_weight_grams` (nullable `SMALLINT`, 1–100) are added to `players` (migration `0022`), read through a new `v_player_profile` view alongside `display_name`, and written by `PATCH /api/players/me` — replacing all three fields together, no partial update, the same convention `PATCH /api/players/me/settings` established.".

### Consequences
`03-Player-Layer.md`'s "rename endpoint deferred post-v1" note is resolved — `GET`/`PATCH /api/players/me` is that endpoint, now also carrying darts equipment. `v_player_profile` is a plain projection over `players` with no joins, since neither new column is FK-backed. If multiple dart sets are ever needed, this shape is superseded, not extended in place.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-15
