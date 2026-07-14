<!--
status: canonical
scope: database/design-rules
read-when: schema design decisions
updated: 2026-07-11
-->

# Database Design Rules

> **Version:** 1.1.0
>
> This document defines the mandatory design rules for PostgreSQL database development.
>
> These rules ensure consistency, maintainability and predictable evolution of the database architecture.
>
> All database changes must comply with these principles.

---

# Core Principle

The database represents reality.

The database is responsible for storing:

- authoritative domain data
- historical events
- relationships
- constraints
- persistent configuration

The database is not responsible for:

- frontend state
- temporary application state
- workflow orchestration
- business process execution

Responsibility boundaries:

```

Database

```

↓

```

API

```

↓

```

Frontend

```

The database stores facts.

The API applies behaviour.

The frontend manages interaction.

---

# Relational First Design

The default database design approach is:

```

Normalize first.

Denormalize only with evidence.

```

Normalization is preferred because it provides:

- data consistency
- clear ownership
- reduced duplication
- easier maintenance

Denormalisation is allowed only when:

- query performance requires it
- the duplicated value has a clear owner
- consistency can be guaranteed

---

# Single Source of Truth

Every piece of information must have exactly one authoritative owner.

Examples:

| Data                    | Owner                   |
| ----------------------- | ----------------------- |
| Authentication identity | Authentication provider |
| Player profile          | Database                |
| Game definitions        | Reference tables        |
| Gameplay events         | Runtime tables          |
| Statistics              | Derived views           |

Duplicating ownership creates inconsistency.

---

# Entity Design Rules

## Tables Represent Domain Concepts

Tables must represent meaningful domain entities.

Good examples:

```

players

exercise_sessions

turns

darts

```

Avoid tables that represent implementation details:

```

frontend_states

temporary_objects

ui_cache

```

---

# Primary Key Rules

Domain entities use UUIDv7 (application-generated).

Examples: players, activities, exercise sessions, turns, darts, templates, game types, ruleset versions, configuration templates.

Controlled lookup tables use SMALLINT with explicit seeded ids.

Examples: statuses, dart zones, participant types, stage types, capture modes, input modes, duration types.

---

# Foreign Key Rules

Relationships must always be represented using foreign keys.

Do not store relationships as:

- text values
- duplicated identifiers
- JSON references

Example:

Preferred:

```sql
player_id UUID NOT NULL
```

Avoid:

```sql
player_name TEXT
```

Foreign keys protect data integrity.

---

# Reference Data Rules

Controlled lookup tables describe finite application concepts.

Examples: statuses, dart zones, participant types, stage types, capture modes, input modes, duration types.

Lookup tables use SMALLINT identifiers with explicit seeded ids.

Domain-level reference entities (`game_types`, `ruleset_versions`) use UUIDv7 — they are not lookup tables.

All reference data is managed through migrations and seeds.

---

# Implementation Key Rules

Implementation keys are stable application contracts.

Examples:

```
501

TUOD

ACTIVE

DOUBLE

INNER_BULL
```

Rules:

- implementation keys are unique
- implementation keys must not change after publication
- display names may change
- APIs should prefer implementation keys over database identifiers

Example:

Database:

```
id = 5

implementation_key = DOUBLE
```

The application should depend on:

```
DOUBLE
```

not:

```
5
```

---

# Runtime Data Rules

Runtime data represents actual user activity.

Examples:

- sessions
- stages
- turns
- darts

Runtime data must preserve historical truth.

---

## Active Runtime Data

Active gameplay may be updated.

Examples:

- current session state
- unfinished turns
- temporary progress

---

## Completed Runtime Data

Completed gameplay is immutable.

After completion:

- do not overwrite events
- do not modify historical results
- do not change referenced rules

Corrections should be represented explicitly.

---

# Runtime Event Model

Gameplay follows an event hierarchy:

```
Exercise Session

        ↓

Exercise Stage

        ↓

Turn

        ↓

Dart
```

The dart is the smallest gameplay event.

A dart stores facts:

- intended target (`intended_target_number` + `intended_zone_id`)
- hit target (`hit_target_number` + `hit_zone_id`)
- score

The database should store what happened.

Interpretation belongs to derived queries.

---

# Facts Versus Derived Data

The database stores facts.

Examples:

Stored:

```
intended_zone = DOUBLE

hit_zone = SINGLE

score = 20
```

Derived:

```
double_accuracy = 43%

miss_direction = outside

average_checkout_percentage
```

Derived values should normally be calculated through:

- views
- queries
- analytical processes

Do not store calculated values unless there is a proven performance reason.

---

# Controlled Denormalisation

Some duplication is intentionally allowed.

Example:

A turn stores:

```
total_score
```

Although it can be calculated from darts.

Reason:

- turns are frequently queried
- score retrieval is common
- recalculation would add unnecessary overhead

This is controlled denormalisation.

Every denormalised value must document:

- source of truth
- update responsibility
- reason for duplication

---

# Configuration Rules

Configuration follows:

```
Template

↓

Snapshot

↓

Runtime
```

Templates define reusable possibilities.

Snapshots capture the configuration used during execution.

Runtime records reference the snapshot.

---

## Historical Stability Rule

Historical gameplay must never depend on mutable configuration.

Example:

Incorrect:

```
Finished Game

    ↓

Current TUOD Ruleset
```

Correct:

```
Finished Game

    ↓

TUOD Ruleset Version 3
```

Rulesets are immutable after publication.

Changes create new versions.

---

# Ruleset Design Rules

Rulesets:

- belong to game types
- are versioned
- are immutable after publication
- define allowed configuration options

Never modify a published ruleset.

Instead:

```
Ruleset v1

↓

Ruleset v2
```

Historical sessions continue referencing v1.

---

# JSONB Usage Rules

JSONB is allowed for flexible configuration.

Examples:

```
exercise_configurations.configuration
configuration_templates.configuration
```

JSONB should be used for:

- variable configuration
- extensible metadata
- future options

JSONB should not replace relational modelling.

Do not store:

- relationships
- core domain entities
- frequently queried fields

inside JSON.

---

# View Rules

Views are the preferred read interface for the API.

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

Views should:

- simplify complex queries
- hide internal schema complexity
- provide stable contracts

The API should avoid directly depending on table structures.

---

# Index Rules

Indexes must be created based on query patterns.

Do not automatically index:

- every foreign key
- every column
- every searchable field

Every index must justify:

- expected query
- performance improvement
- write overhead

---

# Constraint Rules

The database should prevent invalid states whenever possible.

Use:

- primary keys
- foreign keys
- unique constraints
- check constraints
- not-null constraints

Application validation complements database validation.

It does not replace database integrity.

---

# Migration Rules

Every migration must:

- have one responsibility
- be deterministic
- be reversible where practical
- be reviewable
- follow naming conventions

Avoid:

- large migrations containing unrelated changes
- mixing schema changes and data changes without reason
- modifying previous migrations after deployment

---

# Seed Rules

Seeds contain controlled reference data.

Seeds must:

- use stable identifiers
- be deterministic
- be environment independent

Examples:

```
dart_zones

game_statuses

duration_types
```

Seeds should not contain:

- user data
- runtime data
- test sessions

---

# Naming Rules

All database objects must follow:

- lowercase
- snake_case
- descriptive terminology

Avoid:

- abbreviations
- generic names
- implementation-specific terminology

See:

```
01-Naming-Conventions.md
```

for detailed rules.

---

# Schema Evolution Rules

Before adding a new table ask:

1. Is this a real domain concept?
2. Does it have a clear owner?
3. Is it persistent data?
4. Can it be derived instead?
5. Does an existing entity already represent this?

Avoid adding tables to solve temporary problems.

---

# AI Development Rules

AI-generated database changes must follow the same standards as human-created changes.

Before creating or modifying database structures, the AI agent must:

1. Review existing entities.
2. Check ownership boundaries.
3. Determine whether the data is a fact or derived value.
4. Determine whether a table, view or reference entry is appropriate.
5. Create migrations instead of modifying production structures directly.

---

# Final Principle

A good database design makes invalid states difficult to create and valid states easy to understand.

Every table, column, constraint and relationship must have a clear purpose.

The database should remain understandable years after its initial creation.
