# Context Summary — Prompts 46–47

**Handoff note:** This phase completes the foundation architecture handbook (`04-Architecture-Patterns.md`) and begins the database documentation layer with `05-Database/00-Overview.md`. Builds on `001_context.md` through `008_context.md`.

**Formal outputs:** `architecture/docs/architecture/04-Architecture-patterns.md` and `05-Database/00-OVERVIEW.md` exist in the repo. This file captures conversational decisions — not the full document text.

---

## Phase Objective

Finish the **foundation documentation layer** (`00`–`04`), then enter **technology-specific database docs** starting with philosophy and operating model before table-level SQL.

---

## `04-Architecture-Patterns.md` (Prompt 46)

Final foundation document. Role in hierarchy:

| Doc | Answers |
|-----|---------|
| `01-Principles` | What we believe |
| `02-System-Architecture` | How the system is structured |
| `03-Engineering-Workflow` | How changes are introduced |
| **`04-Architecture-Patterns`** | **How recurring problems should be solved** |

Purpose: **pattern catalogue** — prevent developers and AI agents from inventing new solutions for solved problems.

### Fifteen approved patterns (summary)

| # | Pattern | Core rule |
|---|---------|-----------|
| 1 | Single Responsibility | One primary responsibility per table/endpoint/service/component |
| 2 | Database as Source of Truth | PostgreSQL owns persistent domain data; never duplicate truth |
| 3 | Immutable Runtime Data | Completed gameplay never modified; corrections = new records |
| 4 | Configuration Snapshot | Template → snapshot → runtime; runtime never depends on mutable templates |
| 5 | Typed Configuration | Per-game config tables; reject generic key/value for domain behaviour |
| 6 | Repository Pattern | Controller → Service → Repository → DB; no business logic in SQL or controllers |
| 7 | Views as Read Contracts | Frontend/API consume views, not raw table structures |
| 8 | Derived Analytics | Store facts; calculate insights; no stored derivable stats without evidence |
| 9 | Migration Isolation | One responsibility per migration file |
| 10 | Explicit Domain Modeling | Explicit entities (game type, ruleset, session, stage, turn, dart) — no generic catch-alls |
| 11 | Lookup Tables Over Hardcoded Values | Domain concepts as reference data |
| 12 | Stable Identifiers | UUIDv7 internal; `implementation_key` / `public_code` external |
| 13 | Eventual Event Architecture | Don't implement event sourcing now; schema must allow future extension |
| 14 | Feature Expansion | New game: reference data → features → ruleset → config model → runtime → views → docs — no redesign of existing games |
| 15 | Architecture Review Matrix | Ten quality attributes evaluated before significant changes |

### Architecture Review Matrix (Pattern 15)

Responsibility, Consistency, Replayability, Integrity, Normalization, Extensibility, Coupling, Cohesion, Performance, Simplicity — each with a mandatory review question.

### Anti-patterns documented

- Generic everything / EAV tables
- Business logic duplication across frontend, API, and DB
- Direct table exposure to consumers
- Premature abstraction
- Mutable historical data

### Pattern adoption process

New patterns only when existing patterns fail, benefits explained, alternatives considered, documented, ADR when appropriate.

### Foundation layer status

```
00-README.md              ✅ drafted
01-Principles.md            ✅ drafted
02-System-Architecture.md   ✅ drafted
03-Engineering-Workflow.md  ✅ drafted
04-Architecture-Patterns.md ✅ drafted
```

**No holistic refinement yet** — per earlier agreement: complete documentation set first, then review `00`–`04` together before polishing to 10/10.

---

## Transition to Database Docs (Prompt 46 → 47)

Next sequence:

1. `05-Database/00-Overview.md` — philosophy, conventions, policies
2. `01-Naming-Conventions.md` through `05-Views.md`
3. SQL migration files (only after database docs)

`00-Overview` translates abstract architecture into **how to think about PostgreSQL** — not individual table definitions.

### Planned `05-Database/` hierarchy

```
00-Overview.md          ← drafted (Prompt 47)
01-Naming-Conventions.md
02-Design-Rules.md
03-Migrations.md
04-Indexes.md
05-Views.md
06-Security.md          (future)
07-Performance.md       (future)
```

---

## `05-Database/00-Overview.md` (Prompt 47)

First technology-specific architecture document. Answers: *what is the philosophy, structure, and operating model of our PostgreSQL database?*

### Database philosophy

Relational-first. Normalize first; denormalize only with evidence. Priorities: correctness, consistency, integrity, explainability, maintainability.

**Platform:** PostgreSQL on Neon. API-only access — frontend never touches DB.

### Four logical layers (reaffirmed)

```
Reference → Template → Runtime → Analytics
```

| Layer | Purpose | Mutability |
|-------|---------|------------|
| Reference | Stable system definitions (game types, statuses, features, input modes) | Infrequent; system-managed |
| Template | Reusable future definitions (routines, config templates, rulesets as templates) | May evolve |
| Runtime | Gameplay history (activities, exercises, stages, turns, darts) | Immutable after completion |
| Analytics | Computed insights | Derived only; not second source of truth |

### Schema organization

Currently `public` for domain tables, views, functions. Future optional split into `reference`, `runtime`, `analytics` schemas **only when complexity justifies** — not premature.

Note: earlier chat proposed `core` schema for domains/enums (Prompt 37); overview mentions `public` primarily — physical split details deferred to `02-Design-Rules.md`.

### Policies restated

- **Identifiers:** UUIDv7, generated at creation (application-generated per Prompt 37)
- **Timestamps:** `TIMESTAMPTZ` everywhere; `created_at` required; `updated_at` where lifecycle changes
- **Configuration:** Template → Snapshot → Runtime (historical sessions independent of template changes)
- **Queries:** Transactional workload (writes, active state) vs analytical workload (stats via views/materialized views)
- **Views:** Preferred read contracts for API; materialized views only when expensive + infrequent change + measured benefit
- **Constraints:** FK, unique, check, exclusion, NOT NULL — invalid states should be hard to create
- **Migrations:** Versioned, one responsibility, deterministic, recreatable from scratch

### Data ownership (overview table)

| Data | Owner |
|------|-------|
| Player identity | Auth provider (Neon) |
| Player profile | Database |
| Gameplay history | Runtime tables |
| Game definitions | Reference tables |
| Statistics | Views |

### Database anti-goals

Must not become: frontend state store, workflow engine, duplicated-truth analytics cache, generic key-value store.

**Closing principle:** Database = reality; API = processes; frontend = interaction.

### Self-review: 9.7/10

Intentionally excludes physical rules — those belong in:

- `01-Naming-Conventions.md` — table/column/FK/index naming, singular vs plural, enum/domain policy, triggers, soft deletes, archival
- `02-Design-Rules.md` — detailed PostgreSQL rules

---

## Change Log vs 008_context.md

| Earlier (008) | Revised (46–47) |
|---------------|-----------------|
| `04-Architecture-Patterns` scoped, not drafted | **Drafted** with 15 patterns + anti-patterns + matrix |
| Foundation layer incomplete | `00`–`04` all drafted |
| Next = draft `04` | Foundation done; entered `05-Database/` |
| ATAM matrix proposed for doc 04 | Implemented as Pattern 15 |
| SQL migrations next | **Database docs first**, then SQL |

---

## Open at End of Phase

- Holistic refinement pass on `00`–`04` (deferred)
- `05-Database/01-Naming-Conventions.md` — next document
- `02-Design-Rules.md` through `05-Views.md`
- `06-Security.md`, `07-Performance.md` — future
- SQL migrations — after database documentation set
- Gaps from earlier polish passes still open: axioms in `01`, runtime lifecycle in `02`

---

## Next Phase (agreed)

Draft `05-Database/01-Naming-Conventions.md` — exact language rules every migration and table must follow.
