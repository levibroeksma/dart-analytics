<!--
status: canonical
scope: database/read-model-layer
read-when: adding/changing views or read contracts
updated: 2026-08-08
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

Views are divided into three categories (defined in `05-Views.md`):

1. **API Read Models** — application-facing structures
2. **Replay Views** — deterministic gameplay reconstruction
3. **Analytics Views** — derived performance insights

Migration `0009` delivers the initial five views. Migration `0013` normalizes their column names to the read-model standard in `01-Naming-Conventions.md`. Migration `0016` rebuilds `v_game_replay` and `v_session_overview` and adds `v_configuration_presets`. <!-- 2026-07-13 --> Migration `0018` adds `v_dart_locations`. <!-- 2026-08-05 --> Migration `0021` adds `v_player_settings`. <!-- 2026-08-08 --> Future analytics views are described under Future Expansion. <!-- 2026-07-12 -->

---

# v_active_sessions

## Category

API Read Model

## Purpose

Lists sessions available for resume.

Used by application startup to reconcile local `sessionId` with server `ACTIVE` rows: resume when they match; otherwise auto-abandon the orphan synchronously (no user prompt). The view itself does not reconstruct gameplay state. <!-- 2026-07-17 -->

## Sources

- exercise_sessions
- game_types
- capture_modes
- input_modes
- game_statuses (filter: ACTIVE)

## Exposes

Session identity, player, game type (key + name), capture mode key, input mode key, ruleset version key, start time.

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
- game_types
- game_statuses
- capture_modes

## Exposes

Session identity, player, game type (key + name), status key, capture mode key, start/completion times and a computed integer `duration_seconds` (floored; migration `0016`).

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

- darts → turns → exercise_stages → exercise_sessions → game_types
- dart_zones (intended and hit, LEFT JOIN)

## Exposes

Session id (migration `0014`), player, game type key, intended target + intended zone key, hit target + hit zone key, score, and a computed `exact_hit` flag (intended target and zone both match the hit). <!-- 2026-07-12 -->

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
- game_types
- duration_types

## Exposes

Routine identity and name, step sequence, exercise identity and name, game type key, duration value and duration type key. Every lookup is exposed as a `*_key`; no internal lookup ids are exposed. <!-- 2026-07-12 -->

## Design Rationale

The frontend renders and executes a routine from this single view without touching template tables.

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

- darts → turns → exercise_stages → exercise_sessions → game_types, input_modes
- dart_zones (intended and hit, LEFT JOIN)

## Exposes

Session id, player id, game type key, input mode key, stage id, turn sequence, turn total score, dart number, hit target + hit zone key, intended target + intended zone key, score, `location_x`, `location_y`, and two derived columns: `radius_mm` (plain distance from the bull centre) and `angle_degrees` (clockwise bearing from the upward vertical, `0` straight up and `90` straight right — matching the classifier's sector convention). Only darts with both coordinates present are returned (`WHERE location_x IS NOT NULL AND location_y IS NOT NULL`).

## Design Rationale

`radius_mm` and `angle_degrees` are plain arithmetic over the stored coordinate — no board geometry lives in this view. **Miss margin is deliberately not exposed here.** It needs a zone centroid, which is board geometry, and that geometry already lives once in `app/src/lib/game/board/board-geometry.module.ts` (`zoneCentroid`). Computing it a second time in SQL would drift from the classifier that produced the coordinate in the first place, so `missMargin` (`app/src/lib/game/board/miss-margin.module.ts`) is computed in the application read layer from this view's raw columns instead. <!-- 2026-08-05 -->

Both derived columns are `NUMERIC`, not `double precision`. `MOD()` has no `double precision` overload and the cast from it is assignment-only, so `MOD(DEGREES(...) + 360, 360)` fails at `CREATE VIEW` — the angle is cast with `::NUMERIC` before the modulo. `app/tests/db/migration-numeric-typing.test.ts` guards the whole chain against the same shape. Consequence for the read layer: `NUMERIC` arrives as a **string** through Drizzle/node-postgres, so `location_x`, `location_y`, `radius_mm` and `angle_degrees` must be parsed to numbers before reaching `missMargin`, which takes numbers. <!-- 2026-08-08 -->

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

New statistics are delivered as new views — never as stored aggregates.

---

