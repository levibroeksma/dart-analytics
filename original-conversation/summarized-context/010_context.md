# Context Summary — Prompts 48–50

**Handoff note:** This phase drafts three database handbook documents — naming conventions, design rules, and migration strategy. Builds on `001_context.md` through `009_context.md`.

**Formal outputs:** `architecture/docs/architecture/05-Database/01-Naming-Conventions.md`, `02-Design-Rules.md`, and `03-Migrations.md` exist in the repo. This file captures conversational decisions — not the full document text.

---

## Phase Objective

Define the **SQL vocabulary contract**, **modelling guardrails**, and **schema evolution process** before indexes, views, and migration SQL files.

---

## `05-Database/01-Naming-Conventions.md` (Prompt 48)

Role: **how things are called** — every migration, table, column, constraint, index, view, and function must follow these rules.

### Core conventions

| Area | Rule |
|------|------|
| Language | English only |
| Case | `snake_case` everywhere |
| Tables | Plural nouns (`players`, `exercise_sessions`, `darts`) |
| Junction tables | `entity1_entity2` in natural reading order (`game_type_features`) |
| Primary keys | Always `id` (UUID); shared-PK 1:1 keeps `id` referencing parent |
| Foreign keys | `<referenced_table_singular>_id` — no `fk_` prefix on column names |
| Timestamps | `created_at` required; `updated_at`, `started_at`, `completed_at`, `deleted_at` as needed |
| Booleans | Prefix `is_`, `has_`, `can_`, `should_` — not bare `active` |
| Status | `status_id` or `game_status_id` → lookup table — not free-text `VARCHAR` |
| Lookup tables | `<domain>_<concept>` (`game_statuses`, `input_modes`) |
| Stable codes | `implementation_key` on system lookups — immutable after publication |
| Enums | Only for extremely stable internal states; prefer lookup tables for business concepts |
| Config tables | `<game>_configurations` |
| Snapshots | `<concept>_snapshots` |
| Views | `vw_<purpose>` (preferred) |
| Materialized views | `mv_<purpose>` |
| Indexes | `idx_<table>_<columns>`; unique: `ux_<table>_<columns>` |
| Constraints | `pk_`, `fk_`, `uq_`, `ck_` prefixes |
| Functions | `verb_noun`; triggers: `trg_<table>_<action>` |
| Column order | `id` → FKs → domain columns → status → timestamps |
| Reserved words | Avoid `user`, `order`, `group`, `type` — use `player`, `sequence_number`, `game_type` |

### Self-review: 9.8/10

Deferred to `02-Design-Rules.md` (not purely naming): soft-delete policy, audit columns, tenant isolation, universal `created_at`/`version` on lookups, schema split (`reference`/`runtime`/`analytics`), PostgreSQL domains usage.

---

## `05-Database/02-Design-Rules.md` (Prompt 49)

Role: **how things are allowed to exist** — guardrails against over/under-normalization, derived storage, mutable history, JSON abuse, weak constraints, template/runtime coupling.

### Eighteen mandatory rules (summary)

| Rule | Principle |
|------|-----------|
| 1 | Normalize by default; denormalize only with documented measurable benefit |
| 2 | Store facts; compute conclusions; prefer materialized views over duplicated columns |
| 3 | Completed gameplay immutable; corrections via new records/events, not edits |
| 4 | Template layer ("what should happen") separate from runtime ("what happened") |
| 5 | Copy configuration into snapshot at execution start |
| 6 | Explicit domain entities; no generic `events`/`properties` for core concepts |
| 7 | JSON only for genuinely flexible data (API payloads, optional metadata) — not game rules |
| 8 | DB enforces integrity: FK, NOT NULL, CHECK, UNIQUE |
| 9 | Lookup tables for business states, not app-defined strings |
| 10 | Shared primary keys for strict 1:1 (`exercise_configurations.id` = `exercise_sessions.id`) |
| 11 | Avoid wide nullable columns — separate per-game config tables |
| 12 | `TIMESTAMPTZ` always; meaningful event timestamps |
| 13 | Historical runtime data not hard-deleted; reference data deprecated/unpublished |
| 14 | Version rulesets and gameplay-influencing definitions |
| 15 | Design for replay without current config/rules/frontend |
| 16 | No premature `tenant_id` everywhere — allow future multi-tenancy without complexity now |
| 17 | Explicit FK names (`exercise_session_id` not `parent_id`) |
| 18 | Migration compatibility: consider old records, API, replay, statistics |

Includes design review checklist: modelling, integrity, historical data, analytics, future growth, complexity.

### Self-review: 9.9/10

Aligns with all prior architectural decisions (immutable runtime, replay, extensible games, routines, future multi-user, AI-agent rules).

**Next:** `03-Migrations.md`, then `04-Indexes.md`, `05-Views.md`.

---

## `05-Database/03-Migrations.md` (Prompt 50)

Role: **database evolution process** — recreate from zero, understand every change, safely evolve schema.

### Migration principles

1. **Database changes are code** — version controlled, reviewed, no manual production edits
2. **Small single-purpose migrations** — not monolithic `001_initial_database.sql`
3. **Order = dependency order:**

```
Extensions → Types/Domains → Reference → Core → Dependent
    → Indexes → Views → Functions/Triggers → Seed Data
```

### Key policies

| Topic | Rule |
|-------|------|
| Naming | `<sequence>_<description>.sql`, snake_case, descriptive not ticket-based |
| Immutability | **Never modify applied migrations** — fix forward with new file |
| Transactions | `BEGIN`/`COMMIT` by default; document exceptions (e.g. some index ops) |
| Allowed in migrations | DDL, constraints, indexes, views, functions, triggers, reference seed data |
| Not allowed | App logic, temp data fixes, env-specific values, user data |
| Table creation | Complete in one migration: PK, FKs, constraints, timestamps, required indexes |
| Column removal | Deprecation over 3 releases (exists → app stops using → drop) |
| Column rename | Add new → copy → update app → remove old |
| Indexes | Separate migration files from table creation |
| Views | After tables, constraints, and indexes |
| Seed data | Reference data only; idempotent (`ON CONFLICT DO NOTHING`); stable `implementation_key` |
| Environments | Dev/test/prod all reproducible from base + seed migrations |
| Rollback | Prefer **forward migrations** over production rollback for destructive changes |
| Reset | Drop DB → run all migrations → seed → ready |

### Dev workflow

Update docs if needed → create migration → apply locally → verify → update API → test → commit.

### AI migration workflow

Review before use: dependency order, naming, constraints, rollback implications, architecture compliance. Never modify existing migrations or invent tables without documentation.

### Self-review: 9.8/10

**Open decisions (deferred):**

1. **Migration tooling** — not chosen (Neon native, Prisma, Drizzle, Flyway, Liquibase, raw SQL). Doc intentionally tool-agnostic.
2. **Roll-forward / zero-downtime** — expand/contract migrations, backwards-compatible API versions — important for future commercialization, not detailed yet.

### Next document scoped

**`04-Indexes.md`** — must balance two workloads:

- **Write-heavy:** activity/session/turn/dart ingestion
- **Read-heavy:** progression, accuracy, averages, historical comparisons

---

## Documentation Progress

```
05-Database/
  00-Overview.md           ✅ (Prompt 47)
  01-Naming-Conventions.md ✅ (Prompt 48)
  02-Design-Rules.md       ✅ (Prompt 49)
  03-Migrations.md         ✅ (Prompt 50)
  04-Indexes.md            ← next
  05-Views.md              ← planned
```

Foundation `00`–`04` and holistic polish pass still deferred per earlier agreement.

---

## Change Log vs 009_context.md

| Earlier (009) | Revised (48–50) |
|---------------|-----------------|
| `01-Naming-Conventions` next | **Drafted** |
| Physical rules deferred | **`02-Design-Rules` drafted** with 18 rules |
| Migrations after DB docs | **`03-Migrations` drafted**; SQL files still after `04`/`05` |
| `core` schema mentioned | Schema split still deferred to design rules refinement |
| Index/view docs planned | Index doc scoped to write vs read workload |

---

## Open at End of Phase

- `04-Indexes.md` — partial indexes, composite, query-driven (next)
- `05-Views.md` — analytics views, read models, materialized views
- Migration tooling selection
- Zero-downtime / expand-contract policy for production
- Actual SQL migration files (`architecture/docs/database/migrations/`)
- Holistic review of foundation `00`–`04` and database docs

---

## Next Phase (agreed)

Draft `05-Database/04-Indexes.md` — indexing strategy for gameplay writes and analytics reads.
