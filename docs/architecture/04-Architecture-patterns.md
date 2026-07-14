<!--
status: canonical
scope: architecture/patterns
read-when: solving recurring design problems
updated: 2026-07-14
-->

# Architecture Patterns

> **Version:** 1.3.0 (Pattern 17 frontend layering 2026-07-14)
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

# Pattern 5 — Configuration Snapshot

## Principle

Configuration is strongly modelled through a three-stage lifecycle:

```
configuration_templates (preset)

↓

exercise_configurations (immutable snapshot)

↓

exercise_session (runtime)
```

Avoid generic key-value tables for domain behaviour.

---

## Avoid

```
configuration_key

configuration_value
```

---

## Prefer

```
configuration_templates.configuration  (JSONB preset)

exercise_configurations.configuration  (JSONB snapshot, copied at session start)
```

The JSONB structure per game type is defined by the ruleset version's configuration schema. The application validates; the database guarantees the value is a JSON object.

---

## Reason

- presets and snapshots share one representation — copy is lossless
- written once, read for replay — never queried relationally
- ruleset version defines structure without per-game child tables
- database CHECK enforces JSON object type

See `05-Database/06-Database-Specification.md` — Configuration Snapshot Model.

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

# Pattern 8 — API Contract Boundary

## Principle

The API contract is explicit, versioned in architecture docs, and owned by the Worker boundary.

---

## Application

Baseline contract is defined in:

`06-API/00-Overview.md`

Implementation guidance is defined in:

`06-API/01-Implementation-Strategy.md` and `06-API/02-Middleware-And-Layering.md` (2026-07-09)

Current baseline includes:

- Cloudflare Worker runtime for API endpoints
- Bearer JWT identity verification in middleware
- resource-first REST route surface by domain
- batch write endpoint (`POST /api/sessions/:sessionId/events/batch`)
- Worker-generated UUIDv7 for runtime persistence entities
- view-backed read endpoints from `v_*` contracts
- standard success/error envelope with domain codes and retry semantics

---

## Rule

Do not implement or change API behavior that is not reflected in `06-API/00-Overview.md` (or a superseding API architecture document).

Do not substitute Astro Actions for the v1 REST API surface. See `06-API/01-Implementation-Strategy.md` (2026-07-09).

---

# Pattern 9 — Derived Analytics

## Principle

Store facts.

Calculate insights.

---

## Example

Store:

```
dart thrown
intended_target_number + intended_zone_id
hit_target_number + hit_zone_id
score
```

Calculate:

```
checkout percentage
average score
double accuracy (from zone, not stored multiplier)
progression trend
```

---

## Rule

Never store values that can reliably be derived unless there is a proven performance reason.

---

# Pattern 10 — Migration Isolation

## Principle

Every database migration has exactly one responsibility.

---

## Example

Good:

```
0006_runtime_events.sql
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

# Pattern 11 — Explicit Domain Modeling

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

# Pattern 12 — Lookup Tables Over Hardcoded Values

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

# Pattern 13 — Stable Identifiers

## Principle

Internal identifiers and external identifiers have different purposes.

---

## Internal

Domain entities use:

```
UUIDv7 (application-generated)
```

Controlled lookup tables use:

```
SMALLINT (explicit seeded ids)
```

Purpose:

- database relations
- uniqueness
- indexing
- efficient joins on small controlled sets

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

# Pattern 14 — Eventual Event Architecture

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

# Pattern 15 — Feature Expansion Pattern

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

# Pattern 16 — Architecture Review Matrix

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

# Pattern 17 — Frontend Layering

## Principle

The frontend uses Alpine-native layering with prerender-default shells, not API-style controllers.

## Pattern

```
Astro page (prerender + middleware)
    ↓
Alpine.data (*.data.ts) — x-data="componentState()"
    ↓
Alpine.store / form (*.store.ts, *.form.ts)
    ↓
Module (*.module.ts, *.engine.module.ts, *.payload.module.ts)
    ↓
@client/api/ (orchestrated by pages/forms/stores only)
```

## Application

- Alpine boots only via `lib/client/alpine/app.factory.ts` (`@astrojs/alpinejs` entrypoint).
- No `x-init`. Always `x-data="factory()"`.
- `$persist` only in `*.store.ts` and `*.form.ts`.
- Modules never import `@client/api` or Alpine.
- Client recovery auto-cleans on session mismatch (D88).

## Rule

Detail lives in `07-Frontend/01`–`04` and `10-Frontend-Agent-Guide.md`. API integration boundary remains in `07-Frontend/00-Overview.md`.

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
