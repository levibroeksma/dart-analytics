<!--
status: canonical
scope: database/views
read-when: adding or changing views
updated: 2026-09-21
-->

# Database View Strategy

> **Version:** 1.5.0
>
> This document defines the strategy and rules for PostgreSQL views.
>
> Views provide stable read models between the database layer and the API layer.
>
> They simplify data access while preserving the separation between stored facts and application behaviour.

---

# View Philosophy

The database contains two distinct concepts:

## Source Data

The authoritative stored facts.

Examples:

- players
- games
- sessions
- turns
- darts
- configurations

Stored in tables.

---

## Read Models

Optimized representations for retrieving information.

Examples:

- active sessions
- game replay data
- player statistics
- training progress

Provided through views.

---

The relationship is:

```

Tables

↓

Views

↓

API

↓

Frontend

```

---

# Purpose of Views

Views exist to:

- provide stable query contracts
- simplify complex joins
- hide internal database structure
- prevent API coupling to tables
- centralize read logic
- improve maintainability

The API should consume views whenever the required data spans multiple tables.

---

# Source of Truth Rule

Views are never the source of truth.

The hierarchy is:

```

Tables

↓

Views

↓

API responses

```

A view:

- does not own data
- does not define business state
- does not replace tables

Changes to views should never alter historical reality.

---

# View Naming Convention

Views use the prefix `v_<purpose>`.

Examples:

```
v_active_sessions
v_session_overview
v_game_replay
v_dart_analytics
v_routine_execution
```

The name should describe the returned data, not the underlying tables.

---

# Implemented Views (migrations 0009–0042)

| View | Category | Purpose |
| ---- | -------- | ------- |
| `v_active_sessions` | API Read Model | Resume interrupted games |
| `v_session_overview` | API Read Model | History list |
| `v_game_replay` | Replay | Chronological reconstruction |
| `v_dart_analytics` | Analytics | Intention-complete dart dataset, scoped to the session's owning participant (2026-08-21) |
| `v_routine_execution` | API Read Model | Ordered routine steps, carrying everything a step resolves from since `0036`; `player_id`, `routine_description` and `exercise_description` since `0038`; `game_ruleset_version_key` (LEFT JOIN, NULL for a non-game step) since `0040` — the game ruleset version a GAME step's template pins, so `training-session.service.ts` resolves the step's routine-eligibility hook from the view instead of a hardcoded ruleset (2026-09-19; 2026-09-20) |
| `v_exercise_template_catalog` | API Read Model | System exercise templates a routine step can be built from, with `has_default_configuration` marking one the builder must not offer (`0038`, 2026-09-19); `game_ruleset_version_key` (LEFT JOIN, NULL for a non-game template) since `0040` (2026-09-20) |
| `v_configuration_presets` | API Read Model | Preset discovery for game setup (2026-07-13) |
| `v_dart_locations` | Analytics | Dart landing coordinates + derived radius/angle for `VISUAL_BOARD` capture; miss margin lives outside SQL (2026-08-05); scoped to the session's owning participant (2026-08-21) |
| `v_player_settings` | API Read Model | Player default capture/input mode as `*_key`s; absent row means the service defaults apply (2026-08-08) |
| `v_player_profile` | API Read Model | Player display name + darts equipment (2026-08-15) |
| `v_x01_checkout_darts` | Analytics | Per-dart facts + stage tree + counted turn total + configuration snapshot for 501/TUOD/121 `VISUAL_BOARD` checkout accuracy, owning player only; remaining-before-dart is folded in the app, never in SQL (2026-09-19) |
| `v_player_visit_facts` | Analytics | One row per completed turn, every game type/capture mode, for career-wide turn-level statistics (2026-09-06) |
| `v_player_leg_facts` | Analytics | One row per complete-capture LEG stage, for best-leg/darts-per-leg style statistics (2026-09-06) |
| `v_training_schedules` | API Read Model | One row per weekly training schedule with its day count, filtered by `player_id`; a schedule with no days still lists (2026-09-20) |
| `v_training_schedule_days` | API Read Model | One row per (schedule, weekday) with the routine's name and `MINUTES` total, filtered by `player_id`; a missing weekday is a rest day, not a row (2026-09-20) |
| `v_training_completions` | API Read Model | One row per completed training activity with the routine snapshot it ran, filtered by `player_id` and `completed_at`; abandoned trainings are excluded (0042, 2026-09-22) |

Every view above that reaches `exercise_sessions.game_type_id` or
`exercise_templates.game_type_id` joins `game_types` with a `LEFT JOIN` from
migration `0033` on, so a session or template with no game bound to it appears
with a NULL `game_type_key` rather than vanishing. The same applies to the
other lookups `0028`/`0029` made nullable (`ruleset_versions`, `capture_modes`,
`input_modes`). The two exceptions are `v_configuration_presets` — whose
`configuration_templates.game_type_id` is still NOT NULL — and
`v_x01_checkout_darts` (migration `0039`, replacing `v_double_out_checkout_darts`),
which restricts itself to 501/TUOD/121 `VISUAL_BOARD` sessions in its own WHERE
clause. <!-- 2026-09-16; view renamed and widened 2026-09-19 -->

A view exists for a consumer, and the consumer reads it: a read path documented
as view-backed that selects a table directly is a defect in the view, not an
accepted exception. Migration `0036` closed the two that had accumulated —
`v_double_out_checkout_darts` gained the `starting_score` the statistics read
was fetching from `exercise_configurations` itself, and `v_routine_execution`
gained the exercise type, pinned ruleset version and configuration snapshots
that had left it with no consumer at all (D298, issues #342/#344). Projecting a
scalar out of a JSONB configuration snapshot is allowed and has been since
`0025`; it is the same class of work as a join onto a lookup table. <!-- 2026-09-17 -->

Per-view detail: `06-Database-Specification.md` Read Model Layer.

Future views (`v_player_statistics`, `v_player_dashboard`, etc.) are planned — not yet implemented.

The detailed statistics pages plan `v_stats_session_facts`, `v_stats_dart_facts` and thin `v_stats_<section>` views over them (dependency depth ≤ 2) — see `10-Statistics/00-Overview.md` §10 (D364). <!-- 2026-09-26 -->

---

# View Categories

Views are divided into three categories.

---

# 1. API Read Models

Purpose:

Provide application-facing data structures.

Examples:

```

v_active_sessions

v_session_overview

v_player_dashboard

```

Characteristics:

- optimized for API consumption
- stable structure
- hides relational complexity

---

# 2. Replay Views

Purpose:

Provide deterministic reconstruction of historical gameplay.

Examples:

```

v_game_replay

v_exercise_replay

```

Replay views combine:

- sessions
- stages
- turns
- darts
- configurations
- ruleset versions

A replay view must contain enough information to reconstruct the original event flow.

---

# 3. Analytics Views

Purpose:

Provide derived performance insights.

Examples:

```

v_player_accuracy

v_training_progress

v_game_statistics

```

Analytics views calculate metrics from stored facts.

They must not introduce new truth.

---

# Runtime Replay Rules

Gameplay replay is based on immutable events.

The replay hierarchy is:

```

Exercise Session

↓

Exercise Stage

↓

Turn

↓

Dart

```

A replay view should use:

- stored dart events
- stored configurations
- stored ruleset versions

It must not use:

- current templates
- current rulesets
- current user settings

---

Example:

Incorrect:

```

Replay

↓

Current 501 rules

```

Correct:

```

Replay

↓

501 Ruleset Version 3

```

---

# View Design Rules

Views should:

- have a clear purpose
- expose meaningful domain concepts
- avoid unnecessary columns
- avoid exposing internal implementation details

A view should answer:

> "What does the application need to know?"

not:

> "What tables exist?"

---

# Avoid Over-Generalized Views

Avoid creating one massive view:

```

v_everything

```

Containing:

- player data
- sessions
- darts
- settings
- statistics

Problems:

- difficult maintenance
- unnecessary joins
- poor performance
- unclear ownership

Prefer multiple focused views.

---

# View Column Naming

View columns follow the same naming conventions as tables.

Use:

```

snake_case

```

Examples:

```

player_id

game_type_key

completed_at

average_score

```

Avoid aliases that introduce frontend terminology.

A `*_key`/`*_name` column is nullable whenever the column it projects is: an
INNER JOIN onto a nullable FK silently deletes the row instead of returning a
NULL label, which is the one failure mode a read model must never have.
<!-- 2026-09-16 -->

`drizzle-kit introspect` types **every** view column nullable, regardless of
the view's own SQL — Postgres reports no `NOT NULL` on a view, so this holds
even for a column that can never actually be NULL. A repository reading a
view therefore narrows each column its row interface declares non-null with
`nonNull(value, "column_name")` (`app/src/repositories/row-helpers.ts`),
never a blanket `as <Interface>Row[]` over the whole select: the blanket form
silences every column's nullability at once — including a genuine mismatch,
which is how `day_count`'s `bigint`/`number` divergence (#538) went
unnoticed — where the per-column form still leaves the compiler checking
each field and throws at read time if a column the interface promises is
actually NULL. A column the interface itself declares nullable is left as
the raw select value, unwrapped. (2026-09-21, D348, #539)

**Read-model column standard (migration `0013`):** expose implementation keys as `<concept>_key`, human labels as `<concept>_name` only where a screen renders the label, and **do not expose internal lookup `*_id` columns**. Keep only entity UUIDs a client must address later (`session_id`, `routine_id`, `exercise_template_id`, `player_id`). See `01-Naming-Conventions.md` §"View Column Key And Label Naming". <!-- 2026-07-12 -->

---

# Business Logic in Views

Views may contain:

- joins
- filtering
- aggregation
- formatting

Views should not contain:

- workflow decisions
- user permissions
- game engine logic
- state transitions

Example:

Allowed:

```

Calculate average dart score

```

Not allowed:

```

Determine whether player won a leg

```

Business behaviour belongs in the API/application layer.

---

# Filtering Rules

Views should expose meaningful datasets.

Example:

Instead of:

```

v_sessions

```

prefer:

```

v_active_sessions

```

with:

```sql
WHERE completed_at IS NULL
```

when the purpose is specifically active sessions, with a filter on the ACTIVE status key — equivalent to `completed_at IS NULL` under the terminal-status invariant (terminal statuses always set `completed_at`). <!-- 2026-07-13 -->

---

# Security Rules

Views may be used to limit exposed data.

Examples:

The API may need:

```
player dashboard information
```

but not:

```
internal database metadata
```

Views can act as a controlled exposure layer.

---

# View Dependency Rules

Views should depend on:

- tables
- stable views

Avoid:

```
view A

↓

view B

↓

view C

↓

view D
```

Deep dependency chains become difficult to maintain.

Prefer:

```
Tables

↓

Focused views

↓

API
```

---

# Materialized Views

Materialized views store calculated results.

They should only be introduced when:

- calculations are expensive
- data changes less frequently
- refresh strategy is defined
- performance measurements justify them

Examples:

Potential candidates:

```
monthly_player_statistics

training_progress_summary
```

---

# Materialized View Rules

Every materialized view requires:

- refresh strategy
- ownership
- invalidation rules
- performance justification

Do not introduce materialized views as a replacement for indexing.

---

# View Migration Rules

Views are managed through migrations.

Example:

```
0009_views.sql
```

Changes require new migrations.

Do not manually modify views in production.

---

# Changing Existing Views

When changing a view:

Consider:

- API compatibility
- frontend impact
- existing consumers
- analytics dependencies

Breaking changes require:

1. New view version.

Example:

```
v_player_statistics_v2
```

2. Migration period.

3. Removal of old view after migration.

---

# Performance Rules

When a view is slow:

Investigate in order:

1. Query structure.
2. Missing indexes.
3. Excessive joins.
4. Unnecessary columns.
5. Materialization requirements.

Do not immediately create materialized views.

---

# View Testing

Every view should be tested for:

## Correctness

Does it return the expected domain information?

## Completeness

Does it contain required fields?

## Historical Accuracy

Does it use immutable runtime data?

## Performance

Does it perform acceptably with realistic data volumes?

---

# AI Agent View Rules

Before creating or modifying a view, an AI agent must:

1. Identify the consumer.
2. Determine whether a table or existing view already provides the data.
3. Define whether the view is:
   - API read model
   - replay model
   - analytics model

4. Avoid embedding business logic.
5. Document the purpose.
6. Verify performance impact.

---

# View Anti-Patterns

## Using Views as Tables

Bad:

```
Application writes directly to views
```

Views are read models.

---

## Duplicating Business Logic

Bad:

```
Complex game rules inside SQL views
```

Rules belong to the application/game engine.

---

## Replacing Data Modelling With Views

Bad:

```
Poor table design

↓

Huge view fixes everything
```

Views cannot compensate for incorrect domain modelling.

---

# Final Principle

Tables store reality.

Views present reality.

The API decides behaviour.

A good view simplifies access without hiding ownership, truth or domain boundaries.
