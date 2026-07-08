## Prompt

drafta 05-Database/[08-Physical-Schema-Mapping.md](http://08-Physical-Schema-Mapping.md)

## Response

Excellent. This document is the final bridge before writing SQL migrations.

Up until now we have worked from **business concepts → logical model**.

This document answers:

> "How exactly does each logical entity translate into PostgreSQL implementation?"

It prevents a common problem where the ERD looks correct, but implementation choices become inconsistent:

- table ownership is unclear,
- shared keys are inconsistently applied,
- lookup tables are forgotten,
- migration order becomes messy,
- AI agents make different interpretations.

This document should be considered the **implementation blueprint**.

---

```markdown
# Physical Schema Mapping

> **Version:** 1.0.0
>
> This document maps the approved logical data model to the physical PostgreSQL implementation.
>
> It defines:
>
> - table ownership
> - PostgreSQL representation
> - primary keys
> - foreign keys
> - relationship implementation
> - migration ordering
>
> SQL migrations must be generated from this document.

---

# Purpose

The logical data model describes:
```

What exists?

```

The physical schema defines:

```

How PostgreSQL stores it.

```

The mapping must preserve:

- domain correctness
- historical integrity
- extensibility
- query performance

---

# PostgreSQL Standards

The database follows:

## Primary keys

```

UUIDv7

```

---

## Timestamps

Always:

```

TIMESTAMPTZ

```

---

## Naming

All identifiers follow:

```

snake_case

```

---

## Foreign keys

Use:

```

<entity>\_id

```

---

# Schema Organization

Initial implementation uses:

```

public

```

schema.

Future separation may introduce:

```

reference

template

runtime

analytics

```

when complexity justifies it.

---

# Layer Mapping

```

Reference Layer

↓

Template Layer

↓

Runtime Layer

↓

Analytics Layer

```

---

# Reference Layer Tables

---

# game_types

## Purpose

Defines available games.

---

## Table

```

game_types

```

---

## Columns

| Column | Type | Description |
|-|-|-|
| id | UUID | Primary key |
| implementation_key | TEXT | Stable system identifier |
| name | TEXT | Display name |
| description | TEXT | Explanation |
| is_published | BOOLEAN | Available in production |
| created_at | TIMESTAMPTZ | Creation time |
| updated_at | TIMESTAMPTZ | Last update |

---

## Constraints

Unique:

```

implementation_key

```

---

# game_features

## Purpose

Defines supported capabilities.

Examples:

- timed
- rounds
- opponents
- bots

---

# game_type_features

## Purpose

Many-to-many relationship.

---

Relationship:

```

game_types

N

|

N

game_features

```

---

Primary key:

```

(id)

```

or composite:

```

(game_type_id, feature_id)

```

---

Decision:

Use composite key.

Reason:

The relationship itself is the entity.

---

# game_statuses

## Purpose

Lifecycle states.

---

Examples:

```

ACTIVE

COMPLETED

ABANDONED

```

---

# ruleset_versions

## Purpose

Immutable rule definitions.

---

Important because:

```

Rules change.

History cannot.

```

---

Columns:

```

id

game_type_id

version_number

implementation_key

created_at

```

---

# Player Layer Tables

---

# players

## Purpose

Application-owned player profile.

Authentication remains external.

---

Columns:

```

id

display_name

created_at

updated_at

```

---

# player_settings

## Purpose

Stores preferences.

---

Relationship:

```

players

1

|

1

player_settings

```

---

Implementation:

Shared primary key.

```

id REFERENCES players(id)

```

---

# Template Layer Tables

---

# routine_templates

## Purpose

Reusable routines.

---

Columns:

```

id

player_id nullable

name

description

is_system_template

created_at

updated_at

```

---

## Ownership

System routines:

```

player_id = NULL

```

User routines:

```

player_id = user

```

---

# routine_steps

## Purpose

Ordered routine composition.

---

Columns:

```

id

routine_template_id

sequence_number

exercise_template_id

duration_type

duration_value

```

---

# exercise_templates

## Purpose

Reusable exercises.

---

Examples:

```

Singles accuracy

Double practice

Score training

```

---

# game_configurations

## Purpose

Base configuration snapshot.

---

This table contains shared information only.

---

Columns:

```

id

game_type_id

created_at

```

---

Game-specific configuration is stored separately.

---

# Game Specific Configuration Tables

---

# 501_configurations

Purpose:

Stores 501-specific rules.

Example:

```

legs

sets

double_out

```

---

Relationship:

```

exercise_configuration

1

|

1

501_configuration

```

---

Implementation:

Shared primary key.

---

# tuod_configurations

Stores:

```

starting_target

increase_amount

decrease_amount

difficulty

```

---

# singles_configurations

Stores:

```

direction

difficulty

mandatory_hits

```

---

# Runtime Layer Tables

---

# activities

## Purpose

Application usage lifecycle.

---

Columns:

```

id

player_id

status_id

started_at

completed_at

created_at

```

---

# exercise_sessions

## Purpose

Actual executed gameplay.

---

Columns:

```

id

activity_id

player_id

game_type_id

capture_mode_id

status_id

started_at

completed_at

created_at

```

---

# exercise_configurations

## Purpose

Immutable runtime snapshot.

---

Columns:

```

id

exercise_session_id

ruleset_version_id

configuration_json

created_at

```

---

## Reason for snapshot

Templates can change.

History cannot.

---

# participants

## Purpose

Session participants.

---

Columns:

```

id

exercise_session_id

participant_type

player_id nullable

display_name nullable

```

---

Examples:

Player:

```

participant_type = PLAYER

```

Guest:

```

participant_type = GUEST

```

Bot:

```

participant_type = DARTBOT

```

---

# exercise_stages

## Purpose

Represents logical game subdivisions.

---

Examples:

501:

```

leg

set

```

Routine:

```

exercise block

```

---

Columns:

```

id

exercise_session_id

sequence_number

stage_type

```

---

# turns

## Purpose

One visit to the oche.

---

Columns:

```

id

exercise_stage_id

sequence_number

player_participant_id

score

```

---

# darts

## Purpose

Atomic performance event.

---

Columns:

```

id

turn_id

dart_number

target_number

multiplier

score

result_type

created_at

````

---

# Relationship Summary

```mermaid
erDiagram

    GAME_TYPES ||--o{ RULESET_VERSIONS : owns

    GAME_TYPES ||--o{ GAME_TYPE_FEATURES : supports
    GAME_FEATURES ||--o{ GAME_TYPE_FEATURES : provides


    PLAYERS ||--|| PLAYER_SETTINGS : has

    PLAYERS ||--o{ ACTIVITIES : creates

    ACTIVITIES ||--o{ EXERCISE_SESSIONS : contains


    GAME_TYPES ||--o{ EXERCISE_SESSIONS : defines


    EXERCISE_SESSIONS ||--|| EXERCISE_CONFIGURATIONS : snapshots

    RULESET_VERSIONS ||--o{ EXERCISE_CONFIGURATIONS : defines


    EXERCISE_SESSIONS ||--o{ PARTICIPANTS : contains

    EXERCISE_SESSIONS ||--o{ EXERCISE_STAGES : contains

    EXERCISE_STAGES ||--o{ TURNS : contains

    TURNS ||--o{ DARTS : contains


    ROUTINE_TEMPLATES ||--o{ ROUTINE_STEPS : contains

    EXERCISE_TEMPLATES ||--o{ ROUTINE_STEPS : defines
````

---

# Migration Order

The migration sequence should be:

```
0001_extensions

↓

0002_reference_tables

↓

0003_players

↓

0004_game_definitions

↓

0005_templates

↓

0006_runtime_core

↓

0007_runtime_events

↓

0008_constraints

↓

0009_indexes

↓

0010_views

↓

0011_seed_reference_data
```

---

# Implementation Decisions

## UUIDv7 Everywhere

Reason:

- distributed generation
- ordering
- future scalability

---

## Shared Primary Keys

Used for:

- one-to-one relationships
- owned configuration extensions

Examples:

```
player_settings

501_configuration
```

---

## Composite Keys

Used where the relationship itself has no independent identity.

Example:

```
game_type_features
```

---

# Pre-SQL Validation Checklist

Before creating migrations:

- all entities have ownership
- all relationships are defined
- all foreign keys are known
- all historical dependencies are clear
- configuration snapshots exist
- game extensions are possible
- analytics can derive required metrics

---

# Final Principle

The physical schema is an implementation of the domain model.

The database should not force the application to become complicated.

The schema should make the correct behaviour the easiest behaviour.

````

---

## Self-review

I would rate this draft **9.6/10**.

This document successfully bridges the architecture into implementation, but before generating SQL I would perform one final technical review.

The main areas that deserve scrutiny:

### 1. Configuration snapshot storage

Currently:

```text
exercise_configurations
    |
    configuration_json

````

This is flexible, but we should decide whether this should instead be:

```text
exercise_configurations
    |
    configuration_snapshot tables

```

or a hybrid approach.

Because configuration affects analytics and replay, this deserves careful thought.

---

### 2. Stage abstraction

`exercise_stages` is powerful, but possibly too abstract.

We should verify whether:

```text
stage_type

```

can cleanly represent:

- 501 sets
- 501 legs
- routine blocks
- TUOD rounds
- timed exercises

without becoming a generic "everything table".

---

### 3. Dart entity completeness

Before SQL, we should finalize:

- how misses are stored
- how outside/inside is derived
- how left/right is captured
- whether coordinates are future-compatible

Because this determines the quality ceiling of analytics.

---

### 4. Missing analytical entities

Currently correct:

```
statistics are views

```

No statistics tables should exist initially.

---

The next step should be the **final database architecture freeze**:

```
05-Database/09-Pre-Implementation-Review.md

```

After that, we can confidently generate:

```
database/migrations/0001_extensions.sql

```

through the full PostgreSQL implementation.

---

## Prompt

draft 05-Database/[09-Pre-Implementation-Review.md](http://09-Pre-Implementation-Review.md)

Than, draft database/migrations/0001_extensions.sql as well

## Response

Good. This is the final gate before implementation.

I will split this into two parts:

1. `architecture/05-Database/09-Pre-Implementation-Review.md`
2. `database/migrations/0001_extensions.sql`

The first document freezes the architectural decisions. The second starts the actual implementation chain.

---

# `architecture/05-Database/09-Pre-Implementation-Review.md`

```markdown
# Pre-Implementation Database Review

> **Version:** 1.0.0
>
> This document represents the final validation step before PostgreSQL implementation begins.
>
> The purpose is to verify that the approved data model is internally consistent, scalable and ready to translate into migrations.

---

# Objective

Before creating database migrations, verify:

- domain completeness
- relational correctness
- historical integrity
- extensibility
- PostgreSQL compatibility

---

# Implementation Status
```

APPROVED

```

The database architecture is ready for physical implementation.

---

# Architecture Summary

The database follows:

```

Facts → Storage

Meaning → Views

Rules → Configuration

History → Immutable Runtime Data

```

---

# Confirmed Design Decisions

## Authentication Isolation

Decision:

The database does not manage authentication.

Authentication is provided externally through Neon Auth.

Stored locally:

```

player profile only

```

---

## Identifier Strategy

All entities use:

```

UUIDv7

```

Reason:

- globally unique
- sortable
- PostgreSQL friendly
- future distributed compatibility

---

## Timestamp Strategy

All timestamps use:

```

TIMESTAMPTZ

```

No exceptions.

---

# Data Layer Validation

## Reference Layer

Status:

```

APPROVED

```

Contains:

- game definitions
- features
- statuses
- ruleset versions

---

## Template Layer

Status:

```

APPROVED

```

Contains:

- reusable exercises
- routines
- configurations

---

## Runtime Layer

Status:

```

APPROVED

```

Contains:

- activities
- sessions
- stages
- turns
- darts

---

# Configuration Model Validation

## Decision

Use hybrid configuration.

---

Shared configuration:

```

exercise_configurations

```

contains:

- session configuration identity
- ruleset version

---

Game-specific extensions:

```

501_configurations

tuod_configurations

singles_configurations

```

---

Reason:

Avoid:

- one massive configuration table
- sparse columns
- game coupling

---

# Ruleset Versioning Validation

## Decision

Rulesets are immutable.

---

Example:

```

TUOD v1

TUOD v2

```

Both can coexist.

---

Historical sessions always reference:

```

the ruleset used at execution time

```

---

# Runtime Event Validation

## Decision

Darts are stored individually.

---

Reason:

Allows:

- accuracy analysis
- miss analysis
- recovery analysis
- advanced coaching metrics

---

# Capture Mode Validation

## Decision

The system supports multiple capture levels.

---

Example:

Recreational:

```

Turn score only

```

Training:

```

Individual darts

```

---

Important:

Missing dart-level data is valid.

---

# Activity Model Validation

## Decision

Keep:

```

activity

```

and:

```

exercise_session

```

separate.

---

Reason:

They represent different lifecycles.

Activity:

```

user interaction

```

Exercise session:

```

completed gameplay

```

---

# Stage Model Validation

## Decision

Keep stage abstraction.

---

Reason:

Supports:

501:

```

Match
|
Set
|
Leg

```

Training:

```

Routine
|
Exercise

```

---

Constraint:

Stage types must remain controlled.

No unrestricted custom stage creation.

---

# Analytics Validation

## Decision

No statistics tables initially.

---

Statistics are generated using:

```

views

```

---

Reason:

Prevents:

- duplicated data
- stale calculations
- migration complexity

---

# Indexing Validation

## Decision

Indexes follow access patterns.

Required indexes:

- foreign keys
- common player history queries
- session traversal
- analytics filtering

---

No speculative indexes.

---

# Migration Validation

Migration rules:

## One concern per migration

Example:

```

0003_players.sql

0004_game_types.sql

```

---

Never:

- mix unrelated tables
- mix data and schema changes

---

# Seed Data Validation

Reference data is inserted separately.

Examples:

```

game_statuses

game_features

game_types

```

---

Reason:

Schema migrations remain deterministic.

---

# Security Validation

Database permissions should eventually separate:

```

application_user

migration_user

```

---

Initial development may use a single role.

---

# Future Compatibility Review

The model supports:

## Multiple users

Already supported through:

```

player_id

```

---

## Teams

Future extension:

```

teams

team_members

```

---

## Online matches

Future extension:

```

matches

match_participants

```

---

## AI Coaching

Supported through:

```

darts

turns

sessions

```

---

# Remaining Decisions Before Production

These are implementation details, not architectural blockers:

- exact enum strategy
- exact check constraints
- retention policies
- backup strategy
- monitoring

---

# Final Approval

The schema is ready for PostgreSQL implementation.

Implementation may proceed.

---

# Final Principle

The database is not designed around today's UI.

It is designed around preserving the truth of every game played.

```

---

# `database/migrations/0001_extensions.sql`

This first migration only enables PostgreSQL capabilities.

No tables.

No data.

No application logic.

This keeps migrations deterministic and easy to debug.

```sql
-- ============================================================
-- Migration: 0001_extensions.sql
--
-- Purpose:
-- Enable required PostgreSQL extensions.
--
-- This migration contains no schema objects.
-- Extensions must exist before dependent objects are created.
--
-- ============================================================


BEGIN;


-- ------------------------------------------------------------
-- UUID generation support
--
-- PostgreSQL 18 includes native UUIDv7 support.
-- For compatibility across Neon PostgreSQL versions,
-- pgcrypto is enabled as a UUID utility extension.
--
-- ------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ------------------------------------------------------------
-- UUID generation and cryptographic utilities
--
-- Provides:
-- gen_random_uuid()
--
-- Used as fallback where UUIDv7 generation
-- is unavailable.
--
-- ------------------------------------------------------------


-- ------------------------------------------------------------
-- Query performance helpers
--
-- Provides:
-- - index usage statistics
-- - query analysis support
--
-- ------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_stat_statements;


COMMIT;

```

---

## Review of `0001_extensions.sql`

One important note before we continue:

I deliberately did **not** add:

```sql
CREATE EXTENSION "uuid-ossp";

```

because it is outdated for modern PostgreSQL usage.

Also, I did not add:

```sql
citext

```

because display names are explicitly **not unique** and do not require case-insensitive uniqueness.

---

One architectural point we need to revisit before `0002_reference_tables.sql`:

### UUIDv7 generation

Neon currently runs modern PostgreSQL versions, but we need to decide whether we want:

Option A:

```sql
id UUID PRIMARY KEY DEFAULT uuidv7()

```

(native PostgreSQL support)

or:

Option B:

Generate UUIDv7 in application code:

```typescript
crypto.randomUUIDv7();
```

and always insert IDs explicitly.

For a TypeScript application, I would lean toward **Option B** because:

- IDs exist before database insertion
- easier offline/session recovery
- easier frontend optimistic state
- better event-driven compatibility

This decision affects every migration, so it should be frozen before creating `0002_reference_tables.sql`.

---

## Prompt

Agreed, use the second, what would I need to update in the 0001_extensions.sql file? Than draft 0002_reference_tables.sql

## Response

Good decision. Using **application-generated UUIDv7 values** aligns well with the architecture we designed.

It also fits your current stack well:

- Astro + TypeScript already owns runtime state.
- You batch-submit completed sessions.
- You want resumable sessions after refresh.
- You may eventually support offline-first behaviour.

Generating IDs before persistence means your frontend state, API payloads, and database records can share the same identifiers.

---

## Update required for `0001_extensions.sql`

Because UUIDs are generated by the application, the database no longer needs UUID generation functionality.

Therefore:

### Remove

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

```

Reason:

`pgcrypto` was only included for:

```sql
gen_random_uuid()

```

which we will not use.

---

### Keep

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

```

Reason:

This is useful for production monitoring and query optimisation.

It helps answer:

- Which queries are slow?
- Which views are expensive?
- Which API endpoints cause database load?

---

The final `0001_extensions.sql` becomes:

```sql
-- ============================================================
-- Migration: 0001_extensions.sql
--
-- Purpose:
-- Enable PostgreSQL extensions required by the application.
--
-- UUID generation happens in the application layer.
-- IDs are generated using UUIDv7 before persistence.
--
-- ============================================================


BEGIN;


-- ------------------------------------------------------------
-- Query performance monitoring
--
-- Required for:
-- - query statistics
-- - performance analysis
-- - optimisation decisions
--
-- ------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_stat_statements;


COMMIT;

```

---

# Important implementation rule added

From now on:

Every insert must provide:

```sql
id UUID NOT NULL

```

The database does **not** generate IDs.

Example:

```sql
INSERT INTO players (
    id,
    display_name
)
VALUES (
    '0198f5d7-....',
    'The Power'
);

```

Generated by:

```typescript
crypto.randomUUID();
```

or a UUIDv7 library.

---

# Migration `0002_reference_tables.sql`

This migration creates the stable lookup/reference foundation.

It intentionally contains:

- no player data
- no runtime data
- no seeds

Only schema.

The seed data belongs later.

The dependency order is:

```
game_types
        |
        +-- ruleset_versions

game_features
        |
        +-- game_type_features

game_statuses

```

---

```sql
-- ============================================================
-- Migration: 0002_reference_tables.sql
--
-- Purpose:
-- Create stable reference layer tables.
--
-- Contains:
-- - game definitions
-- - feature definitions
-- - status definitions
-- - ruleset versioning
--
-- Does not contain seed data.
--
-- ============================================================


BEGIN;


-- ============================================================
-- game_types
--
-- Defines available dart games.
--
-- Examples:
-- - 501
-- - TUOD
-- - Singles Training
--
-- ============================================================

CREATE TABLE game_types (

    id UUID PRIMARY KEY,

    implementation_key TEXT NOT NULL,

    name TEXT NOT NULL,

    description TEXT,

    is_published BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL,

    updated_at TIMESTAMPTZ NOT NULL,


    CONSTRAINT uq_game_types_implementation_key
        UNIQUE (implementation_key)

);



COMMENT ON TABLE game_types IS
'Defines available dart game implementations.';



-- ============================================================
-- game_features
--
-- Defines capabilities supported by games.
--
-- Examples:
-- - timed_mode
-- - rounds_mode
-- - opponent_support
-- - bot_support
--
-- ============================================================

CREATE TABLE game_features (

    id UUID PRIMARY KEY,

    implementation_key TEXT NOT NULL,

    name TEXT NOT NULL,

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL,

    updated_at TIMESTAMPTZ NOT NULL,


    CONSTRAINT uq_game_features_implementation_key
        UNIQUE (implementation_key)

);



COMMENT ON TABLE game_features IS
'Defines reusable capabilities that games can support.';



-- ============================================================
-- game_type_features
--
-- Many-to-many relation between games and features.
--
-- ============================================================

CREATE TABLE game_type_features (

    game_type_id UUID NOT NULL,

    game_feature_id UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL,


    PRIMARY KEY (
        game_type_id,
        game_feature_id
    ),


    CONSTRAINT fk_game_type_features_game_type
        FOREIGN KEY (game_type_id)
        REFERENCES game_types(id)
        ON DELETE CASCADE,


    CONSTRAINT fk_game_type_features_feature
        FOREIGN KEY (game_feature_id)
        REFERENCES game_features(id)
        ON DELETE CASCADE

);



COMMENT ON TABLE game_type_features IS
'Defines which features are available for each game type.';



-- ============================================================
-- game_statuses
--
-- Generic lifecycle states.
--
-- Examples:
-- ACTIVE
-- COMPLETED
-- ABANDONED
--
-- ============================================================

CREATE TABLE game_statuses (

    id UUID PRIMARY KEY,

    implementation_key TEXT NOT NULL,

    name TEXT NOT NULL,

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL,


    CONSTRAINT uq_game_statuses_implementation_key
        UNIQUE (implementation_key)

);



COMMENT ON TABLE game_statuses IS
'Defines lifecycle states used by gameplay entities.';



-- ============================================================
-- ruleset_versions
--
-- Immutable game rule definitions.
--
-- Historical sessions reference the ruleset version
-- that was active at execution time.
--
-- ============================================================

CREATE TABLE ruleset_versions (

    id UUID PRIMARY KEY,


    game_type_id UUID NOT NULL,


    implementation_key TEXT NOT NULL,


    version_number INTEGER NOT NULL,


    description TEXT,


    created_at TIMESTAMPTZ NOT NULL,


    CONSTRAINT fk_ruleset_versions_game_type
        FOREIGN KEY (game_type_id)
        REFERENCES game_types(id)
        ON DELETE RESTRICT,


    CONSTRAINT uq_ruleset_versions_key
        UNIQUE (
            game_type_id,
            implementation_key
        ),


    CONSTRAINT uq_ruleset_versions_number
        UNIQUE (
            game_type_id,
            version_number
        )

);



COMMENT ON TABLE ruleset_versions IS
'Immutable versions of game rules used for historical replay.';



COMMIT;

```

---

# Review of `0002_reference_tables.sql`

## Strong decisions

✅ No database-generated IDs  
Matches UUIDv7 strategy.

✅ No seed data  
Keeps schema migrations deterministic.

✅ `implementation_key` everywhere  
Matches earlier architecture decisions.

Example:

```text
501
tuod
singles_training

```

can remain stable even if display names change.

---

## One thing to discuss before `0003_players.sql`

There is one remaining architectural decision:

### Should lookup tables use UUID primary keys?

Currently:

```sql
game_statuses.id UUID
game_features.id UUID

```

Alternative:

Use:

```sql
SMALLINT

```

for reference tables.

Example:

```
ACTIVE = 1
COMPLETED = 2

```

Arguments:

### UUID advantages:

- consistency
- easier external references
- no special handling

### SMALLINT advantages:

- smaller indexes
- faster joins
- simpler debugging

For a large-scale PostgreSQL system, I would often use:

- UUIDv7 for domain entities
- SMALLINT for immutable lookup enums

However, because this architecture is designed for AI maintainability and future expansion, UUID everywhere is defensible.

This is worth freezing before creating player/runtime tables because it affects the whole schema.

---
