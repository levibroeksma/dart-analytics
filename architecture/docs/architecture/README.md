# Architecture Documentation

> **Version:** 1.2.0
>
> This repository follows a strict architecture-first development philosophy. Every change to the application must be designed before it is implemented. The goal is to create a maintainable, scalable and extensible platform that can evolve for many years without accumulating technical debt.

---

# Purpose

This documentation is the single architectural reference for the entire project.

It defines:

- architectural principles
- system and domain structure
- the development workflow
- recurring design patterns
- database standards and specification

These documents are intended for both human developers and AI agents.

The architecture documentation is the **source of truth**. If an implementation conflicts with documented architecture, the implementation is incorrect.

---

# Architecture Philosophy

## 1. Architecture before implementation

```
Architecture → Database → API → Frontend → Testing
```

## 2. The database is the source of truth

PostgreSQL owns domain data. The API exposes it. The frontend visualizes it.

## 3. Immutable runtime data

Completed gameplay is never modified. Corrections create new records.

## 4. Statistics are derived

Store facts. Compute statistics in views — never persist derivable values.

---

# Repository Structure

```
architecture/docs/
├── architecture/          # Foundation + database handbook
│   ├── 01-Principles.md
│   ├── 02-System-Architecture.md
│   ├── 03-Engineering-Workflow.md
│   ├── 04-Architecture-patterns.md
│   ├── 099-engineering-workflow-and-decision-framework.md
│   └── 05-Database/     # Database handbook (00–10)
└── database/
    ├── migrations/      # 0001–0011
    └── seeds/           # 0001–0002
```

Application code lives outside `architecture/docs/`.

---

# Documentation Hierarchy

Read in this order:

```
README.md (this file)

↓

01-Principles.md

↓

02-System-Architecture.md

↓

03-Engineering-Workflow.md
099-engineering-workflow-and-decision-framework.md  (quick-reference companion)

↓

04-Architecture-patterns.md

↓

05-Database/
  00-OVERVIEW.md
  01-Naming-Conventions.md
  02-Design-Rules.md
  03-Migrations.md
  04-Indexes.md
  05-Views.md
  06-Database-Specification.md   ← canonical entity reference
  07–09                          ← historical design-gate records
  10-Database-Agent-Guide.md     ← agent operating rules

↓

06-API/
  00-Overview.md                 ← canonical API baseline

↓

07-Frontend/   (planned)

↓

09-ADR/        (planned)
```

Higher-level documents take precedence over lower-level documents.

The canonical database entity reference is **`05-Database/06-Database-Specification.md`**. Migrations `0001`–`0011` and seeds `0001`–`0002` implement it.

---

# Layer Responsibilities

| Layer                   | Owns                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| Database                | Integrity, constraints, historical truth, views, transactions                                               |
| API (Cloudflare Worker) | Identity verification, domain authorization, validation, orchestration, repository pattern, UUID generation |
| Frontend                | UX, game engine, temporary state                                                                            |

Authentication provider remains Neon Auth; the Worker verifies identity claims per request.

---

# Development Workflow

Every feature follows the lifecycle defined in `03-Engineering-Workflow.md` (10 phases). Use `099-engineering-workflow-and-decision-framework.md` as the quick-reference companion.

Coding never skips architectural review.

---

# Change Management

Before implementing a change, determine whether it affects architecture, database schema, API contract, or frontend behaviour.

Changes affecting architecture must update the corresponding documentation before implementation begins.

---

# Versioning

Architecture documents use semantic versioning. Major changes require a version bump and, where appropriate, an Architecture Decision Record (ADR).

---

# Document Index

| Document                                   | Answers                                                           |
| ------------------------------------------ | ----------------------------------------------------------------- |
| `01-Principles.md`                         | What we believe                                                   |
| `02-System-Architecture.md`                | How the system is structured                                      |
| `03-Engineering-Workflow.md`               | How changes are introduced                                        |
| `04-Architecture-patterns.md`              | How recurring problems are solved                                 |
| `05-Database/00-OVERVIEW.md`               | Database philosophy and operating model                           |
| `05-Database/06-Database-Specification.md` | Every table, relationship, and lifecycle rule                     |
| `05-Database/03-Migrations.md`             | Migration strategy and chain `0001`–`0011`                        |
| `06-API/00-Overview.md`                    | API runtime, route, auth, read/write, and error contract baseline |

Every migration, view, API endpoint, and frontend component should be explainable by referring back to these documents.
