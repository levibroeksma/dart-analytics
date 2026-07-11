<!--
status: canonical
scope: database/read-model-layer
read-when: adding/changing views or read contracts
updated: 2026-07-11
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

Migration `0009` delivers the initial five views. Future analytics views are described under Future Expansion.

---

# v_active_sessions

## Category

API Read Model

## Purpose

Lists sessions available for resume.

Used by application startup and browser refresh recovery.

## Sources

- exercise_sessions
- game_types
- capture_modes
- input_modes
- game_statuses (filter: ACTIVE)

## Exposes

Session identity, player, game type (id + key + name), capture mode, input mode, ruleset version, start time.

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

Session identity, game labels, status, capture mode, start/completion times and a computed `duration_seconds`.

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
- darts
- dart_zones (intended and hit, LEFT JOIN)

## Exposes

Stage sequence and type, turn sequence, participant, dart number, intended target/zone, hit target/zone, score.

## Design Rationale

Ordering columns (stage sequence, turn sequence, dart number) let the consumer replay events chronologically.

Zone joins are LEFT JOINs because recreational capture may omit intention and result detail.

Replay depends only on runtime data — never on current templates or rulesets.

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

Player, game type, intended target/zone, hit target/zone, score, and a computed `exact_hit` flag (intended target and zone both match the hit).

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

Routine identity and name, step sequence, exercise identity and name, game type key, duration value and duration type key.

## Design Rationale

The frontend renders and executes a routine from this single view without touching template tables.

---

# Read Model Layer Summary

The initial read models cover the three core read paths:

| Path | View |
| ---- | ---- |
| Resume | v_active_sessions |
| History | v_session_overview, v_game_replay |
| Analytics | v_dart_analytics |
| Routine execution | v_routine_execution |

New statistics are delivered as new views — never as stored aggregates.

---

