<!--
status: canonical
scope: database/philosophy
read-when: database philosophy and operating model
updated: 2026-07-11
-->

# Database Architecture Overview

> **Version:** 1.2.0
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

# Database Layers

The database is separated into five logical layers.

See `06-Database-Specification.md` for per-entity detail.

---

## Reference Layer

Controlled application definitions.

Examples: game types, ruleset versions, statuses, features, dart zones, participant types, stage types, capture modes, input modes, duration types.

Lookup tables use SMALLINT identifiers with explicit seeded ids. Domain-level reference entities (`game_types`, `ruleset_versions`) use UUIDv7.

---

## Player Layer

Application-owned player data. Authentication is external (Neon Auth).

Examples: players, player_settings.

---

## Template Layer

Reusable definitions — possible future gameplay, never historical execution.

Examples: exercise templates, routine templates, routine steps, configuration templates.

Templates may evolve. Runtime copies values at session start; no runtime table references a template.

---

## Runtime Layer

Actual user activity and historical truth.

Examples: activities, exercise sessions, exercise configurations, participants, exercise stages, turns, darts.

Active sessions are mutable during play. Completed sessions are immutable.

---

## Read Model Layer

PostgreSQL views consumed by the API.

Examples: `v_active_sessions`, `v_session_overview`, `v_game_replay`, `v_dart_analytics`, `v_routine_execution`.

Analytics (averages, checkout %, progression) are derived views — never a separate source of truth. Future analytics views extend this layer; see `05-Views.md`.

---

# Technology

The database platform is:

```
PostgreSQL
```

The database is hosted using:

```
Neon PostgreSQL
```

Neon integration topology, branch policy, and tooling workflow are documented in `11-Neon-Integration.md`.

The application communicates with PostgreSQL exclusively through the API layer.

The frontend must never directly access the database.

---

# Database Responsibilities

The database owns:

---

## Domain Data

Examples:

- players
- games
- exercises
- routines
- configurations
- darts

---

## Historical Truth

Completed gameplay is stored as immutable historical data.

The database must always be able to answer:

- What happened?
- When did it happen?
- Under which configuration?
- What rules were active?
- What did the player throw?

Historical records must contain enough information to reproduce gameplay without relying on mutable templates or definitions.

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

```
Reference Layer

↓

Player Layer

↓

Template Layer

↓

Runtime Layer

↓

Read Model Layer
```

Analytics are derived views within the Read Model Layer — not a separate storage layer.

---

# Runtime Event Model

Gameplay is represented as an event hierarchy.

```
Exercise Session
    ↓
Exercise Stage
    ↓
Turn
    ↓
Dart
```

The dart is the smallest recorded gameplay event.

A dart stores:

- intended target
- intended dart zone
- actual target
- actual dart zone
- score

This enables:

- deterministic replay
- detailed analytics
- future coaching features
- performance analysis

Analytics should be derived from these stored events.

---

# Schema Organization

The database currently uses:

```
public
```

The public schema contains:

- domain tables
- reference tables
- views
- database functions

Future separation into additional PostgreSQL schemas should only be introduced when it improves architecture.

Examples:

- ownership boundaries become unclear
- security isolation is required
- deployment independence is required

Schema separation should not be introduced prematurely.

---

# Data Ownership Model

Every piece of data has exactly one owner.

Examples:

| Data                    | Owner                   |
| ----------------------- | ----------------------- |
| Authentication identity | Authentication provider |
| Player profile          | Database                |
| Gameplay history        | Runtime tables          |
| Game definitions        | Reference tables        |
| Statistics              | Views                   |

The application database never stores authentication credentials.

Authentication identity is referenced only through external identifiers.

Duplicated ownership creates inconsistency.

---

# Identifier Strategy

Identifiers follow the type of entity.

---

## Domain Entities

Domain entities use:

```
UUIDv7
```

Examples:

- players
- activities
- exercise sessions
- turns
- darts
- templates

UUIDv7 provides:

- global uniqueness
- time ordering
- improved index locality
- distributed generation capability

UUIDs should be generated at creation time.

---

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

and:

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

## Ruleset Versioning

Rulesets follow the same principle.

A runtime session references the exact ruleset version that was active when the session started.

Rulesets are immutable after publication.

Historical gameplay must never depend on the latest ruleset definition.

A ruleset change creates a new version instead of modifying an existing one.

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
- materialized views when justified
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
- replay functionality

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

The database should not store:

- transient UI state
- frontend interaction state
- calculated statistics that can be derived from stored events

---

# Final Principle

The database represents reality.

The API represents application behaviour and business workflows.

The frontend represents interaction.

Keeping these responsibilities separate is the foundation of a maintainable system.
