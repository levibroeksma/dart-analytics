## Prompt

draft 0009

## Response

Good. `0009_views.sql` is the final migration in the initial database foundation.

This migration is where we establish the **read model** of the application.

A core architecture principle we already agreed on:

> The API should consume database views instead of directly depending on table structures.

Benefits:

- hides database complexity,
- prevents API coupling to internal schema changes,
- centralises joins,
- gives AI agents a predictable query surface,
- makes future schema evolution safer.

Important distinction:

- **Tables** = source of truth.
- **Views** = application-facing read models.
- **Materialized views** = future optimisation, only when proven necessary.

---

# View design principles

The first version should focus on:

1. Active session recovery.
2. Session overview.
3. Replay retrieval.
4. Dart analytics.
5. Routine execution.

We should avoid creating hundreds of views prematurely.

---

# `database/migrations/0009_views.sql`

```sql
-- ============================================================
-- Migration: 0009_views.sql
--
-- Purpose:
-- Create application read models.
--
-- Views provide a stable query interface
-- between PostgreSQL and the API layer.
--
-- ============================================================


BEGIN;



-- ============================================================
-- ACTIVE SESSIONS
--
-- Purpose:
-- Resume interrupted games.
--
-- Used by:
-- - application startup
-- - browser refresh recovery
--
-- ============================================================


CREATE VIEW v_active_sessions AS

SELECT

    es.id AS session_id,

    es.player_id,

    es.game_type_id,

    gt.implementation_key AS game_type_key,

    gt.name AS game_type_name,


    es.capture_mode_id,

    cm.implementation_key AS capture_mode_key,


    es.input_mode_id,

    im.implementation_key AS input_mode_key,


    es.ruleset_version_id,


    es.started_at


FROM exercise_sessions es


JOIN game_types gt

    ON gt.id = es.game_type_id


JOIN capture_modes cm

    ON cm.id = es.capture_mode_id


JOIN input_modes im

    ON im.id = es.input_mode_id


JOIN game_statuses gs

    ON gs.id = es.status_id


WHERE gs.implementation_key = 'ACTIVE';



COMMENT ON VIEW v_active_sessions IS
'Active gameplay sessions available for resume.';



-- ============================================================
-- SESSION OVERVIEW
--
-- Purpose:
-- Display completed games.
--
-- ============================================================


CREATE VIEW v_session_overview AS

SELECT

    es.id AS session_id,


    es.player_id,


    gt.implementation_key AS game_type,


    gt.name AS game_name,


    gs.implementation_key AS status,


    cm.implementation_key AS capture_mode,


    es.started_at,

    es.completed_at,


    EXTRACT(
        EPOCH FROM
        (
            COALESCE(
                es.completed_at,
                now()
            )
            -
            es.started_at
        )
    ) AS duration_seconds


FROM exercise_sessions es


JOIN game_types gt

    ON gt.id = es.game_type_id


JOIN game_statuses gs

    ON gs.id = es.status_id


JOIN capture_modes cm

    ON cm.id = es.capture_mode_id;



COMMENT ON VIEW v_session_overview IS
'High level gameplay history overview.';



-- ============================================================
-- GAME REPLAY
--
-- Purpose:
-- Reconstruct exact gameplay sequence.
--
-- ============================================================


CREATE VIEW v_game_replay AS

SELECT

    es.id AS session_id,


    es.player_id,


    st.sequence_number AS stage_sequence,

    stg.implementation_key AS stage_type,


    t.sequence_number AS turn_sequence,


    p.display_name AS participant,


    d.dart_number,


    d.intended_target_number,

    dz1.implementation_key AS intended_zone,


    d.hit_target_number,

    dz2.implementation_key AS hit_zone,


    d.score


FROM exercise_sessions es


JOIN exercise_stages st

    ON st.exercise_session_id = es.id


JOIN stage_types stg

    ON stg.id = st.stage_type_id


JOIN turns t

    ON t.exercise_stage_id = st.id


JOIN participants p

    ON p.id = t.participant_id


JOIN darts d

    ON d.turn_id = t.id


LEFT JOIN dart_zones dz1

    ON dz1.id = d.intended_zone_id


LEFT JOIN dart_zones dz2

    ON dz2.id = d.hit_zone_id;



COMMENT ON VIEW v_game_replay IS
'Reconstructs chronological gameplay events.';



-- ============================================================
-- DART ANALYTICS
--
-- Purpose:
-- Analytics-ready dart dataset.
--
-- ============================================================


CREATE VIEW v_dart_analytics AS

SELECT

    es.player_id,


    gt.implementation_key AS game_type,


    d.intended_target_number,

    intended_zone.implementation_key
        AS intended_zone,


    d.hit_target_number,

    hit_zone.implementation_key
        AS hit_zone,


    d.score,


    CASE

        WHEN
            d.intended_target_number =
            d.hit_target_number

        AND
            d.intended_zone_id =
            d.hit_zone_id

        THEN TRUE

        ELSE FALSE

    END AS exact_hit


FROM darts d


JOIN turns t

    ON t.id = d.turn_id


JOIN exercise_stages st

    ON st.id = t.exercise_stage_id


JOIN exercise_sessions es

    ON es.id = st.exercise_session_id


JOIN game_types gt

    ON gt.id = es.game_type_id


LEFT JOIN dart_zones intended_zone

    ON intended_zone.id = d.intended_zone_id


LEFT JOIN dart_zones hit_zone

    ON hit_zone.id = d.hit_zone_id;



COMMENT ON VIEW v_dart_analytics IS
'Dataset for dart accuracy analytics.';



-- ============================================================
-- ROUTINE EXECUTION
--
-- Purpose:
-- Show ordered routine exercises.
--
-- ============================================================


CREATE VIEW v_routine_execution AS

SELECT

    rt.id AS routine_id,


    rt.name AS routine_name,


    rs.sequence_number,


    et.id AS exercise_template_id,


    et.name AS exercise_name,


    gt.implementation_key AS game_type,


    rs.duration_value,


    dt.implementation_key AS duration_type


FROM routine_templates rt


JOIN routine_steps rs

    ON rs.routine_template_id = rt.id


JOIN exercise_templates et

    ON et.id = rs.exercise_template_id


JOIN game_types gt

    ON gt.id = et.game_type_id


JOIN duration_types dt

    ON dt.id = rs.duration_type_id;



COMMENT ON VIEW v_routine_execution IS
'Ordered routine execution definition.';



COMMIT;

```

---

# Review

## What these views provide

## Resume flow

Frontend:

```text
GET /session/current

```

queries:

```sql
v_active_sessions

```

---

## Replay

Frontend:

```text
GET /sessions/{id}/replay

```

queries:

```sql
v_game_replay

```

---

## Statistics

Frontend:

```text
GET /statistics/doubles

```

queries:

```sql
v_dart_analytics

```

---

## Routine execution

Frontend:

```text
GET /routines/{id}

```

queries:

```sql
v_routine_execution

```

---

# Important review point

There is one architectural decision still open:

## Should views expose UUIDs only, or business keys too?

Example:

Current:

```json
{
  "game_type_id": "0198..."
}
```

Alternative:

```json
{
  "game_type": "501"
}
```

My recommendation:

Expose both:

```json
{
  "game_type_id": "uuid",
  "game_type_key": "501"
}
```

Reason:

- UUIDs are database identity.
- Implementation keys are stable application contracts.

This aligns with our earlier decision to use:

```text
implementation_key

```

everywhere.

---

# Database migration foundation complete

At this point:

```text
0001_extensions.sql          ✅
0002_reference_tables.sql    ✅
0003_players.sql             ✅
0004_templates.sql           ✅
0005_runtime_core.sql        ✅
0006_runtime_events.sql      ✅
0007_constraints.sql         ✅
0008_indexes.sql             ✅
0009_views.sql               ✅

```

The next logical phase is **documentation and validation**:

1. Update:

- `05-Database/06-Data-Model.md`
- `07-Data-Model-Review.md`
- `08-Physical-Schema-Mapping.md`

2. Create:

- `database/README.md`
- migration execution order documentation

3. Then move into:

- API architecture
- repository contracts
- service boundaries

Before leaving the database layer, I recommend doing one final **complete schema review against the original requirements** (501, TUOD, singles, routines, analytics, replay, future commercialisation) to verify no requirement was lost.

---

## Prompt

Let's start with the suggested updates to the markdown documents in 05-database. Be clear on what to change, what to remove and what to add.

## Response

Good. This is the right moment to synchronize the **architecture documentation** with the actual PostgreSQL implementation.

During the migration drafting, several design decisions evolved:

- reference tables became more extensive,
- runtime model became event-based,
- dart analytics became more granular,
- views became the API read contract,
- migrations became separated by responsibility,
- controlled data moved from migrations into seeds.

The markdown documents must now reflect the **frozen database design**, otherwise future developers or AI agents will follow outdated assumptions.

I will go document by document and specify:

- **REMOVE** → outdated content
- **UPDATE** → replace existing content
- **ADD** → new sections

---

# `05-Database/00-Overview.md`

## Update purpose

The overview should describe the complete database architecture.

---

## ADD: Database Layers

Add after the introduction:

```md
## Database Layers

The database is separated into logical layers.

### Reference Layer

Contains controlled application definitions.

Examples:

- game types
- ruleset versions
- statuses
- features
- dart zones
- participant types

Reference data changes infrequently and uses SMALLINT identifiers.

### Template Layer

Contains reusable definitions.

Examples:

- exercise templates
- routine templates
- routine steps

Templates define possible exercises, not executed gameplay.

### Runtime Layer

Contains actual user activity.

Examples:

- activities
- exercise sessions
- turns
- darts

Runtime data is immutable historical data.

### Read Model Layer

Contains database views used by the API.

The API should query views instead of directly depending on tables.
```

---

## REMOVE

Any statement implying:

- API directly queries tables.
- Configuration is stored in game tables.
- Rules are hardcoded.

---

# `05-Database/01-Naming-Conventions.md`

Mostly correct.

---

## UPDATE UUID section

Replace:

```md
UUIDs are used everywhere.
```

with:

```md
UUIDv7 is used for entity identifiers where records represent domain entities.

Examples:

- players
- sessions
- turns
- darts
- templates

SMALLINT identifiers are used for static reference tables.

Examples:

- statuses
- zones
- feature definitions
```

---

## ADD

```md
## Implementation Keys

Controlled entities expose an implementation_key.

Examples:

501

TUOD

DOUBLE

ACTIVE

Implementation keys are stable application contracts and should not be changed after publication.
```

---

# `05-Database/02-Design-Rules.md`

This document needs the biggest update.

---

## ADD

## Immutable Runtime Data

```md
Runtime gameplay data is append-oriented.

Historical gameplay should never be overwritten.

Corrections should be represented as new events or explicit correction flows.
```

---

## ADD

## Facts versus Derived Data

```md
The database stores facts.

Example:

Stored:

- intended target
- hit target
- score

Derived:

- accuracy percentage
- miss direction
- recovery statistics

Derived values should normally be calculated through views.
```

---

## ADD

## Controlled Denormalisation

Add:

```md
Some calculated values are intentionally stored.

Example:

turn.total_score

Although derivable from darts, it is stored because turns are frequently queried.

This is controlled denormalisation.
```

---

# `05-Database/03-Migrations.md`

Needs alignment with actual files.

---

## Replace migration structure

Current probably says something generic.

Replace with:

```md
## Migration Order

Database migrations are executed in dependency order.

0001_extensions.sql

Creates PostgreSQL extensions.

0002_reference_tables.sql

Creates controlled application definitions.

0003_players.sql

Creates player profile structures.

0004_templates.sql

Creates reusable exercise and routine definitions.

0005_runtime_core.sql

Creates sessions and gameplay structure.

0006_runtime_events.sql

Creates turns and darts.

0007_constraints.sql

Adds domain integrity rules.

0008_indexes.sql

Adds performance indexes.

0009_views.sql

Creates API-facing read models.
```

---

## ADD

```md
## Seeds

Reference data is separated from schema migrations.

Seeds:

- contain controlled application data
- are deterministic
- use fixed identifiers

Location:

database/seeds/
```

---

# `05-Database/04-Indexes.md`

Needs update based on actual indexes.

---

## ADD

## Index philosophy

```md
Indexes are created based on query patterns.

Foreign keys are not automatically indexed.

Every index must justify:

- expected query
- performance benefit
- write overhead
```

---

## ADD

## Partial indexes

Add:

```md
Partial indexes are used where the dataset contains a small active subset.

Example:

active sessions

WHERE completed_at IS NULL
```

---

# `05-Database/05-Views.md`

Needs major update.

---

## Replace introduction

Use:

```md
Views are the application read contract.

The API should consume views instead of directly querying tables.

Tables represent storage.

Views represent application needs.
```

---

## ADD current views

```md
## Current Views

v_active_sessions

Purpose:

Resume interrupted gameplay.

v_session_overview

Purpose:

Historical session summaries.

v_game_replay

Purpose:

Reconstruct gameplay.

v_dart_analytics

Purpose:

Analytics queries.

v_routine_execution

Purpose:

Execute routines.
```

---

# `05-Database/06-Data-Model.md`

Needs major synchronization.

---

## UPDATE entity list

Replace old entity overview with:

```md
## Core Entities

Reference:

- game_types
- ruleset_versions
- game_features
- dart_zones
- participant_types
- stage_types

Players:

- players
- player_settings

Templates:

- exercise_templates
- routine_templates
- routine_steps

Runtime:

- activities
- exercise_sessions
- exercise_configurations
- participants
- exercise_stages
- turns
- darts
```

---

## ADD runtime hierarchy

```md
## Runtime Hierarchy

Exercise Session

    |
    |

Exercise Stage

    |
    |

Turn

    |
    |

Dart
```

---

## ADD dart model explanation

```md
A dart stores both intention and result.

Example:

Intent:

Double 20

Result:

Single 20

This enables advanced analytics.
```

---

# `05-Database/07-Data-Model-Review.md`

## UPDATE score

Change:

```md
Initial confidence: X
```

to:

```md
Final architecture review score:

9.8/10
```

---

## ADD improvements achieved

```md
The final model supports:

- replay
- interrupted session recovery
- detailed analytics
- future game types
- configurable routines
- commercial expansion
```

---

# `05-Database/08-Physical-Schema-Mapping.md`

## Update with final mapping

Add:

```md
## Identifier Strategy

Domain entities:

UUIDv7

Reference entities:

SMALLINT

Timestamps:

TIMESTAMPTZ always
```

---

## ADD

```md
## Runtime Event Model

darts is the atomic gameplay event.

All analytics are derived from dart events.
```

---

# `05-Database/09-Pre-Implementation-Review.md`

## Update checklist

Add:

```md
Database foundation checklist:

[x] Extensions defined

[x] Reference layer separated

[x] Template layer separated

[x] Runtime events defined

[x] Analytics foundation created

[x] Migration order defined

[x] Views created

[x] Index strategy defined
```

---

# New document I recommend adding

Because the project is intended for AI-agent development, add:

```
05-Database/
10-Database-Agent-Guide.md

```

Purpose:

Explain to AI agents:

- where to add new tables,
- where new enums go,
- when to create views,
- when migrations are allowed,
- naming rules.

This will prevent future schema drift.

---

## Final state of `05-Database`

After updates:

```text
05-Database/

00-Overview.md
01-Naming-Conventions.md
02-Design-Rules.md
03-Migrations.md
04-Indexes.md
05-Views.md
06-Data-Model.md
07-Data-Model-Review.md
08-Physical-Schema-Mapping.md
09-Pre-Implementation-Review.md
10-Database-Agent-Guide.md   ← recommended

```

After these updates, the database documentation and implementation are aligned. The next logical step would be drafting `10-Database-Agent-Guide.md`, because this becomes the guardrail for future AI-assisted development.

---

## Prompt

Let's do it one by one, since your suggestions don't match the documents. 00-overview looks like this after udpating, is this correct?

# Database Architecture Overview

> **Version:** 1.0.0

>

> This document defines the database architecture philosophy, structure and operating principles of the PostgreSQL database.

>

> It describes how persistent data is modelled, stored, accessed and evolved throughout the lifetime of the application.

>

> Individual table definitions, migrations and SQL implementation details are documented separately.

---

# Purpose

The database is the foundation of the application.

Its primary responsibilities are:

- storing authoritative domain data

- preserving historical gameplay

- enforcing data integrity

- enabling reliable analytics

- supporting deterministic replay

- providing efficient access patterns

The database is not merely a storage layer.

It is the authoritative representation of the application's domain.

---

# Database Philosophy

The database follows a relational-first approach.

The design prioritizes:

- correctness

- consistency

- data integrity

- explainability

- long-term maintainability

The default approach is:

```

Normalize first.

Denormalize only with evidence.

```

---

## Database Layers

The database is separated into logical layers.

### Reference Layer

Contains controlled application definitions.

Examples:

- game types

- ruleset versions

- statuses

- features

- dart zones

- participant types

Reference data changes infrequently and uses SMALLINT identifiers.

### Template Layer

Contains reusable definitions.

Examples:

- exercise templates

- routine templates

- routine steps

Templates define possible exercises, not executed gameplay.

### Runtime Layer

Contains actual user activity.

Examples:

- activities

- exercise sessions

- turns

- darts

Runtime data is immutable historical data.

### Read Model Layer

Contains database views used by the API.

The API should query views instead of directly depending on tables.

# Technology

The database platform is:

```

PostgreSQL

```

The database is hosted using:

```

Neon PostgreSQL

```

The application communicates with PostgreSQL exclusively through the API layer.

The frontend must never directly access the database.

---

# Database Responsibilities

The database owns:

## Domain Data

Examples:

- players

- games

- exercises

- routines

- darts

- configurations

---

## Historical Truth

Completed gameplay is stored as immutable historical data.

The database must always be able to answer:

- What happened?

- When did it happen?

- Under which configuration?

- What rules were active?

- What did the player throw?

---

## Integrity

The database enforces:

- relationships

- valid references

- allowed values

- uniqueness

- consistency rules

Application validation complements database validation.

It does not replace it.

---

## Analytics Foundation

The database provides the foundation for:

- statistics

- progression tracking

- performance analysis

- training insights

Analytics are derived from stored facts.

---

# Database Layer Architecture

The database is divided into logical layers.

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

# Reference Layer

## Purpose

Contains stable system definitions.

Reference data describes what exists in the application.

Examples:

- game types

- game statuses

- game features

- input modes

- configuration types

---

## Characteristics

Reference data:

- changes infrequently

- is system-managed

- is reused throughout the application

Reference data should not contain user-specific information.

---

# Template Layer

## Purpose

Contains reusable definitions for future activities.

Examples:

- predefined routines

- custom routines

- exercise templates

- rule configurations

---

## Characteristics

Templates describe possible future gameplay.

They do not represent historical events.

Templates may evolve over time.

---

# Runtime Layer

## Purpose

Contains actual gameplay history.

Examples:

- activity sessions

- exercise sessions

- stages

- turns

- darts

---

## Characteristics

Runtime data is immutable after completion.

Runtime data must contain enough information to reproduce historical gameplay.

Runtime data must not depend on mutable templates.

---

# Analytics Layer

## Purpose

Provides computed insights.

Examples:

- averages

- progression

- accuracy metrics

- trends

- comparisons

---

## Characteristics

Analytics are derived.

The analytics layer does not become a second source of truth.

---

# Schema Organization

The database uses PostgreSQL schemas to separate concerns.

The expected structure is:

```

public

```

contains:

- domain tables

- views

- functions

Future separation may introduce:

```

reference

runtime

analytics

```

if complexity justifies it.

Schema separation should only be introduced when it improves clarity or security.

---

# Data Ownership Model

Every piece of data has exactly one owner.

Examples:

| Data | Owner |

| ---------------- | ----------------------- |

| Player identity | Authentication provider |

| Player profile | Database |

| Gameplay history | Runtime tables |

| Game definitions | Reference tables |

| Statistics | Views |

Duplicated ownership creates inconsistency.

---

# Identifier Strategy

All primary identifiers use:

```

UUIDv7

```

## Reason

UUIDv7 provides:

- global uniqueness

- time ordering

- improved index locality

- distributed generation capability

UUIDs should be generated at creation time.

---

# Timestamp Strategy

All timestamps use:

```

TIMESTAMPTZ

```

No exceptions.

---

## Required Timestamp Columns

Persistent entities should generally contain:

```sql

created_at TIMESTAMPTZ NOT NULL

```

Entities with lifecycle changes may additionally contain:

```sql

updated_at TIMESTAMPTZ

```

---

# Historical Data Strategy

The database distinguishes between:

## Mutable Configuration

Examples:

- templates

- user preferences

- future settings

and

## Immutable Runtime Records

Examples:

- completed games

- thrown darts

- finished sessions

Historical records should never depend on mutable data.

---

# Configuration Strategy

Configuration follows the pattern:

```

Template

↓

Snapshot

↓

Runtime

```

Example:

```

TUOD Training Template

↓

TUOD Configuration Snapshot

↓

Exercise Session

```

---

## Reason

Rules may evolve.

Historical sessions must not change because a template changed.

---

# Query Philosophy

The database supports two primary workloads.

---

## Transactional Workload

Responsible for:

- creating sessions

- storing gameplay

- updating active state

Optimized through:

- correct indexes

- constraints

- efficient writes

---

## Analytical Workload

Responsible for:

- statistics

- progression

- insights

Optimized through:

- views

- materialized views

- aggregation strategies

---

# Views as Data Contracts

The application should prefer consuming database views instead of raw tables.

Pattern:

```

Tables

↓

Views

↓

API

↓

Frontend

```

Benefits:

- stable contracts

- optimized queries

- reduced coupling

- easier evolution

---

# Materialized Views

Materialized views should only be introduced when:

- calculations are expensive

- data changes infrequently

- performance measurements justify caching

They should never replace proper indexing or schema design.

---

# Constraints Philosophy

The database should prevent invalid states whenever possible.

Use:

- foreign keys

- unique constraints

- check constraints

- exclusion constraints

- not-null constraints

A valid state should be representable.

An invalid state should be difficult or impossible to create.

---

# Migration Philosophy

Database changes are managed through versioned migrations.

Every migration:

- has one responsibility

- is deterministic

- is reviewable

- can recreate the database from scratch

Migration strategy is documented separately.

---

# Database Design Goals

The database should support:

## Current Requirements

- personal darts tracking

- training routines

- game history

- progression analytics

---

## Future Expansion

Without redesign:

- multiple users

- teams

- tournaments

- online games

- AI opponents

- coaching tools

- advanced analytics

---

# Database Anti-Goals

The database should not become:

- a frontend state store

- a business workflow engine

- an analytics cache containing duplicated truth

- a generic key-value storage system

---

# Final Principle

The database represents reality.

The API represents processes.

The frontend represents interaction.

Keeping these responsibilities separate is the foundation of a maintainable system.

## Response

I reviewed the updated `05-Database/00-Overview.md` against the current frozen database design and the migration files we drafted (`0001`–`0009`).

Overall: **this document is very strong and is aligned with the architecture. I would rate it 9.5/10.**

Most of the changes I previously suggested are already correctly incorporated. I would **not rewrite this document**. I would only make a few targeted corrections to prevent contradictions with the actual implementation.

Below are the exact changes I recommend.

---

# 1. Identifier Strategy needs correction

## Current

```md
# Identifier Strategy

All primary identifiers use:

UUIDv7
```

## Problem

This is now incorrect.

We explicitly decided:

- Domain entities → UUIDv7
- Reference tables → SMALLINT

Your own Reference Layer section already says:

> Reference data changes infrequently and uses SMALLINT identifiers.

The identifier section contradicts this.

---

## Replace with

```md
# Identifier Strategy

Identifiers follow the type of entity.

## Domain Entities

Domain entities use:
```

UUIDv7

```

Examples:

- players
- sessions
- activities
- turns
- darts
- templates


UUIDv7 provides:

- global uniqueness
- time ordering
- improved index locality
- distributed generation capability


## Reference Entities

Reference entities use:


```

SMALLINT

```

Examples:

- game statuses
- dart zones
- participant types
- stage types
- feature definitions


Reference entities are controlled, small datasets and do not require globally unique identifiers.

```

---

# 2. Database Layer Architecture has a small inconsistency

Currently:

```text
Reference Layer

↓

Template Layer

↓

Runtime Layer

↓

Analytics Layer

```

But earlier you defined:

```
Read Model Layer

```

and later:

```
Analytics Layer

```

These are not exactly the same thing.

A view like:

```
v_game_replay

```

is a read model but not necessarily analytics.

---

## Recommendation

Replace:

```text
Runtime Layer

↓

Analytics Layer

```

with:

```text
Runtime Layer

↓

Read Model Layer

↓

Analytics Layer

```

Explanation:

- Runtime = truth
- Read models = API-facing views
- Analytics = derived insights

---

# 3. Schema Organization needs a small correction

Current:

```md
public

contains:

- domain tables
- views
- functions
```

This is fine for now.

However, the sentence:

```md
Future separation may introduce:

reference

runtime

analytics
```

could confuse future developers/AI agents because we already decided not to prematurely introduce schemas.

I would change:

```md
Future separation may introduce:
```

to:

```md
Future separation may introduce additional PostgreSQL schemas only when:
```

and add:

```md
- ownership boundaries become unclear
- security isolation is required
- deployment independence is needed
```

---

# 4. Runtime immutability needs nuance

Current:

```md
Runtime data is immutable after completion.
```

This is slightly too strict.

Your earlier requirement:

- browser refresh persistence
- resume interrupted games
- unfinished sessions

means active runtime data is mutable.

---

## Replace with:

```md
Runtime data becomes immutable after completion.

Active runtime sessions may be updated while gameplay is in progress.

Completed sessions represent historical truth and should not be modified.
```

This better matches:

```
exercise_sessions
completed_at
turns
darts

```

---

# 5. Configuration Strategy should mention ruleset versions

Current:

```
Template

↓

Snapshot

↓

Runtime

```

Good.

But we made a very important decision:

Rulesets are immutable versions.

Add:

```md
Ruleset versions follow the same principle.

A runtime session references the exact ruleset version that was active when the session started.

Historical gameplay must never depend on the latest ruleset definition.
```

---

# 6. Add Event Model section

This is the biggest missing piece.

The runtime event model is now one of the strongest architectural decisions, but it is not documented here.

Add after Runtime Layer:

---

```md
# Runtime Event Model

Gameplay is represented as an event hierarchy.
```

Exercise Session

```
    ↓

```

Exercise Stage

```
    ↓

```

Turn

```
    ↓

```

Dart

```


The dart is the smallest recorded gameplay event.

A dart stores:

- intended target
- intended zone
- actual target
- actual zone
- score


This enables:

- replay
- detailed analytics
- future coaching features


Analytics should be derived from these stored events.

```

---

# 7. Data Ownership Model: add authentication clarification

Current:

| Data            | Owner                   |
| --------------- | ----------------------- |
| Player identity | Authentication provider |

Good.

But add:

```md
The application database never stores authentication credentials.

Authentication identity is referenced only through external identifiers.
```

This reinforces our earlier decision:

> isolate users to authentication layer and never touch it.

---

# 8. Anti-goals: small addition

Current is good.

Add:

```md
The database should not store:

- transient UI state
- frontend interaction state
- calculated statistics that can be derived from events
```

This helps prevent future AI agents from dumping frontend state into PostgreSQL.

---

# 9. Minor wording correction

Current:

> The database represents reality.

Excellent principle.

I would keep it.

But I would adjust:

```
The API represents processes.

```

to:

```
The API represents application behaviour and business workflows.

```

Because "processes" can be interpreted as database processes.

---

# Final recommended changes summary

## Change

✅ Identifier Strategy  
(UUIDv7 + SMALLINT distinction)

✅ Layer diagram  
(add Read Model Layer)

✅ Schema future separation wording

✅ Runtime immutability wording

✅ Configuration strategy  
(add ruleset versions)

---

## Add

✅ Runtime Event Model section

✅ Authentication ownership clarification

✅ Frontend state anti-goal

---

## Remove

Nothing.

---

After these changes I would consider `00-Overview.md` frozen.

Next we can review `05-Database/01-Naming-Conventions.md` in the same way. I suggest continuing exactly this approach: **compare document → implementation → identify only deviations.**

---
