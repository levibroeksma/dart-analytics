<!--
status: historical
scope: database/design-gate
read-when: decision archaeology only
updated: 2026-07-11
-->

# Pre-Implementation Database Review

> **Version:** 1.0.1
>
> **Status: HISTORICAL RECORD.** This review (verdict: APPROVED) was the gate before writing migrations. It is preserved as-is; the canonical, current description of the database is `06-Database-Specification.md`.
>
> This document represents the final validation step before PostgreSQL implementation begins.
>
> The purpose is to verify that the approved data model is internally consistent, scalable and ready to translate into migrations.

---

# Superseded Decisions

The following details evolved after this review:

| This review | Final implementation |
| ----------- | -------------------- |
| "All entities use UUIDv7" | Hybrid identifier strategy: UUIDv7 for domain entities, SMALLINT with explicit seeded ids for lookup tables |
| Dart model without zones | `dart_zones` reference table and intention + result columns (migration 0006) |
| Constraints and indexes unplanned | Delivered in `0007_constraints`, `0008_indexes`, `0011_ordering_and_uniqueness` |
| Configuration presets undecided | `configuration_templates` (migration 0010) |

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
