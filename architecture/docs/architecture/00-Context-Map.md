<!--
status: canonical
scope: repository-wide context routing
read-when: start of every task (via root CLAUDE.md protocol)
updated: 2026-07-12
-->

# Context Map

> **Version:** 1.0.2 (2026-07-12)
>
> Single source for: what documentation exists, what each file answers, which files a task needs, and the authority order when documents conflict. Maintained under the mandatory Context Maintenance protocol in the root `CLAUDE.md`.

---

# Context Packs

Load exactly the pack for your task type. Do not preload anything else. Escalate to additional files only when the pack demonstrably lacks the answer. (Root `CLAUDE.md` invariants are always in effect and are not repeated in the packs.)

| Task type | Load exactly | ~Budget |
| --------- | ------------ | ------- |
| New table / column / constraint | `05-Database/10-Database-Agent-Guide.md`, relevant `05-Database/06-Spec/` chapter, `05-Database/03-Migrations.md` | ~7k |
| New view / analytics query | `05-Database/05-Views.md`, `05-Database/06-Spec/05-Read-Model-Layer.md` | ~5k |
| New seed data | `database/seeds/0001` or `0002` (match id ranges), `05-Database/06-Spec/01-Reference-Layer.md` | ~5k |
| Neon environment / tooling | `05-Database/11-Neon-Integration.md`, `app/CLAUDE.md` | ~2k |
| New API endpoint | `06-API/00-Overview.md`, `06-API/04-Endpoint-Contracts.md`, `app/CLAUDE.md` | ~6k |
| API middleware / layering change | `06-API/02-Middleware-And-Layering.md`, `06-API/03-Shared-Conventions.md`, `app/CLAUDE.md` | ~5k |
| Frontend / page work | `07-Frontend/00-Overview.md`, `app/CLAUDE.md` | ~3k |
| New game type | `05-Database/10-Database-Agent-Guide.md` §"Add a new game type", `06-Spec/01-Reference-Layer.md`, `06-Spec/02-Template-Layer.md`, seeds | ~7k |
| Architecture question / new pattern | `01-Principles.md`, `04-Architecture-patterns.md` | ~5k |
| Workflow / process question | `03-Engineering-Workflow.md`, `099-engineering-workflow-and-decision-framework.md` | ~3.5k |
| "Why was X decided?" | `architecture/DECISIONS.md`; only if insufficient: `architecture/000_master_context.md` | ~2k |
| Bug in migration chain | `05-Database/03-Migrations.md`, full chain `database/migrations/0001`–`0012`; never patch applied files | ~6k |

Paths are relative to `architecture/docs/architecture/` unless they start with `architecture/`, `database/`, or `app/`.

---

# Authority Order (single source)

When documents conflict, higher wins; correct the lower one:

1. User instructions in the current task
2. `01-Principles.md`
3. `02-System-Architecture.md`
4. `04-Architecture-patterns.md`
5. `05-Database/06-Database-Specification.md` (+ its `06-Spec/` chapters)
6. `06-API/00-Overview.md`
7. `03-Engineering-Workflow.md` / `099-engineering-workflow-and-decision-framework.md`
8. SQL migrations `0001`–`0012` and seeds
9. Application code in `app/`

If code contradicts architecture docs, the docs win unless the user explicitly directs otherwise. `architecture/000_master_context.md` and `architecture/DECISIONS.md` are context, never authority.

---

# File Inventory

Status: **canonical** = current truth · **historical** = preserved record, never read by default · **generated** = tool output, do not hand-edit.

## Foundation (`architecture/docs/architecture/`)

| File | Answers | Status | ~Tokens |
| ---- | ------- | ------ | ------- |
| `README.md` | Documentation philosophy and hierarchy | canonical | ~1.8k |
| `00-Context-Map.md` | This file — routing, packs, authority | canonical | ~1.5k |
| `01-Principles.md` | What we believe (core values, 15 key rules) | canonical | ~2.1k |
| `02-System-Architecture.md` | System layers, data flows, ownership | canonical | ~1.9k |
| `03-Engineering-Workflow.md` | 10-phase change lifecycle | canonical | ~2.1k |
| `04-Architecture-patterns.md` | 15 recurring design patterns + anti-patterns | canonical | ~2.8k |
| `099-engineering-workflow-and-decision-framework.md` | Workflow quick reference | canonical | ~1.3k |

## Database handbook (`05-Database/`)

| File | Answers | Status | ~Tokens |
| ---- | ------- | ------ | ------- |
| `00-OVERVIEW.md` | Database philosophy and operating model | canonical | ~2.5k |
| `01-Naming-Conventions.md` | Table/index/constraint/view naming | canonical | ~1.9k |
| `02-Design-Rules.md` | Schema design rules, controlled denormalisation | canonical | ~2.4k |
| `03-Migrations.md` | Migration process + chain `0001`–`0012` | canonical | ~2.9k |
| `04-Indexes.md` | Index strategy (query-path driven) | canonical | ~2.5k |
| `05-Views.md` | View categories and replay rules | canonical | ~2.0k |
| `06-Database-Specification.md` | Cross-layer invariants + index into `06-Spec/` chapters | canonical | ~2.2k |
| `06-Spec/01-Reference-Layer.md` | Lookup tables (game_types … duration_types) | canonical | ~1.6k |
| `06-Spec/02-Template-Layer.md` | Templates, routines, configuration presets | canonical | ~1.6k |
| `06-Spec/03-Player-Layer.md` | players, player_settings | canonical | ~0.6k |
| `06-Spec/04-Runtime-Layer.md` | Activities, sessions, stages, turns, darts, idempotency | canonical | ~2.8k |
| `06-Spec/05-Read-Model-Layer.md` | View contracts (`v_*`) | canonical | ~1.2k |
| `06-Spec/06-Relationships-and-Evolution.md` | Relationship matrix, full ERD, future expansion | canonical | ~1.7k |
| `07-Data-Model-Review.md` | Design-gate record (superseded decisions inside) | historical | ~2.2k |
| `08-Physical-Schema-Mapping.md` | Design-gate record | historical | ~2.2k |
| `09-Pre-Implementation-Review.md` | Design-gate record | historical | ~1.4k |
| `10-Database-Agent-Guide.md` | Condensed DB rules for agents; ID strategy owner | canonical | ~2.0k |
| `11-Neon-Integration.md` | Neon topology, branches, dbmate/drizzle workflow | canonical | ~1.0k |
| `CHECKLIST.md` | Pre-completion DB checklist | canonical | ~0.2k |

## API (`06-API/`) and Frontend (`07-Frontend/`)

| File | Answers | Status | ~Tokens |
| ---- | ------- | ------ | ------- |
| `06-API/00-Overview.md` | Frozen v1 API baseline: runtime, routes, auth, envelopes | canonical | ~1.7k |
| `06-API/01-Implementation-Strategy.md` | REST endpoints, Cloudflare + Neon constraints | canonical | ~2.0k |
| `06-API/02-Middleware-And-Layering.md` | Middleware, `locals.auth`, folder layering | canonical | ~2.2k |
| `06-API/03-Shared-Conventions.md` | Envelope, headers, pagination, error registry | canonical | ~1.4k |
| `06-API/04-Endpoint-Contracts.md` | Per-domain endpoint contracts | canonical | ~2.9k |
| `07-Frontend/00-Overview.md` | Client pattern, state ownership, hydration | canonical | ~1.7k |

## SQL (`architecture/docs/database/`)

| File | Answers | Status |
| ---- | ------- | ------ |
| `README.md` | Directory layout, apply order | canonical |
| `migrations/0001`–`0012` | Applied schema chain — never modify | canonical (applied) |
| `seeds/0001`–`0002` | Reference data + default templates | canonical |

## Context & history (`architecture/`, repo root)

| File | Answers | Status |
| ---- | ------- | ------ |
| `architecture/DECISIONS.md` | One-line ledger of every architectural decision | canonical |
| `.github/pull_request_template.md` | Default PR description scaffold + architecture checklist (2026-07-12) | canonical |
| `architecture/000_master_context.md` | Full design-journey handoff (prompts 1–85) | historical |
| `docs/superpowers/{specs,plans,handoffs}/` | Point-in-time task designs and plans | historical |
| `app/CLAUDE.md` (+ `app/src/**/CLAUDE.md`) | App implementation rules, validation procedure | canonical |

---

# Current Implementation State

| Area | Status |
| ---- | ------ |
| Domain model v1.0 | Frozen |
| Migrations | `0001`–`0012` complete (2026-07-11) |
| Seeds | `0001` reference data, `0002` default templates |
| Database spec | `06-Database-Specification.md` v2.2.0 — split into `06-Spec/` chapters (2026-07-11) |
| Database handbook | `00`–`11` complete |
| API docs | v1 baseline frozen; contracts `00`–`04`; freeze validation reconciliation (2026-07-12) |
| Frontend docs | `07-Frontend/00-Overview.md` (2026-07-09) |
| Application code | Early scaffold in `app/` (auth middleware, player provisioning) |

---

# Maintenance Protocol

This map is kept correct by the mandatory Context Maintenance rules in the root `CLAUDE.md`: every new, moved, renamed, or deleted doc must be registered here in the same change, and `scripts/check-context-map.sh` must pass before any task is claimed done. (2026-07-11)
