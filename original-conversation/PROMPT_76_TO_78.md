## Prompt

Repeat for the 03 file with complete re-draft

## Response

The next file is `05-Database/03-Migrations.md`.

I have rewritten it completely to align with the current migration structure:

- numbered single-responsibility migrations
- schema before data
- reference data through seeds
- deterministic rebuilds
- immutable migration history
- AI-agent execution rules
- separation between migrations, seeds and documentation

Replace the existing file completely with:

```md
# Database Migration Strategy

> **Version:** 1.0.0
>
> This document defines the migration strategy and operating principles for evolving the PostgreSQL database.
>
> Database changes must be predictable, reviewable and reproducible throughout the lifetime of the application.

---

# Purpose

Migrations are the controlled mechanism for changing the database structure.

They ensure:

- consistent environments
- reproducible database creation
- traceable schema evolution
- safe collaboration
- predictable deployments

The database must always be rebuildable from:
```

Empty database

↓

Migrations

↓

Seeds

↓

Ready application database

```

---

# Migration Principles

Every migration must follow these principles:

- one responsibility per migration
- deterministic execution
- explicit ordering
- reviewable changes
- no hidden side effects

A migration should answer:

> "What database capability does this migration introduce?"

---

# Migration Ownership

Database migrations are the source of truth for:

- tables
- columns
- constraints
- indexes
- views
- database functions
- extensions

Migrations are not the source of truth for:

- runtime data
- user data
- temporary data

---

# Migration Structure

The migration directory follows:

```

database/

├── migrations/

│ ├── 0001_extensions.sql
│ ├── 0002_reference_tables.sql
│ ├── 0003_players.sql
│ ├── 0004_templates.sql
│ ├── 0005_runtime_core.sql
│ ├── 0006_runtime_events.sql
│ ├── 0007_constraints.sql
│ ├── 0008_indexes.sql
│ └── 0009_views.sql

└── seeds/

```
└── 0001_reference_data.sql
```

```

---

# Migration Naming

Migration files use:

```

<number>\_<description>.sql

```

Examples:

```

0001_extensions.sql

0006_runtime_events.sql

0009_views.sql

```

Rules:

- numbers are sequential
- names describe responsibility
- files are never renamed after execution
- previous migrations are never rewritten

---

# Migration Execution Order

Migrations execute in dependency order.

Current order:

---

## 0001_extensions.sql

Purpose:

Enable required PostgreSQL extensions.

Examples:

- UUID generation support
- database utilities

---

## 0002_reference_tables.sql

Purpose:

Create controlled application definitions.

Examples:

- game types
- statuses
- features
- dart zones
- participant types
- stage types
- duration types

Reference tables use:

```

SMALLINT identifiers

```

Reference data itself is inserted through seeds.

---

## 0003_players.sql

Purpose:

Create player-related structures.

Examples:

- player profiles
- player settings

Authentication remains external.

The database does not store authentication credentials.

---

## 0004_templates.sql

Purpose:

Create reusable definitions.

Examples:

- exercise templates
- routine templates
- routine steps

Templates describe possible future gameplay.

They do not represent historical execution.

---

## 0005_runtime_core.sql

Purpose:

Create runtime session structures.

Examples:

- activities
- exercise sessions
- configurations
- participants
- stages

This defines active and historical gameplay containers.

---

## 0006_runtime_events.sql

Purpose:

Create gameplay event storage.

Examples:

- turns
- darts

This is the foundation for:

- replay
- analytics
- progression tracking

The dart is the smallest gameplay event.

---

## 0007_constraints.sql

Purpose:

Add integrity rules.

Examples:

- check constraints
- unique constraints
- domain validation

Constraints ensure invalid states cannot be stored.

---

## 0008_indexes.sql

Purpose:

Add performance optimization.

Indexes are based on:

- query patterns
- expected workload
- measured performance

Indexes should not be created automatically for every column.

---

## 0009_views.sql

Purpose:

Create application-facing read models.

Views provide stable query contracts for the API.

Examples:

- active sessions
- replay data
- analytics datasets

---

# Schema Changes

Schema changes must be introduced through migrations.

Examples:

Adding a column:

```

new migration
↓
ALTER TABLE
↓
constraint update
↓
index update if required

````

Never manually modify production databases.

---

# Migration Atomicity

Migrations should use transactions where possible.

Preferred:

```sql
BEGIN;

-- changes

COMMIT;
````

If a migration fails:

- changes should rollback
- database should remain consistent

---

# Migration Size

Migrations should be small and focused.

Preferred:

Good:

```
0007_add_dart_zone_constraint.sql
```

Avoid:

```
0007_complete_database_restructure.sql
```

Large migrations are difficult to:

- review
- debug
- rollback

---

# Changing Existing Tables

When modifying an existing table:

Do not:

- edit the original migration
- rewrite history
- remove existing columns without migration planning

Instead:

Create a new migration.

Example:

Existing:

```
0006_runtime_events.sql
```

New change:

```
0010_add_dart_accuracy_fields.sql
```

---

# Data Migrations

Schema migrations and data migrations should be separated when possible.

Example:

Avoid:

```
ALTER TABLE players ADD COLUMN nickname;

UPDATE every player record;

```

inside one migration unless tightly coupled.

Prefer:

```
0010_add_nickname_column.sql

0011_migrate_existing_nicknames.sql
```

---

# Reference Data Management

Reference data is managed through seeds.

Examples:

- game statuses
- dart zones
- participant types

Location:

```
database/seeds/
```

Reference seeds must be:

- deterministic
- idempotent
- environment independent

Example:

```sql
INSERT INTO dart_zones (...)
VALUES (...)
ON CONFLICT DO NOTHING;
```

---

# What Belongs in Seeds

Allowed:

- static definitions
- lookup values
- system configuration

Examples:

```
DOUBLE

TREBLE

ACTIVE

COMPLETED
```

---

# What Does Not Belong in Seeds

Never store:

- users
- games
- sessions
- test data
- runtime history

---

# Migration Testing

Before applying migrations:

Validate:

- clean database creation
- migration order
- seed execution
- constraints
- indexes
- views

The complete flow should work:

```
CREATE DATABASE

↓

RUN ALL MIGRATIONS

↓

RUN SEEDS

↓

START APPLICATION
```

---

# Migration Review Checklist

Every migration review should verify:

## Purpose

- Does the migration have one clear responsibility?

## Ownership

- Does the new data have a clear owner?

## Integrity

- Are constraints required?

## Performance

- Are indexes justified?

## API Impact

- Do views or contracts require changes?

## Historical Impact

- Could existing data become invalid?

---

# AI Agent Migration Rules

AI agents modifying the database must:

1. Inspect existing migrations before creating changes.
2. Never modify executed migrations.
3. Create new numbered migrations.
4. Follow naming conventions.
5. Separate schema and seed changes.
6. Add constraints deliberately.
7. Add indexes only with query justification.
8. Update related documentation.

---

# Migration Anti-Patterns

Avoid:

## Editing Previous Migrations

Bad:

```
Modify 0005_runtime_core.sql after deployment
```

Good:

```
Create 0010_runtime_update.sql
```

---

## Mixing Responsibilities

Bad:

```
Create tables

+

Insert users

+

Create indexes
```

Good:

Separate responsibilities.

---

## Manual Database Changes

Bad:

```
Direct production SQL changes
```

Good:

```
Migration

↓

Review

↓

Deployment
```

---

# Final Principle

Migrations are the historical record of database evolution.

They must be treated as permanent architectural documentation.

A future developer or AI agent should be able to understand how the database evolved by reading the migration history alone.

```

This replaces the previous document and is consistent with the actual migration set we have created (`0001` through `0009`).
```

---

## Prompt

do the same for the next file that needs updating

## Response

The next file in order is `05-Database/04-Indexes.md`.

I have rewritten it completely and aligned it with the current database architecture:

- indexes are driven by access patterns, not assumptions
- UUIDv7 primary keys already provide natural ordering/locality
- foreign keys are not automatically indexed
- partial indexes are used for lifecycle states
- runtime event querying is optimized
- views are backed by appropriate indexes
- AI agents have explicit indexing rules

Replace the existing file completely with:

```md
# Database Index Strategy

> **Version:** 1.0.0
>
> This document defines the indexing strategy for the PostgreSQL database.
>
> Indexes exist to support known access patterns while maintaining a healthy balance between read performance and write overhead.
>
> Indexes are an optimization mechanism, not a replacement for good data modelling.

---

# Index Philosophy

The default approach is:
```

Design the query patterns first.

Add indexes based on evidence.

```

Indexes improve:

- query performance
- sorting
- filtering
- joins

Indexes also introduce:

- additional storage usage
- slower writes
- maintenance overhead

Every index must have a clear purpose.

---

# Primary Key Indexes

Every primary key automatically receives a PostgreSQL index.

Domain entities use:

```

UUIDv7

````

UUIDv7 provides:

- global uniqueness
- chronological ordering
- improved B-tree locality compared to random UUIDs

No additional ordering indexes should be created on primary keys unless query analysis justifies it.

Example:

```sql
id UUID PRIMARY KEY
````

automatically creates:

```text
table_name_pkey
```

---

# Foreign Key Index Rules

Foreign keys do not automatically receive indexes in PostgreSQL.

However, foreign keys are frequently queried.

An index should be added when the relationship is used for:

- filtering
- joining
- ordering
- deleting related records
- retrieving child collections

Example:

Frequently queried:

```sql
SELECT *
FROM darts
WHERE turn_id = ?
```

Requires:

```sql
CREATE INDEX idx_darts_turn_id
ON darts(turn_id);
```

---

# Composite Index Rules

Composite indexes should follow the query pattern.

Column order matters.

PostgreSQL can efficiently use:

```sql
(first_column, second_column)
```

for:

```sql
WHERE first_column = ?
```

and:

```sql
WHERE first_column = ?
AND second_column = ?
```

but generally not:

```sql
WHERE second_column = ?
```

alone.

---

# Naming Convention

Indexes follow:

```
idx_<table>_<columns>
```

Examples:

```text
idx_darts_turn_id

idx_sessions_player_created_at

idx_turns_stage_sequence
```

Partial indexes describe their condition:

```text
idx_sessions_active
```

---

# Runtime Layer Index Strategy

Runtime tables represent gameplay history.

The most common access patterns are:

- retrieve active sessions
- replay completed games
- retrieve player history
- calculate statistics
- fetch turns and darts

---

# Activities

Common queries:

```sql
Find player activities ordered by newest first
```

Recommended:

```sql
CREATE INDEX idx_activities_player_created_at
ON activities(player_id, created_at DESC);
```

Purpose:

- player history
- activity overview screens

---

# Exercise Sessions

Common queries:

```sql
Find active sessions for a player
```

Recommended partial index:

```sql
CREATE INDEX idx_exercise_sessions_active
ON exercise_sessions(player_id, started_at DESC)
WHERE completed_at IS NULL;
```

Purpose:

- resume interrupted sessions
- restore browser state

Partial index is preferred because active sessions are a small subset.

---

Common query:

```sql
Retrieve completed sessions for analysis
```

Recommended:

```sql
CREATE INDEX idx_exercise_sessions_player_completed
ON exercise_sessions(player_id, completed_at DESC);
```

---

# Turns

Common queries:

```sql
Retrieve turns in order for a session
```

Recommended:

```sql
CREATE INDEX idx_turns_stage_sequence
ON turns(stage_id, sequence_number);
```

Purpose:

- replay
- rendering game history

---

# Darts

The dart table is the most important event table.

Common queries:

```sql
Retrieve all darts in a turn
```

Recommended:

```sql
CREATE INDEX idx_darts_turn_sequence
ON darts(turn_id, sequence_number);
```

Purpose:

- replay
- turn reconstruction

---

Common analytics queries:

```sql
Retrieve darts by player
```

Recommended only if required by workload:

```sql
CREATE INDEX idx_darts_player_created
ON darts(player_id, created_at);
```

Do not add this automatically.

Statistics should initially be derived through joins.

---

# Reference Layer Index Strategy

Reference tables are small.

Most tables require only:

- primary key index
- unique implementation_key index

Example:

```sql
CREATE UNIQUE INDEX uq_game_types_implementation_key
ON game_types(implementation_key);
```

No additional indexes should normally be required.

---

# Implementation Key Indexes

All published reference definitions require:

```sql
UNIQUE
```

on:

```sql
implementation_key
```

Reason:

Implementation keys are application contracts.

Example:

```sql
game_types
-------------
id
implementation_key
name
```

Index:

```text
uq_game_types_implementation_key
```

---

# Template Layer Index Strategy

Templates are queried by:

- owner
- visibility
- publication status
- game type

---

Example:

User templates:

```sql
CREATE INDEX idx_routine_templates_player
ON routine_templates(player_id);
```

---

Published templates:

```sql
CREATE INDEX idx_routine_templates_published
ON routine_templates(game_type_id)
WHERE is_published = true;
```

---

# Partial Index Strategy

Partial indexes should be used for lifecycle states.

Good candidates:

- active sessions
- published templates
- incomplete games

Example:

```sql
WHERE completed_at IS NULL
```

Benefits:

- smaller index
- faster lookup
- reduced maintenance

---

Avoid partial indexes when:

- most rows match the condition
- the condition changes frequently
- the query does not use the condition

---

# Unique Index Strategy

Unique indexes enforce business rules.

Examples:

Implementation keys:

```sql
implementation_key UNIQUE
```

User-specific defaults:

```sql
(player_id, game_type_id)
```

if only one default configuration is allowed.

---

# Indexes and Views

Views do not store data.

Indexes belong to underlying tables.

A view performance problem should first be solved by:

1. Reviewing query structure.
2. Reviewing underlying indexes.
3. Adding indexes based on actual execution plans.

Do not create indexes specifically "for a view".

---

# JSONB Index Rules

JSONB indexes should only be added when JSON fields are queried frequently.

Example:

```sql
configuration @> '{"difficulty":"easy"}'
```

may justify:

```sql
GIN index
```

However:

Do not index every JSONB column.

Prefer relational columns for frequently queried values.

---

# Analytics Index Strategy

Analytics workloads may require additional indexes.

Examples:

- player progression queries
- historical comparisons
- aggregation filters

These should be introduced after:

- measuring query performance
- identifying bottlenecks
- confirming the query pattern

---

# Index Review Process

Before adding an index, answer:

## 1. What query does this support?

Example:

```
Resume active session for player
```

---

## 2. How frequently is this query executed?

High-frequency queries justify indexes sooner.

---

## 3. What is the write impact?

Every insert/update/delete must maintain indexes.

---

## 4. Could query restructuring solve the problem?

An unnecessary index should not hide inefficient queries.

---

# Index Anti-Patterns

## Index Every Foreign Key

Bad:

```
Every FK automatically gets an index
```

Reason:

Creates unnecessary write overhead.

---

## Duplicate Indexes

Bad:

```
(player_id)

(player_id, created_at)
```

when the second already supports the first.

---

## Index Low Selectivity Columns

Avoid standalone indexes on:

```text
is_active

status_id

boolean flags
```

unless query patterns justify them.

---

## Index Without Measurement

Bad:

```
Add index because it might be faster
```

Good:

```
Identify query

↓

Measure

↓

Add index

↓

Validate improvement
```

---

# AI Agent Index Rules

Before creating an index, an AI agent must:

1. Identify the exact query pattern.
2. Check existing indexes.
3. Confirm that the index does not duplicate another index.
4. Evaluate write impact.
5. Add migration documentation explaining the purpose.

An index without a documented purpose should not be created.

---

# Final Principle

Indexes optimize access to stored truth.

They should support the application's real usage patterns without compromising data integrity or maintainability.

Good indexing is deliberate, measurable and continuously reviewed.

```

This file is now aligned with the architecture and provides enough guidance for both developers and AI agents to safely extend the database without accumulating unnecessary indexes.
```

---

## Prompt

Do this also for the 05 views file

## Response

The next file is `05-Database/05-Views.md`.

I have rewritten it completely and aligned it with the frozen architecture:

- views as API-facing read contracts
- tables remain the source of truth
- runtime events remain immutable facts
- views do not contain business logic
- replay/statistics/read models are separated
- materialized views are introduced only with evidence
- AI agents have rules for creating and changing views

Replace the existing file completely with:

```md
# Database View Strategy

> **Version:** 1.0.0
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

Views use:

```

v\_<purpose>

```

Examples:

```

v_active_sessions

v_game_replay

v_player_statistics

```

The name should describe the returned data, not the underlying tables.

Avoid:

```

v_player_turn_join_dart_session

```

because implementation details leak into the API contract.

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

````

with:

```sql
WHERE completed_at IS NULL
````

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

```

This version now matches the architectural direction we have established and provides the missing guidance for future API development and AI-assisted database changes.
```
