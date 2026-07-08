# Database View Strategy

> **Version:** 1.1.0
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

# Implemented Views (migration 0009)

| View | Category | Purpose |
| ---- | -------- | ------- |
| `v_active_sessions` | API Read Model | Resume interrupted games |
| `v_session_overview` | API Read Model | History list |
| `v_game_replay` | Replay | Chronological reconstruction |
| `v_dart_analytics` | Analytics | Intention-complete dart dataset |
| `v_routine_execution` | API Read Model | Ordered routine steps |

Per-view detail: `06-Database-Specification.md` Read Model Layer.

Future views (`v_player_statistics`, `v_player_dashboard`, etc.) are planned — not yet implemented.

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

when the purpose is specifically active sessions.

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
