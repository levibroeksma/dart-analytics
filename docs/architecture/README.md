<!--
status: canonical
scope: architecture/documentation-philosophy
read-when: understanding doc hierarchy and philosophy
updated: 2026-07-11
-->

# Architecture Documentation

> **Version:** 1.5.0 (2026-07-14)
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
docs/
├── architecture/          # Foundation + database handbook
│   ├── 01-Principles.md
│   ├── 02-System-Architecture.md
│   ├── 03-Engineering-Workflow.md
│   ├── 04-Architecture-patterns.md
│   ├── 099-engineering-workflow-and-decision-framework.md
│   ├── 05-Database/     # Database handbook (00–11)
│   ├── 06-API/          # API contract and implementation (00–04)
│   └── 07-Frontend/     # Frontend handbook (00–05, 10)
└── ...
database/
├── migrations/      # 0001–0016
└── seeds/           # 0001–0002
```

Application code lives in `app/`; executable schema in `database/`.

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
  06-Database-Specification.md   ← canonical spec: invariants + chapter index (2026-07-11)
  06-Spec/01–06                  ← per-layer entity chapters (2026-07-11)
  07–09                          ← historical design-gate records
  10-Database-Agent-Guide.md     ← agent operating rules

↓

06-API/
  00-Overview.md                 ← canonical API contract baseline (frozen v1)
  01-Implementation-Strategy.md  ← REST vs Actions, Cloudflare + Neon (2026-07-09)
  02-Middleware-And-Layering.md  ← middleware, folder structure, layer ownership (2026-07-09)
  03-Shared-Conventions.md       ← envelope, headers, pagination, types, error registry (2026-07-10)
  04-Endpoint-Contracts.md       ← per-domain endpoint contracts, ruleset extensibility (2026-07-10)

↓

07-Frontend/
  00-Overview.md                 ← API integration entry (2026-07-14)
  01-Rendering-Strategy.md       ← prerender-default, middleware (2026-07-14)
  02-Folder-Structure.md         ← tree, aliases, suffixes (2026-07-14)
  03-Alpine-Patterns.md          ← app.factory, stores, forms (2026-07-14)
  04-Modules-And-OOP.md          ← modules, portable UI kit (2026-07-14)
  05-Astro-Components.md         ← .astro authoring conventions (2026-07-14)
  10-Frontend-Agent-Guide.md     ← condensed agent rules (2026-07-14)

```

Higher-level documents take precedence over lower-level documents.

The canonical database entity reference is **`05-Database/06-Database-Specification.md`**. Migrations `0001`–`0016` and seeds `0001`–`0002` implement it.

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

For `app/` implementation validation, include `npx fallow` in the standard verification sequence to catch stale types/usages before completion.

---

# Versioning

Architecture documents use semantic versioning. Major changes require a version bump and, where appropriate, a dated entry in `DECISIONS.md` (the project's ADR mechanism, D52). <!-- 2026-07-14 -->

---

# Document Index

The per-file inventory (what each document answers, status, token budget) lives in **`00-Context-Map.md`** and is maintained under the Context Maintenance protocol. This README deliberately does not duplicate it — one registry, one place to go stale.

Every migration, view, API endpoint, and frontend component should be explainable by referring back to these documents.
