<!--
status: canonical
scope: database/views/general
read-when: adding or changing a career-wide (cross-game) statistic view
updated: 2026-09-06
-->

# General Views

> Career-wide, cross-game views. See `00-Overview.md` for view philosophy,
> categories, naming, and anti-patterns — this file only documents the views
> themselves. Design: `docs/superpowers/specs/2026-09-06-general-statistics-views-design.md`.
>
> These views expose row-level facts only. No application code consumes
> them yet — the stat-card computations (approximation rules, exclusions,
> aggregation) are separate work, designed elsewhere.

---

# v_player_visit_facts

## Category

Analytics View

## Purpose

One row per completed turn, every game type and capture mode, for
career-wide turn-level statistics.

## Sources

- turns → participants, exercise_stages → exercise_sessions → game_types, stage_types
- exercise_configurations (LEFT JOIN, for the configured `max_darts_per_turn`)
- darts (LEFT JOIN, for the real dart count)

## Exposes

`session_id`, `player_id`, `game_type_key`, `stage_id`, `stage_type_key`, turn
`sequence_number` (as `turn_sequence`), `total_score`, `completed_at`,
`dart_count` (real count of dart rows, 0 when none exist), and
`configured_max_darts_per_turn` (the ruleset's configured value for the
session, from the JSONB configuration snapshot). Scoped to the session's
OWNING player (`p.player_id = es.player_id`, mirroring `v_dart_analytics`).
Only completed turns are included.

## Design Rationale

`dart_count` and `configured_max_darts_per_turn` are exposed as raw facts,
not combined in SQL, so any future application read layer decides its own
approximation strategy (e.g. real count where present, else the configured
max) — the view never fabricates a dart count it doesn't actually have.

---

# v_player_leg_facts

## Category

Analytics View

## Purpose

One row per `LEG`-type stage, for best-leg/darts-per-leg style statistics.
Only X01 games (501/121/TUOD) ever create a `LEG` stage.

## Sources

- turns → participants, exercise_stages → exercise_sessions → game_types, stage_types (filtered to `LEG`)
- darts (LEFT JOIN, for the real dart count per turn)

## Exposes

`session_id`, `player_id`, `game_type_key`, `stage_id`, and
`total_darts_in_leg` (the owning player's real dart count summed across the
leg's turns). Scoped to the session's OWNING player. A leg is included only
when every one of that player's turns in it has at least one real dart row.

## Design Rationale

A statistic built on this view needs an exact count — approximating a
`QUICK_SCORE` leg's dart total the way `v_player_visit_facts` does would
fabricate a number that looks exact but isn't (a checkout or bust can
resolve on any dart). The view narrows its own population instead, the
same precedent as `v_dart_analytics`'s "both intended target and zone
present" filter.
