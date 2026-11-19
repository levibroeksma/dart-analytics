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

# Darts equipment lives on `players`, not `player_settings` or a new table

## Context and Problem Statement
two alternatives were weighed and rejected during design. `player_settings` was rejected because its semantics are gameplay-mode defaults copied onto a session at start — equipment is not a game-start default and copying it onto sessions would misrepresent it as one. A new `player_equipment` table was rejected as premature: the ask is one current dart set, not a collection, and a dedicated table for a single scalar pair is YAGNI until multiple dart sets are actually needed. The profile design spec lists the same two rejected alternatives and describes the request as one current dart set, not a collection.

## Decision Drivers
* Settings are gameplay-mode defaults copied onto a session at start, and equipment is not one.
* The ask is one current dart set, not a collection, so a dedicated table for a single scalar pair is premature.
* `PATCH /api/players/me` follows the replace-everything convention that `PATCH /api/players/me/settings` established.

## Considered Options
* Add `darts_description` and `darts_weight_grams` to `players` (chosen).
* Add them to `player_settings`. Rejected: its semantics are gameplay-mode defaults copied onto a session at start.
* Add a new `player_equipment` table. Rejected as premature: one current dart set is not a collection (YAGNI).

## Decision Outcome
Chosen option: "`darts_description` (nullable `TEXT`) and `darts_weight_grams` (nullable `SMALLINT`, 1–100) are added to `players` (migration `0022`), read through a new `v_player_profile` view alongside `display_name`, and written by `PATCH /api/players/me` — replacing all three fields together, no partial update, the same convention `PATCH /api/players/me/settings` established.".

### Consequences
`03-Player-Layer.md`'s "rename endpoint deferred post-v1" note is resolved — `GET`/`PATCH /api/players/me` is that endpoint, now also carrying darts equipment. `v_player_profile` is a plain projection over `players` with no joins, since neither new column is FK-backed. If multiple dart sets are ever needed, this shape is superseded, not extended in place.

* Good, because `players` holds the one current dart set without a new table (spec, rejected alternatives).
* Good, because `v_player_profile` is a plain projection over `players` with no joins.
* Neutral, because supporting multiple dart sets later supersedes this shape instead of extending it in place.

### Confidence
Rationale unknown — no source found.

### Revisit When
Multiple dart sets are needed. The record states that this shape is then superseded, not extended in place.

### Confirmation
The profile plan (Task 1) creates `database/verification/0022_player_profile_checks.sql` for migration `0022` and flags that it must run against a live database before merge, per D193.

## Pros and Cons of the Options
`player_settings`: rejected because settings are gameplay-mode defaults copied onto sessions, and equipment is not a game-start default.

`player_equipment` table: rejected as premature, because the ask is one current dart set, not a collection.

`players` columns: chosen, because they carry the single current dart set with no new table and no join in `v_player_profile`.

## Evidence / More Information
Decided: 2026-08-15

* `docs/superpowers/specs/2026-08-15-profile-display-darts-config-design.md` (migration `0022`, "Rejected alternatives", `PATCH /api/players/me`): rebuilt Context, Decision Drivers, Considered Options and Pros and Cons.
* `docs/superpowers/plans/2026-08-15-profile-display-darts-config.md` (Task 1): rebuilt Confirmation.
* Commit `ea65944a` (2026-08-16; adds the D212 row in `decisions/database.md`): rebuilt Context and Consequences.
