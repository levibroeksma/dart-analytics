---
id: D0284
status: accepted
date: 2026-09-16
origin: contemporaneous
original-date:
tags: [database, schema, migration, column, view]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Training gameplay counts towards career statistics, so the read model LEFT JOINs every lookup a non-game session leaves NULL

## Context and Problem Statement
issue #343. `0029` relaxed `exercise_sessions.game_type_id` to nullable but generalised no view with it, so the training gameplay D277 and D281 had just made persistent was written to `turns`/`darts` and then readable by nothing — invisible to `totalDartsThrown`, the score bands, the averages, `totalPlayTimeSeconds`, session history and `GET /api/sessions/active`. The views' own comments already claimed inclusion ("every game type and capture mode"), so the gap read as working code. The alternative — documenting the exclusion instead — was rejected by the repo owner: a darts session the player actually threw is career history regardless of whether a game engine scored it. Commit `45350792` renumbers this record from D283 to D284 after a collision with PR #359.

## Decision Drivers
* Training gameplay that D277 and D281 made persistent was readable by nothing, so it was missing from career totals, history and the active-session read.
* The views' own comments already claimed inclusion of every game type and capture mode, so the gap read as working code.
* The repo owner rejected documenting the exclusion, because a session the player threw is career history.

## Considered Options
* Convert every read-model join onto a nullable lookup into a `LEFT JOIN` (chosen).
* Document the exclusion instead. Rejected by the repo owner.

## Decision Outcome
Chosen option: "Training exercise sessions are part of career statistics, session history and the active-session read — not a separate, excluded population. Migration `0033` therefore converts every read-model join onto a lookup that `0028`/`0029` made nullable into a `LEFT JOIN`: `game_types` in `v_active_sessions`, `v_session_overview`, `v_dart_analytics`, `v_dart_locations`, `v_player_visit_facts`, `v_player_leg_facts` and `v_routine_execution`, plus `ruleset_versions`/`capture_modes`/`input_modes` in `v_active_sessions`, `capture_modes` in `v_session_overview` and `input_modes` in `v_dart_locations`. The `*_key`/`*_name` columns those joins feed are nullable from `0033` onward, and that nullability is carried through the API read layer (`SessionActive`, `PlayerSessionSummaryRow`, `PlayerVisitFactRow`, `PlayerLegFactRow`, `PlayStoreContext`'s `setSessionModes`). `v_configuration_presets` and `v_double_out_checkout_darts` keep their INNER joins.".

### Consequences
An INNER JOIN onto a nullable FK is now a recognised read-model defect, recorded in `05-Views/00-Overview.md` under View Column Naming. `favoriteGameTypeKey` skips NULL-keyed rows — a session with no game cannot be a favourite game — while `totalGamesPlayed`/`totalPlayTimeSeconds` count them. `gamesIndex` drops an active session with no ruleset version, which gates no card. `setSessionModes` takes `SessionModePair` (both keys nullable) rather than `ModePair`; the store's own mode fields were already nullable. The two excluded views are excluded for a stated reason, not by omission: `configuration_templates.game_type_id` is still NOT NULL, and `v_double_out_checkout_darts` filters to 501 `VISUAL_BOARD` in its own WHERE clause, which no non-game session can satisfy. `0033` was not applied to any database by the authoring session — no dev branch credentials were reachable — so `db:migrate`/`db:introspect` have not run against it and `app/src/db/schema.ts`'s view bodies were hand-edited to match, the D193 precedent.

* Good, because training sessions become visible in statistics, session history and the active-session read.
* Bad, because the `*_key` and `*_name` columns those joins feed become nullable and the API read layer carries that nullability.
* Neutral, because `v_configuration_presets` and `v_double_out_checkout_darts` keep INNER joins for stated reasons.
* Neutral, because the authoring session did not apply `0033` to any database, so `schema.ts` view bodies were hand-edited.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/db/read-model-non-game-sessions.test.ts`, added in the same commit, covers the non-game read model. The record says `0033` was not applied to any database by the authoring session.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-09-16

* Commit `72decb10` (PR #343, 2026-09-16; adds the decision row as D283 plus migration `0033` and its tests): rebuilt Context, Decision Drivers, Considered Options, Consequences and Confirmation.
* Commit `45350792` (2026-09-16): renumbered the row from D283 to D284 only.
