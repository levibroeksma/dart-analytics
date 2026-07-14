<!--
status: canonical
scope: architecture/principles
read-when: architecture questions, new patterns, conflict resolution
updated: 2026-07-11
-->

# Project Principles

> **Version:** 1.1.0
>
> This document defines the fundamental engineering principles that govern the architecture, implementation and long-term evolution of this project.
>
> These principles are technology-independent and apply equally to the database, API, frontend, infrastructure and documentation.
>
> Every architectural decision should be explainable by referring to one or more principles defined in this document.

---

# Purpose

The purpose of these principles is to ensure that every contribution moves the project in a consistent direction.

The objective is not merely to produce working software.

The objective is to build a platform that remains maintainable, understandable and extensible for many years.

Whenever implementation speed conflicts with architectural quality, architectural quality takes precedence.

---

# Core Values

The project is built around six core values.

## Correctness

Correctness always has priority over convenience.

The system should produce reliable and deterministic results under all supported circumstances.

Correctness includes:

- accurate gameplay
- deterministic replay
- reliable statistics
- consistent behaviour
- referential integrity

---

## Simplicity

The simplest solution that satisfies all requirements should always be preferred.

Complexity must have measurable value.

Avoid introducing abstractions until they solve an actual problem.

---

## Consistency

Consistency is considered a feature.

Every part of the system should follow the same conventions whenever possible.

Examples include:

- naming conventions
- folder structure
- API design
- database modelling
- SQL style
- coding style

Predictability is more valuable than cleverness.

---

## Maintainability

Every implementation should be understandable by someone unfamiliar with the project.

Solutions should optimize for long-term readability rather than short-term implementation speed.

Future developers should be able to understand _why_ something exists, not only _how_ it works.

---

## Extensibility

The architecture should allow new functionality to be added without requiring fundamental redesign.

Examples include:

- adding new game types
- adding new routines
- adding new statistics
- adding new training modes
- adding new APIs

Existing functionality should remain stable while new functionality is introduced.

---

## Performance

Performance is important.

Premature optimization is not.

The project should optimize only after measurable bottlenecks have been identified.

Correctness must never be sacrificed for unmeasured performance improvements.

---

# Architectural Principles

## Architecture First

Architecture precedes implementation.

Every significant feature should be designed before implementation begins.

Implementation should never dictate architecture.

---

## Single Source of Truth

Every piece of information should have exactly one authoritative owner.

Examples:

- PostgreSQL owns domain data.
- The API owns orchestration.
- Neon Auth owns authentication.
- The Worker API owns identity verification and domain authorization.
- The frontend owns presentation.
- Documentation owns architectural decisions.

Duplicating ownership creates inconsistency.

---

## Separation of Concerns

Each architectural layer has a single responsibility.

### Database

Responsible for persistent data.

### API

Responsible for business orchestration.

### Frontend

Responsible for user interaction.

Responsibilities should never overlap.

---

## High Cohesion

Components should contain functionality that naturally belongs together.

Every module should have a clearly defined purpose.

---

## Loose Coupling

Components should depend on stable interfaces rather than implementation details.

Changing one module should have minimal impact on unrelated modules.

---

## Progressive Architecture

The architecture is allowed to evolve.

Architectural evolution must be intentional.

Changes require justification.

Architecture should never drift through incremental shortcuts.

---

# Data Principles

## Database First

The relational database is the foundation of the platform.

All persistent domain data originates from PostgreSQL.

---

## Immutable Runtime Data

Historical gameplay is immutable.

Completed sessions must never be modified.

Corrections are represented by new data rather than altering historical records.

---

## Replayability

Every completed exercise should be replayable.

Replayability is considered a first-class architectural requirement.

New features must preserve replay behaviour.

---

## Statistics are Derived

Gameplay data is stored.

Statistics are computed.

Derived values should not become stored state unless there is a demonstrated performance requirement.

---

## Normalize First

The project follows relational normalization by default.

Denormalization is permitted only when:

- measurable performance benefits exist
- duplication is controlled
- consistency can be guaranteed

---

## Database Constraints over Application Logic

Whenever practical, data integrity should be enforced by PostgreSQL.

Examples include:

- foreign keys
- check constraints
- unique constraints
- partial indexes

The application should complement database integrity rather than replace it.

---

# API Principles

The API exists to expose the domain model.

It should not become a second database.

The API is responsible for:

- identity verification (from trusted auth claims)
- validation
- domain authorization
- transactions
- orchestration

The API should avoid duplicating database logic.

Authentication provider concerns (login, token issuance, refresh) belong outside this API boundary (Neon Auth).

Reason: easy to swap for a different auth provider in the future.

---

# Frontend Principles

The frontend exists to provide an excellent user experience.

It should not become the primary source of business logic.

Temporary state belongs in the frontend.

Persistent state belongs in PostgreSQL.

---

# Documentation Principles

Documentation is part of the software.

Documentation must evolve together with implementation.

Outdated documentation is considered a defect.

Architectural documentation has higher priority than implementation details.

---

# AI Collaboration Principles

AI-generated contributions are expected to follow the exact same architectural standards as human contributors.

AI should:

- reuse existing patterns
- avoid unnecessary abstraction
- preserve architectural consistency
- request clarification when architectural information is missing

AI must never invent architectural decisions.

---

# Decision Making Principles

When multiple valid solutions exist, prefer the solution that maximizes:

1. Correctness
2. Simplicity
3. Consistency
4. Maintainability
5. Extensibility
6. Performance

This priority order should remain stable throughout the project.

---

# Definition of Quality

A solution is considered high quality when it:

- is correct
- is understandable
- follows existing conventions
- minimizes duplication
- preserves replayability
- maintains historical correctness
- remains easy to extend
- remains easy to test

Working software alone is not sufficient.

---

# Long-Term Vision

The project is intended to evolve into a scalable platform for darts training, analytics and performance tracking.

Architectural decisions should therefore optimize for long-term sustainability rather than immediate implementation speed.

Every new feature should strengthen the architecture rather than increase complexity.

---

# Final Principle

Every contribution should leave the project in a better state than it was found.

Small, continuous improvements are preferred over large disruptive redesigns.

Architecture is a continuous engineering discipline.

---

# Related Documents

| Document                                   | Purpose                        |
| ------------------------------------------ | ------------------------------ |
| `02-System-Architecture.md`                | System structure and data flow |
| `04-Architecture-patterns.md`              | Recurring solution patterns    |
| `05-Database/00-OVERVIEW.md`               | Database philosophy            |
| `05-Database/06-Database-Specification.md` | Canonical entity reference     |
