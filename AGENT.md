# Agent Operating Manual — Dart Analytics

> Rules for AI agents working in this repository. Human developers may use this as a quick reference.

---

# Project

Personal darts scoring app with long-term progression tracking. Architecture-first: design before implementation.

**Stack:** Astro.js, TypeScript, Alpine.js, PostgreSQL (Neon), Cloudflare Worker proxy API.

**Principle:** Store what happened. Derive what it means.

---

# Read Order (first session)

1. This file (`AGENT.md`)
2. `architecture/docs/architecture/README.md` — documentation map
3. `architecture/docs/architecture/01-Principles.md` — beliefs
4. `architecture/docs/architecture/02-System-Architecture.md` — structure
5. `architecture/docs/architecture/04-Architecture-patterns.md` — how to solve recurring problems

**Database work additionally requires:**

6. `architecture/docs/architecture/05-Database/10-Database-Agent-Guide.md` — condensed DB rules
7. `architecture/docs/architecture/05-Database/06-Database-Specification.md` — every table and relationship

**API work additionally requires:**

8. `architecture/docs/architecture/06-API/00-Overview.md` — API baseline contract

---

# Authority and Conflict Resolution

| Priority | Source |
| -------- | ------ |
| 1 | User instructions in the current task |
| 2 | `01-Principles.md` |
| 3 | `02-System-Architecture.md` |
| 4 | `04-Architecture-patterns.md` |
| 5 | `05-Database/06-Database-Specification.md` |
| 6 | SQL migrations `0001`–`0011` |
| 7 | Application code |

If code contradicts architecture docs, the docs win unless the user explicitly directs otherwise.

Historical docs (`05-Database/07`–`09`) are design-gate records — not canonical. Check their "Superseded Decisions" tables.

---

# Layer Responsibilities

| Layer | Owns | Must not |
| ----- | ---- | -------- |
| **Database** | Integrity, constraints, historical truth, views | UI logic, auth credentials, workflow |
| **API** | Auth, validation, orchestration, transactions | Expose raw tables; duplicate DB truth |
| **Frontend** | UX, game engine, temp state | Become source of truth; touch DB directly |

**Data flow:** Frontend → API → PostgreSQL (writes) / Views → API → Frontend (reads).

---

# Safe Development Rules

## General

- Architecture before implementation. No coding that bypasses documented design.
- Minimal diffs. Match existing conventions. Reuse before creating.
- One responsibility per migration, endpoint, service, and table.
- When updating any docs file, add an ISO date (`YYYY-MM-DD`) to every newly added and/or changed row entry so documentation evolution is traceable.
- Do not commit unless the user asks.
- Do not regenerate architecture docs from scratch — validate and fix deviations only.

## Database (summary — full rules in `10-Database-Agent-Guide.md`)

- UUIDv7 domain entities; SMALLINT lookups with seeded ids. App generates all ids.
- Templates copy into runtime snapshots. Runtime never FK-references templates.
- Darts: intention + result zones. No multiplier column.
- Completed sessions immutable. Statistics in views only.
- Migrations `0001`–`0011`. Never modify applied migrations.
- New schema change = new numbered migration + spec update.

## API

- Repository pattern: Controller → Service → Repository → DB
- Read from views (`v_*`), write to runtime tables in transactions
- Batch session upload (not per-dart API calls)
- Worker/API generates UUIDv7 for runtime persistence entities
- Expose UUID + `implementation_key` in responses where applicable
- Auth via Neon Auth; API validates, DB stores `auth_user_id` reference only

## Frontend

- Game engine runs client-side
- Sends completed gameplay batches to API
- Never queries database directly

---

# Task Routing

| Task type | Start here |
| --------- | ---------- |
| New table / column / constraint | `10-Database-Agent-Guide.md` → `06-Database-Specification.md` → `03-Migrations.md` |
| New view / analytics query | `05-Views.md` → `06-Database-Specification.md` Read Model Layer |
| New seed data | `seeds/0001` or `0002` → match existing id ranges |
| New API endpoint | `06-API/00-Overview.md` → `02-System-Architecture.md` |
| New game type | `10-Database-Agent-Guide.md` "Add a new game type" |
| Bug in migration chain | Read full chain `0001`–`0011`; never patch applied files |
| Architecture question | `01-Principles.md` + `04-Architecture-patterns.md` |

---

# Forbidden Actions

- Modify applied migration files
- Expose raw database tables through the API
- Store derivable statistics in tables
- Add template foreign keys to runtime tables
- Use database-generated UUIDs or SERIAL ids
- Create generic EAV / polymorphic FK patterns for gameplay
- Skip documentation updates when changing schema
- Regenerate entire architecture docs instead of targeted fixes
- Force-push to main/master
- Commit secrets (`.env`, credentials)

---

# Documentation Map

```
architecture/docs/architecture/
├── README.md                          ← start here
├── 01-Principles.md
├── 02-System-Architecture.md
├── 03-Engineering-Workflow.md
├── 04-Architecture-patterns.md
├── 099-engineering-workflow-and-decision-framework.md
├── 05-Database/
│   ├── 00-OVERVIEW.md                 ← DB philosophy
│   ├── 01-Naming-Conventions.md
│   ├── 02-Design-Rules.md
│   ├── 03-Migrations.md               ← migration process + chain
│   ├── 04-Indexes.md
│   ├── 05-Views.md
│   ├── 06-Database-Specification.md   ← CANONICAL entity reference
│   ├── 07–09                          ← historical design gates
│   └── 10-Database-Agent-Guide.md     ← condensed DB agent rules
└── 06-API/
    └── 00-Overview.md                 ← API baseline contract

architecture/docs/database/
├── migrations/0001–0011.sql
└── seeds/0001–0002.sql
```

---

# Current Implementation State

| Area | Status |
| ---- | ------ |
| Domain model v1.0 | Frozen |
| Migrations | `0001`–`0011` complete |
| Seeds | `0001` reference data, `0002` default templates |
| Database spec | `06-Database-Specification.md` v2.1.0 |
| Database handbook | `00`–`10` complete |
| API docs | Baseline started (`06-API/00-Overview.md`) |
| Frontend docs | Not started |
| Application code | Not in scope of architecture docs |

---

# Verification Before Claiming Done

- [ ] Changes align with `06-Database-Specification.md` (if DB work)
- [ ] Migration is numbered, transactional, single-responsibility (if schema change)
- [ ] Spec and handbook docs updated (if schema change)
- [ ] No forbidden patterns introduced
- [ ] Id strategy respected (UUIDv7 / SMALLINT)
- [ ] Views used for reads, tables for writes (if API work)

---

# Context Files

Conversation history and decisions are summarized in:

- `original-conversation/summarized-context/000_master_context.md` — master handoff
- `architecture/CONVERSATION.md` / `CONVERSATION_PART_2.md` — full design history

Use master context for intent validation. Use formal docs in `architecture/docs/` for implementation.
