## Prompt

now draft the final architecture document: [04-Architecture-Patterns.md](http://04-Architecture-Patterns.md)

## Response

Agreed. This is the final document in the **foundation layer** of the architecture documentation.

The purpose of `04-Architecture-Patterns.md` is slightly different from the previous documents:

- `01-Principles.md` defines **what we believe**.
- `02-System-Architecture.md` defines **how the system is structured**.
- `03-Engineering-Workflow.md` defines **how changes are introduced**.
- `04-Architecture-Patterns.md` defines **how recurring problems should be solved**.

This document should prevent every developer or AI agent from inventing a new solution for a problem that has already been solved.

It becomes the project's **pattern catalogue**.

---

```markdown

```

# Architecture Patterns

> **Version:** 1.0.0
>
> This document defines the approved architectural patterns used throughout the project.
>
> These patterns provide consistent solutions for recurring design problems.
>
> Contributors should prefer existing patterns over introducing new approaches.
>
> If a new pattern is required, it should be reviewed and documented before adoption.

---

# Purpose

As the system grows, similar problems will appear repeatedly.

Without established patterns, different parts of the application may solve the same problem in different ways.

This creates:

- inconsistent architecture
- duplicated logic
- increased maintenance costs
- unpredictable behaviour

This document establishes reusable patterns to maintain architectural consistency.

---

# Pattern Selection Principles

When selecting an implementation approach, prefer solutions that maximize:

1. Correctness
2. Simplicity
3. Consistency
4. Maintainability
5. Extensibility
6. Performance

This order should guide architectural decisions.

---

# Pattern 1 — Single Responsibility

## Principle

Every component has exactly one primary responsibility.

A component should have one reason to change.

---

## Application

Applies to:

- database tables
- API endpoints
- services
- repositories
- frontend components
- documentation

---

## Example

Good:

```

UserController

Responsible for:

- user-related API requests

```

Bad:

```

UserController

Responsible for:

- users
- statistics
- notifications
- exports
- authentication

```

---

## Rule

When a component gains unrelated responsibilities, split it.

---

# Pattern 2 — Database as Source of Truth

## Principle

Persistent domain data has exactly one authoritative owner.

That owner is PostgreSQL.

---

## Application

The database owns:

- gameplay history
- configuration snapshots
- relationships
- constraints
- historical correctness

The API and frontend consume this data.

---

## Rule

Never duplicate persistent truth in another layer.

---

# Pattern 3 — Immutable Runtime Data

## Principle

Completed gameplay represents historical events and must never be modified.

---

## Application

Runtime entities:

- activity
- exercise session
- stage
- turn
- dart

become historical records.

---

## Rule

Corrections should be represented as new records.

Never rewrite history.

---

# Pattern 4 — Configuration Snapshot

## Principle

Templates describe future behaviour.

Runtime sessions preserve historical behaviour.

---

## Pattern

```

Template

↓

Configuration Snapshot

↓

Runtime Session

```

---

## Application

Example:

A TUOD training routine changes in the future.

Existing sessions must still know exactly which rules were used.

Therefore:

Templates are copied into immutable session configurations.

---

## Rule

Runtime data must never depend on mutable templates.

---

# Pattern 5 — Typed Configuration

## Principle

Configuration should be strongly modelled.

Avoid generic key-value configuration for domain behaviour.

---

## Avoid

```

configuration

key

value

```

---

## Prefer

```

exercise_configuration

↓

501_configuration

↓

tuod_configuration

```

---

## Reason

Typed configuration provides:

- database constraints
- better validation
- clearer queries
- safer migrations

---

# Pattern 6 — Repository Pattern

## Principle

Database access should be isolated behind repositories.

---

## Structure

```

Controller

↓

Service

↓

Repository

↓

Database

```

---

## Responsibilities

### Controller

Handles:

- HTTP communication
- request parsing

---

### Service

Handles:

- business workflows
- orchestration

---

### Repository

Handles:

- database communication
- SQL queries

---

## Rule

Business logic should not exist inside SQL queries or controllers.

---

# Pattern 7 — Views as Read Contracts

## Principle

The frontend should consume purpose-built read models instead of raw tables.

---

## Pattern

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

## Benefits

- stable API contracts
- optimized queries
- easier analytics
- reduced coupling

---

## Rule

Do not expose internal table structures directly.

---

# Pattern 8 — Derived Analytics

## Principle

Store facts.

Calculate insights.

---

## Example

Store:

```

dart thrown
target
score
timestamp

```

Calculate:

```

checkout percentage

average score

double accuracy

progression trend

```

---

## Rule

Never store values that can reliably be derived unless there is a proven performance reason.

---

# Pattern 9 — Migration Isolation

## Principle

Every database migration has exactly one responsibility.

---

## Example

Good:

```

040_turns.sql

```

Contains:

- turns table
- turn constraints

---

Bad:

```

040_everything.sql

```

Contains:

- tables
- indexes
- views
- seed data

---

## Rule

Small migrations are easier to debug, review and rollback.

---

# Pattern 10 — Explicit Domain Modeling

## Principle

Domain concepts should have explicit representation.

---

## Avoid

Combining unrelated concepts into generic tables.

---

## Prefer

Explicit entities:

```

Game Type

Rule Set

Configuration

Session

Stage

Turn

Dart

```

---

## Reason

Explicit models improve:

- readability
- validation
- extensibility

---

# Pattern 11 — Lookup Tables Over Hardcoded Values

## Principle

Values that represent domain concepts should be data-driven.

---

## Prefer

```

game_statuses

id

implementation_key

name

```

---

## Avoid

Hardcoded strings throughout the application.

---

## Benefits

- extensibility
- localization
- safer changes

---

# Pattern 12 — Stable Identifiers

## Principle

Internal identifiers and external identifiers have different purposes.

---

## Internal

Use:

```

UUIDv7

```

Purpose:

- database relations
- uniqueness
- indexing

---

## External

Use:

```

implementation_key
public_code

```

Purpose:

- API references
- documentation
- URLs

---

# Pattern 13 — Eventual Event Architecture

## Principle

The current architecture should allow future event-driven capabilities.

---

## Current Model

```

Exercise

↓

Turns

↓

Darts

```

---

## Future Extension

```

Exercise

↓

Events

↓

State Projection

```

---

## Rule

Do not implement event sourcing prematurely.

Preserve the ability to introduce it later.

---

# Pattern 14 — Feature Expansion Pattern

## Principle

New functionality should extend existing patterns.

---

## Adding a New Game Type

Required steps:

1. Add game type reference data.
2. Add supported features.
3. Add ruleset.
4. Add configuration model.
5. Add runtime interpretation.
6. Add statistics views.
7. Update documentation.

---

## Rule

A new game should not require redesigning existing games.

---

# Pattern 15 — Architecture Review Matrix

Every significant change must be evaluated against these quality attributes.

| Attribute      | Question                                        |
| -------------- | ----------------------------------------------- |
| Responsibility | Does each component have one clear purpose?     |
| Consistency    | Does this follow existing patterns?             |
| Replayability  | Can historical sessions still be reconstructed? |
| Integrity      | Is historical data protected?                   |
| Normalization  | Is duplication avoided?                         |
| Extensibility  | Can future requirements be added safely?        |
| Coupling       | Are dependencies minimized?                     |
| Cohesion       | Does functionality belong together?             |
| Performance    | Is optimization justified by evidence?          |
| Simplicity     | Is this the simplest sufficient solution?       |

---

# Pattern Adoption Process

A new pattern may only be introduced when:

1. Existing patterns cannot solve the problem.
2. The benefits are clearly explained.
3. Alternatives have been considered.
4. The decision is documented.
5. An ADR is created when appropriate.

---

# Anti-Patterns

The following approaches are discouraged.

---

## Generic Everything Tables

Example:

```

entity_properties

key

value

```

Reason:

- weak constraints
- poor discoverability
- difficult analytics

---

## Business Logic Duplication

Example:

Frontend calculates statistics.

API recalculates statistics.

Database calculates statistics.

Reason:

Creates inconsistent results.

---

## Direct Table Exposure

Example:

Frontend directly depends on table structure.

Reason:

Creates unnecessary coupling.

---

## Premature Abstraction

Example:

Creating complex frameworks before requirements exist.

Reason:

Adds complexity without value.

---

## Mutable Historical Data

Example:

Editing completed games.

Reason:

Breaks replayability and statistics.

---

# Final Principle

Patterns exist to reduce unnecessary decisions.

The goal is not to force every situation into a predefined solution.

The goal is to ensure that common problems are solved consistently, while preserving the flexibility required for future growth.

```

---

## Foundation Architecture Review

With this document complete, the foundation layer is now drafted:

```

architecture/

00-README.md ✅
01-Principles.md ✅
02-System-Architecture.md ✅
03-Engineering-Workflow.md ✅
04-Architecture-Patterns.md ✅

```

At this point I would **not yet refine them**. Your earlier decision was correct: finish the complete documentation set first, then perform a holistic review.

The next phase should move into:

```

05-Database/

```

Starting with:

```

05-Database/00-Overview.md

````

That document will translate the abstract architecture into the database-specific philosophy:

- PostgreSQL conventions
- schema ownership
- UUIDv7 policy
- TIMESTAMPTZ policy
- normalization rules
- migration philosophy
- table ownership
- views vs materialized views
- indexing philosophy

Only after that do we start creating the actual SQL migration files.

---

---

## Prompt

Ok, great, let's start with 05-Database/[00-Overview.md](http://00-Overview.md)

## Response

Excellent. We are now moving from **general architecture** into the first technology-specific layer.

The purpose of `05-Database/00-Overview.md` is not to document individual tables yet. That comes later.

This document answers:

> "What is the philosophy, structure, and operating model of our PostgreSQL database?"

It should allow a developer or AI agent to understand **how to think about the database** before touching SQL.

The database documentation hierarchy will become:

```text
05-Database/

00-Overview.md              ← We are here
01-Naming-Conventions.md
02-Design-Rules.md
03-Migrations.md
04-Indexes.md
05-Views.md
06-Security.md (future)
07-Performance.md (future)

````

---

```markdown

```

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

| Data             | Owner                   |
| ---------------- | ----------------------- |
| Player identity  | Authentication provider |
| Player profile   | Database                |
| Gameplay history | Runtime tables          |
| Game definitions | Reference tables        |
| Statistics       | Views                   |

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

```

---

## Self-review

I would rate this draft **9.7/10**.

The main reason it is not yet a 10 is intentional: it does not yet define the **physical PostgreSQL rules**.

Those belong in the next documents:

- `01-Naming-Conventions.md`
- `02-Design-Rules.md`

Specifically missing:

- exact table naming conventions
- singular vs plural decisions
- column naming
- FK naming
- index naming
- enum policy
- domains
- generated columns
- trigger policy
- soft deletes policy
- archival strategy

Those decisions are too detailed for this overview, so keeping them out is correct.

The next logical document is therefore:

```

05-Database/01-Naming-Conventions.md

```

where we define the exact language rules that every future migration and table must follow.

---

---
```
