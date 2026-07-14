<!--
status: canonical
scope: architecture/system-structure
read-when: system layers, data flow, ownership questions
updated: 2026-07-11
-->

# System Architecture

> **Version:** 1.2.0
>
> This document describes the high-level architecture of the platform.
>
> It defines the major system components, their responsibilities, communication patterns and ownership boundaries.
>
> It intentionally avoids implementation details. Those are documented in lower-level architecture documents.

---

# Purpose

The goal of the architecture is to provide a scalable, maintainable and extensible platform for darts training, gameplay recording and long-term performance analytics.

The architecture has been designed around a single guiding principle:

> **Every component has a single responsibility and communicates through well-defined interfaces.**

---

# High-Level Architecture

```
                    User
                      │
                      ▼
              Frontend Application
                      │
              HTTPS / REST API
                      │
                      ▼
         Cloudflare Worker API
                      │
          Repository / Service Layer
                      │
        ┌─────────────┴─────────────┐
        │                           │
        ▼                           ▼
 PostgreSQL Tables           PostgreSQL Views
        │                           │
        └─────────────┬─────────────┘
                      │
                PostgreSQL Database
```

The frontend never communicates directly with PostgreSQL.

The API acts as the only gateway to persistent data.

Runtime baseline: Astro server endpoints deployed on Cloudflare Workers, using `@neondatabase/serverless` for PostgreSQL access.

---

# Layer Overview

The platform consists of four architectural layers.

```
Presentation

↓

Application

↓

Persistence

↓

Storage
```

Each layer owns a clearly defined responsibility.

---

# Presentation Layer

Responsible for:

- User interaction
- Rendering
- Temporary UI state
- User experience
- Client-side navigation

The presentation layer should remain stateless with respect to persistent domain data.

Persistent data is retrieved from the API.

---

# Application Layer

Responsible for:

- Business workflows
- Identity verification
- Domain authorization
- Validation
- Transaction orchestration
- Repository pattern
- UUIDv7 generation for runtime persistence entities

The application layer coordinates work.

It should not become the permanent owner of domain data.

---

# Persistence Layer

Responsible for:

- SQL
- Views
- Constraints
- Transactions
- Data modelling
- Query optimization

This layer exposes the domain model.

It is the authoritative owner of all persistent data.

---

# Storage Layer

Responsible for:

- Physical storage
- Indexes
- Backups
- PostgreSQL internals

The application should remain independent of physical storage implementation details.

---

# Domain Architecture

The domain is divided into five logical layers.

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

See `05-Database/06-Database-Specification.md` for the canonical entity reference.

---

## Reference

Relatively static system definitions.

Examples: game types, ruleset versions, game features, statuses, input modes, capture modes, dart zones.

Lookup tables use SMALLINT ids. `game_types` and `ruleset_versions` use UUIDv7.

---

## Player

Application profile linked to external authentication.

Examples: players, player_settings.

---

## Templates

Reusable user-configurable definitions.

Examples: exercise templates, routine templates, routine steps, configuration templates.

Templates define future gameplay. Runtime copies values — never references templates.

---

## Runtime

Gameplay history.

Examples: activities, exercise sessions, stages, turns, darts.

Completed runtime data is immutable historical truth.

---

## Read Model

Derived query interfaces for the API.

Examples: the five views in migration `0009`. Future analytics views (averages, checkout %, progression) extend this layer.

---

# Data Flow

The system follows a unidirectional data flow.

```
User

↓

Frontend

↓

API

↓

PostgreSQL

↓

Views

↓

API

↓

Frontend
```

Persistent data always originates from PostgreSQL.

Statistics originate from SQL Views.

---

# Write Flow

Gameplay recording follows this sequence.

```
User

↓

Frontend

↓

Temporary Client State

↓

Session Complete

↓

Single API Transaction

↓

Database
```

The frontend owns temporary gameplay state.

The database owns completed gameplay.

---

# Read Flow

Historical data follows this sequence.

```
PostgreSQL

↓

Views

↓

Repository

↓

API

↓

Frontend
```

Whenever possible, statistics should originate from SQL Views rather than application code.

---

# Ownership

Every responsibility has exactly one owner.

| Responsibility         | Owner         |
| ---------------------- | ------------- |
| Persistent data        | PostgreSQL    |
| Referential integrity  | PostgreSQL    |
| Business orchestration | API           |
| Authentication         | Neon Auth     |
| Identity verification  | API           |
| Domain authorization   | API           |
| Validation             | API           |
| User interface         | Frontend      |
| Temporary state        | Frontend      |
| Architecture           | Documentation |

Ownership should never overlap.

---

# Communication Rules

Layers may only communicate with adjacent layers.

```
Frontend

↓

API

↓

Database
```

The frontend must never access the database directly.

The database must never depend on frontend behaviour.

---

# Replay Architecture

Replayability is considered a core capability.

Every completed exercise should be reconstructable using only immutable runtime data.

Replay should never depend on:

- current templates
- current configuration
- mutable application state

Replay depends solely on historical runtime data.

---

# Statistics Architecture

Statistics are computed.

Gameplay is stored.

This distinction should remain clear throughout the system.

The preferred order is:

```
Runtime Tables

↓

Views

↓

Materialized Views

↓

API

↓

Frontend
```

Application code should avoid duplicating statistical calculations already available in SQL.

---

# Scalability

The architecture has been designed to support future expansion.

Examples include:

- additional game types
- online multiplayer
- AI opponents
- coaching
- tournaments
- teams
- public profiles
- cloud synchronization

New functionality should extend the architecture rather than replace it.

---

# Technology Independence

The architecture intentionally avoids dependencies on specific technologies.

Individual implementations may evolve.

The architectural principles remain unchanged.

---

# Architectural Boundaries

A component should never assume responsibilities belonging to another layer.

Examples:

- the frontend should not enforce database integrity
- the API should not become a reporting engine
- the database should not contain presentation logic

Clear ownership reduces complexity.

---

# Conclusion

The architecture emphasizes:

- clear ownership
- immutable history
- replayability
- extensibility
- normalization
- consistency

Every implementation should reinforce these characteristics rather than weaken them.
