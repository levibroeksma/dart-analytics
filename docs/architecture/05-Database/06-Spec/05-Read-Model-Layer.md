<!--
status: canonical
scope: database/read-model-layer
read-when: adding/changing views or read contracts
updated: 2026-07-17
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

Migration `0009` delivers the initial five views. Migration `0013` normalizes their column names to the read-model standard in `01-Naming-Conventions.md`. Migration `0016` rebuilds `v_game_replay` and `v_session_overview` and adds `v_configuration_presets`. <!-- 2026-07-13 --> Future analytics views are described under Future Expansion. <!-- 2026-07-12 -->

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

# Read Model Layer Summary

The initial read models cover the three core read paths:

| Path | View |
| ---- | ---- |
| Resume | v_active_sessions |
| History | v_session_overview, v_game_replay |
| Analytics | v_dart_analytics |
| Routine execution | v_routine_execution |
| Game setup | v_configuration_presets |

New statistics are delivered as new views — never as stored aggregates.

---

