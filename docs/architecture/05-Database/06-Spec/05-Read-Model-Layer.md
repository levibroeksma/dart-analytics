<!--
status: canonical
scope: database/read-model-layer
read-when: adding/changing views or read contracts
updated: 2026-09-19
-->

# Database Specification — Chapter 5: Read Model Layer

> Part of the canonical Database Specification (v2.2.0). Cross-layer invariants (identifier/timestamp strategy, ownership model, runtime event and configuration snapshot models) live in `../06-Database-Specification.md`. Content moved verbatim from the v2.1.0 monolith on 2026-07-11.

---

# Read Model Layer

## Purpose

The Read Model Layer provides stable, optimized query interfaces on top of the runtime truth.

Read models are implemented as PostgreSQL views.

The API consumes views — never raw tables.

---

# Design Principles

Read models must:

- expose `implementation_key` values alongside identifiers
- hide relational complexity from consumers
- contain no business logic beyond joining and labelling facts
- never introduce new truth
- remain stable contracts — structural changes are breaking changes

Views are divided into three categories (defined in `05-Views/00-Overview.md`):

1. **API Read Models** — application-facing structures
2. **Replay Views** — deterministic gameplay reconstruction
3. **Analytics Views** — derived performance insights

Migration `0009` delivers the initial five views. Migration `0013` normalizes their column names to the read-model standard in `01-Naming-Conventions.md`. Migration `0016` rebuilds `v_game_replay` and `v_session_overview` and adds `v_configuration_presets`. <!-- 2026-07-13 --> Migration `0018` adds `v_dart_locations`. <!-- 2026-08-05 --> Migration `0021` adds `v_player_settings`. <!-- 2026-08-08 --> Migration `0022` adds `v_player_profile`. <!-- 2026-08-15 --> Migration `0023` scopes `v_dart_analytics` and `v_dart_locations` to the session's owning participant; `v_game_replay` is deliberately left unfiltered, because it exists to replay a session as it was played, every participant included. <!-- 2026-08-21 --> Migration `0024` adds `v_double_out_checkout_darts`, scoped to 501 `VISUAL_BOARD` sessions only. <!-- 2026-09-05 --> Migrations `0025`/`0026` add `v_player_visit_facts` and `v_player_leg_facts` for career-wide statistics — full detail in `05-Views/01-General-Views.md`, not repeated here. <!-- 2026-09-06 --> Migration `0033` turns every join onto a lookup that `0028`/`0029` made nullable into a `LEFT JOIN`, so a session with no game bound to it appears with NULL keys instead of being dropped from the read model; the `*_key`/`*_name` columns those joins feed are nullable from `0033` onward. <!-- 2026-09-16 --> Migration `0036` recreates `v_double_out_checkout_darts` and `v_routine_execution` so each carries the columns its consumer reads, ending the two raw-table reads that went around them (D298). <!-- 2026-09-17 --> Migration `0039` drops `v_double_out_checkout_darts` and replaces it with `v_x01_checkout_darts`, widened to 501/TUOD/121 `VISUAL_BOARD` sessions and projecting no running total, since `05-Views.md` forbids TUOD's/121's ladder-fold game-engine logic in SQL -- the read layer folds remaining-before-dart in the app instead, through the same builder the live result modals use. <!-- 2026-09-19 --> Migration `0042` adds `v_training_completions`, the completed-training read behind the homepage "done today" check (D353). <!-- 2026-09-22 --> Future analytics views are described under Future Expansion. <!-- 2026-07-12 -->

---

# v_active_sessions

## Category

API Read Model

## Purpose

Lists sessions available for resume.

Used by application startup to reconcile local `sessionId` with server `ACTIVE` rows: resume when they match; otherwise auto-abandon the orphan synchronously (no user prompt). The view itself does not reconstruct gameplay state. <!-- 2026-07-17 -->

## Sources

- exercise_sessions
- game_types (LEFT JOIN)
- capture_modes (LEFT JOIN)
- input_modes (LEFT JOIN)
- ruleset_versions (LEFT JOIN)
- game_statuses (filter: ACTIVE)

## Exposes

Session identity, player, game type (key + name), capture mode key, input mode key, ruleset version key, start time. Every one of those keys — and `game_type_name` — is NULL for a training exercise session, which binds no game type or ruleset version and, for a Warm-Up, no capture pair either. Migration `0033` made the four lookup joins `LEFT JOIN`s so such a session appears in the resume list at all; an INNER JOIN deleted the row instead of returning NULL keys. <!-- 2026-09-16 -->

## Design Rationale

Resume is the most latency-sensitive read path. The view pre-joins every label the UI needs so recovery requires a single query.

The filter uses the status `implementation_key`, not a hard-coded numeric id.

---

# v_session_overview

## Category

API Read Model

## Purpose

High-level gameplay history for list screens.

## Sources

- exercise_sessions
- game_types (LEFT JOIN)
- game_statuses
- capture_modes (LEFT JOIN)

## Exposes

Session identity, player, game type (key + name), status key, capture mode key, start/completion times and a computed integer `duration_seconds` (floored; migration `0016`). `game_type_key`, `game_type_name` and `capture_mode_key` are NULL for a training exercise session (migration `0033`), which therefore counts towards career session totals and play time like any other session. <!-- 2026-09-16 -->

## Design Rationale

`duration_seconds` is derived at query time (`completed_at − started_at`, falling back to `now()` for running sessions). It is presentation logic, not stored truth — consistent with Facts Over Calculations.

---

# v_game_replay

## Category

Replay View

## Purpose

Reconstructs the exact gameplay sequence of a session.

## Sources

- exercise_sessions
- exercise_stages + stage_types
- turns
- participants
- darts (LEFT JOIN — turn-total-only turns appear with NULL dart columns)
- dart_zones (intended and hit, LEFT JOIN)

## Exposes

Stage identity (stage_id, parent_stage_id) for tree reconstruction, stage sequence and stage type key, turn sequence, participant name, turn total score, dart number, intended target + zone key, hit target + zone key, score. <!-- 2026-07-13 -->

## Design Rationale

Ordering columns (stage sequence, turn sequence, dart number) let the consumer replay events chronologically.

Zone joins are LEFT JOINs because recreational capture may omit intention and result detail.

Replay depends only on runtime data — never on current templates or rulesets.

Stage sequence numbers are only unique per parent, so consumers order and nest via stage_id/parent_stage_id. Recreational sessions replay at turn resolution via turn_total_score. <!-- 2026-07-13 -->

---

# v_dart_analytics

## Category

Analytics View

## Purpose

Intention-complete, analytics-ready dart dataset.

## Sources

- darts → turns → participants, exercise_stages → exercise_sessions → game_types (LEFT JOIN)
- dart_zones (intended and hit, LEFT JOIN)

## Exposes

Session id (migration `0014`), player, game type key, intended target + intended zone key, hit target + hit zone key, score, and a computed `exact_hit` flag (intended target and zone both match the hit). <!-- 2026-07-12 -->

Scoped to the session's OWNING player: migration `0023` joins `participants` and filters `p.player_id = es.player_id`, so a guest participant's darts never enter the owner's accuracy statistics. Behaviour-preserving for every single-participant session. <!-- 2026-08-21 --> `game_type_key` is NULL for a dart-throwing training exercise (Switching, Double Pattern), whose darts migration `0033` admits into this dataset. <!-- 2026-09-16 -->

## Design Rationale

This is the foundation dataset for every accuracy statistic: double hit rates, miss tendencies, intended-vs-hit matrices.
`v_dart_analytics` is intentionally narrower than raw dart history: it includes only darts where both `intended_target_number` and `intended_zone_id` are present so accuracy and miss-intent analysis has complete intention data.

`exact_hit` is a derived convenience flag, not stored truth.

---

# v_routine_execution

## Category

API Read Model

## Purpose

Shows the ordered exercises of a routine for execution.

## Sources

- routine_templates
- routine_steps
- exercise_templates
- exercise_types
- duration_types
- game_types (LEFT JOIN)
- exercise_ruleset_versions (LEFT JOIN, on the template's pinned version)

## Exposes

Routine identity and name, `is_system_template`, the routine's owner (`player_id`, NULL for a system routine) and `routine_description`, step sequence, exercise identity, name and `exercise_description`, exercise type key, exercise ruleset version key, game type key, duration value and duration type key, plus the two configuration snapshots a step resolves from: the template's `default_configuration` and the step's own `step_configuration`. Every lookup is exposed as a `*_key`; no internal lookup ids are exposed. <!-- 2026-07-12 --> `game_type_key` is NULL for a non-game exercise step — `exercise_templates.game_type_id` is nullable from migration `0028`, and `0033` stops the join dropping such a step from the routine entirely. <!-- 2026-09-16 --> `exercise_ruleset_version_key` is the mirror case: NULL for a GAME step, which pins a game ruleset version on its session instead (D295). The six columns after `duration_type_key` were added by migration `0036` (D298). `player_id`, `routine_description` and `exercise_description` were added by migration `0038` (D336), so an owner-scoped "system + own" routine list stays view-backed instead of joining `routine_templates` directly. <!-- 2026-09-19 -->

## Design Rationale

The frontend renders and executes a routine from this single view without touching template tables. `findRoutineTemplateSteps` (`repositories/training-session.repository.ts`) does the same from migration `0036` on; until then it re-implemented the read against the template tables, because the view exposed none of the exercise type, ruleset version or configuration snapshots a step resolves from (issue #344, D299). A routine with no steps produces no rows here, so a stepless template reads as no routine at all. <!-- 2026-09-17 -->

---

# v_exercise_template_catalog

## Category

API Read Model

## Purpose

Lists the system exercise templates a player may compose a custom routine from — the routine builder's picker read (D306, D321). <!-- 2026-09-19 -->

## Sources

- exercise_templates
- exercise_types
- game_types (LEFT JOIN)

## Exposes

`exercise_template_id`, `name`, `description`, exercise type key, game type key, and `has_default_configuration` — a derived boolean (`default_configuration IS NOT NULL`), not a stored column. Filtered to `is_system_template` and the exercise type's `is_published`; a user-owned template never appears, and neither does a template of an unpublished exercise type. <!-- 2026-09-19 -->

## Design Rationale

The view is deliberately broad: it does not filter out a template whose `has_default_configuration` is FALSE (a GAME template, whose configuration comes from its game session, not a routine step) — narrowing to only the templates a routine step can actually use is the service layer's job (`listExerciseTemplates` in `app/src/services/routine.service.ts`, which filters on `hasDefaultConfiguration`), not the view's. Keeping the exclusion in the service, not the view, keeps the view a plain projection and leaves room for a future consumer that wants the unfiltered catalog. <!-- 2026-09-19 -->

---

# v_training_completions

## Category

API Read Model

## Purpose

One row per completed training activity with the routine it ran — the homepage "done today" read (migration `0042`, D353). Backs `GET /api/training-sessions/completed`. <!-- 2026-09-22 -->

## Sources

- activities
- activity_configurations
- game_statuses

## Exposes

`activity_id`, `player_id`, `routine_template_id` and `routine_name` (read from the configuration snapshot JSON), `completed_at`. Filtered to `game_statuses.implementation_key = 'COMPLETED'`; abandoned and still-active trainings never appear. <!-- 2026-09-22 -->

## Design Rationale

A training activity is one carrying an `activity_configurations` snapshot; standalone game activities never join. The routine fields come from the snapshot, not a template FK, so editing or deleting a routine never rewrites history. The view is day-agnostic — the server has no player timezone (D343), so the caller filters `completed_at` by an instant it computes (local midnight). <!-- 2026-09-22 -->

---

# v_configuration_presets

## Category

API Read Model

## Purpose

Lists configuration presets (system + player-owned) per game type for game setup. Backs `GET /api/configuration-templates`. <!-- 2026-07-13 -->

## Sources

- configuration_templates
- game_types

## Exposes

`configuration_template_id` (the UUID the API accepts as `templateRef`), `player_id` (scoping), game type key, name, description, configuration JSONB, `is_system_template`.

## Design Rationale

The only template-layer read model: presets must be discoverable before session creation, and referencing an entity obtained from a read endpoint is normal REST addressing. Runtime still never references templates — the snapshot copy rule is untouched.

---

# v_dart_locations

## Category

Analytics View

## Purpose

Exposes dart landing coordinates in millimetres, with derived polar form, for spatial analysis of `VISUAL_BOARD` capture. Backs miss-direction and heat-map style reads. <!-- 2026-08-05 -->

## Sources

- darts → turns → participants, exercise_stages → exercise_sessions → game_types (LEFT JOIN), input_modes (LEFT JOIN)
- dart_zones (intended and hit, LEFT JOIN)

## Exposes

Session id, player id, game type key, input mode key, stage id, turn sequence, turn total score, dart number, hit target + hit zone key, intended target + intended zone key, score, `location_x`, `location_y`, and two derived columns: `radius_mm` (plain distance from the bull centre) and `angle_degrees` (clockwise bearing from the upward vertical, `0` straight up and `90` straight right — matching the classifier's sector convention). Only darts with both coordinates present are returned (`WHERE location_x IS NOT NULL AND location_y IS NOT NULL`), and only the session's OWNING player's darts: migration `0023` joins `participants` and filters `p.player_id = es.player_id`. <!-- 2026-08-21 --> `game_type_key` and `input_mode_key` are NULL for a training exercise session, whose coordinates migration `0033` admits. <!-- 2026-09-16 -->

## Design Rationale

`radius_mm` and `angle_degrees` are plain arithmetic over the stored coordinate — no board geometry lives in this view. **Miss margin is deliberately not exposed here.** It needs a zone centroid, which is board geometry, and that geometry already lives once in `app/src/lib/game/board/board-geometry.module.ts` (`zoneCentroid`). Computing it a second time in SQL would drift from the classifier that produced the coordinate in the first place, so `missMargin` (`app/src/lib/game/board/miss-margin.module.ts`) is computed in the application read layer from this view's raw columns instead. <!-- 2026-08-05 -->

Both derived columns are `NUMERIC`, not `double precision`. `MOD()` has no `double precision` overload and the cast from it is assignment-only, so `MOD(DEGREES(...) + 360, 360)` fails at `CREATE VIEW` — the angle is cast with `::NUMERIC` before the modulo. `app/tests/db/migration-numeric-typing.test.ts` guards the whole chain against the same shape. Consequence for the read layer: `NUMERIC` arrives as a **string** through Drizzle/node-postgres, so `location_x`, `location_y`, `radius_mm` and `angle_degrees` must be parsed to numbers before reaching `missMargin`, which takes numbers. <!-- 2026-08-08 -->

---

# v_x01_checkout_darts

## Category

Analytics View

## Purpose

Per-dart facts, stage tree, counted turn total and configuration snapshot for the three X01 ladders (501, TUOD, 121) under `VISUAL_BOARD` capture, for reproducing dart-level checkout accuracy outside the live in-session read. Migration `0039` replaces `v_double_out_checkout_darts` (migrations `0024`/`0036`) with this view. <!-- 2026-09-19 -->

## Sources

- darts → turns → exercise_stages → exercise_sessions → participants, game_types, ruleset_versions, input_modes
- exercise_configurations (LEFT JOIN)
- dart_zones (hit, LEFT JOIN)

## Exposes

Session id, player id, game type key, ruleset version key, the session's configuration snapshot, stage id + sequence + stage type key + parent stage id (for stage-tree reconstruction), turn id + sequence + counted `turn_total_score` + `completed_at`, participant id, dart number, hit target + hit zone key, score. Scoped to `game_type_key IN ('501', 'TUOD', 'ONE_TWENTY_ONE')`, `input_mode_key = 'VISUAL_BOARD'`, and the session's OWNING player (mirrors migration `0023`).

## Design Rationale

`v_double_out_checkout_darts` projected `prior_scored_in_stage` as a windowed `SUM(d.score)` over raw dart rows — plain arithmetic, not the leg's counted score. A busted visit stores `turns.total_score = 0` while its darts keep their real board scores (that divergence is deliberate; it is what makes bust rate computable), so a running `SUM(d.score)` overstates the leg's counted total the moment a bust occurs, sliding every later dart in that leg onto a remaining the player was never on — that is the one sentence for why the running total left SQL. This view therefore projects no running total at all: only facts (the stage tree, the counted turn total, and each dart), which the application read layer folds into remaining-before-dart through `checkout-visits.module.ts` — the same builder the live result modals use — before running them through `classifyDoubleAttempts` (`app/src/modules/game/double-attempt.module.ts`). Folding out of SQL is also what let TUOD and 121 join this view at all: their remaining depends on a ladder fold (`finishBonus`/`missPenalty` escalation), which is game-engine logic and does not belong in a view (`05-Views.md`) — the reason `v_double_out_checkout_darts` stayed 501-only.

---

# v_player_settings

## Category

API Read Model

## Purpose

Exposes a player's default capture and input mode as implementation keys rather than lookup ids. Backs `GET /api/players/me/settings` and the read half of `PATCH`. <!-- 2026-08-08 -->

## Sources

- player_settings
- capture_modes (LEFT JOIN)
- input_modes (LEFT JOIN)

## Exposes

`player_id`, `default_capture_mode_key`, `default_input_mode_key`, `updated_at`.

## Design Rationale

Both lookup joins are `LEFT JOIN` because `player_settings.default_capture_mode_id` and `default_input_mode_id` are nullable — an `INNER JOIN` would drop the whole row instead of returning NULL keys, and the service could not then tell "no preference stored" from "no settings row at all".

A player with no settings row produces **no row here**. That is deliberate: the service applies the `RECREATIONAL` + `QUICK_SCORE` defaults, and the row is created lazily on first write, so no backfill is needed for players provisioned before settings shipped. The same fallback covers a row whose mode ids are NULL.

---

# v_player_profile

## Category

API Read Model

## Purpose

Exposes a player's display name and darts equipment. Backs `GET /api/players/me` and the read half of `PATCH`. <!-- 2026-08-15 -->

## Sources

- players

## Exposes

`player_id`, `display_name`, `darts_description`, `darts_weight_grams`, `updated_at`.

## Design Rationale

A plain projection over `players` — no joins, since `darts_description`/`darts_weight_grams` are not FK-backed. Reads still go through this view rather than the raw table, per the view-backed-reads rule. `darts_description` and `darts_weight_grams` are NULL for a player who never configured equipment; the view does not invent defaults.

---

# Read Model Layer Summary

The initial read models cover the three core read paths:

| Path | View |
| ---- | ---- |
| Resume | v_active_sessions |
| History | v_session_overview, v_game_replay |
| Analytics | v_dart_analytics, v_dart_locations |
| Routine execution | v_routine_execution |
| Game setup | v_configuration_presets |
| Player preferences | v_player_settings |
| Player profile | v_player_profile |

New statistics are delivered as new views — never as stored aggregates.

---

