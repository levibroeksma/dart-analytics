# Context Summary — Prompts 36–40

**Handoff note:** This phase completes runtime table design, freezes the full database architecture, defines layer ownership and migration strategy, and establishes the hierarchical documentation system for developers and AI agents. Builds on `001_context.md` through `006_context.md`.

**Formal outputs:** Runtime migrations, constraints, indexes, views, and the `architecture/docs/` handbook live in the repo. This file captures conversational decisions — not the full DDL, README, or workflow document text.

---

## Phase Objective

Finish runtime entity design (configuration → stages → turns → darts), **freeze all layers**, plan PostgreSQL deliverables, and begin the **architecture documentation system** before writing SQL.

---

## Runtime Layer Design (Prompt 36)

### Generic `exercise_configurations` parent

Revised earlier per-game-only snapshot pattern. Added shared-PK parent before game-specific tables:

```
exercise_session → exercise_configurations (PK = exercise_session_id)
    → x01_configuration | tuod_configuration | singles_configuration | ...
```

Holds universal config: `capture_mode`, `input_mode_id`, `analytics_enabled`, `created_at`. Future: routine import source, replay provenance — without polluting every game table.

**Separation:** `exercise_sessions` = what happened; `exercise_configurations` = how it was configured.

### `exercise_stages`

Minimal generic table: `id`, `exercise_session_id`, `sequence`, `created_at`. No status, type, or score — specialization in child tables.

Definition: **smallest structural unit that owns one or more turns.**

| Game | Stage child |
|------|-------------|
| 501 | `x01_legs` (leg_number, starting_score, winner_participant_id) |
| TUOD | `tuod_targets` (target_score, completed) |
| Singles | `singles_targets` (target_number, target_multiplier) |
| Score | `score_rounds` (implied) |
| Cricket (future) | cricket-specific stage |

Shared PK: `exercise_stage_id` on child tables.

### `turns`

- `exercise_stage_id`, `participant_id`, `sequence`
- **`remaining_before` / `remaining_after`** (not score_before/after) — O(1) replay without recalculation
- `is_bust`, `started_at`, `completed_at`
- Intentional denormalization — replay performance justified

### `darts`

Answers one question: **what physically happened?**

```
board_number, multiplier, score
intended_board_number, intended_multiplier (nullable)
radial_miss (INSIDE | OUTSIDE | NONE)
angular_miss (LEFT | RIGHT | HIGH | LOW | NONE)
```

**Removed as stored fields:** `is_double`, `is_treble`, `ring`, `segment`, combined `miss_direction` — all derived.

Split miss direction into radial + angular for independent analytics (inside vs left).

**Turn dart count:** 1–3 darts per turn (not exactly 3). Unique `(turn_id, dart_number)`; checkout on dart 1 or 2 supported.

### `board_segments` lookup (proposed, not committed)

Canonical valid board_number + multiplier combinations (S1–S20, D1–D20, T1–T20, bulls). Would prevent impossible combos (T25) at DB level. Last alternative considered before runtime freeze — client agreed to freeze without mandating it in chat.

### Self-rated runtime scores: ~9.8–10/10

---

## Full Architecture Freeze v1.0 (Prompt 37)

All four layers frozen:

- Identity, Reference, Template, **Runtime**

Remaining work = constraints, indexes, views, materialized views, migrations, API contracts — no structural redesign expected.

### Self-review: three improvements (non-breaking)

| # | Improvement | Decision |
|---|-------------|----------|
| 1 | Event sourcing (undo, live sync, coaching) | **Not now** — schema already extensible for later |
| 2 | `version SMALLINT` on developer lookup tables | **Implement now** — cheap provenance for tooling |
| 3 | `public_code` on reference entities (e.g. `501_STANDARD`) | **Add** — stable API/deep-link identifiers; don't expose UUIDs in URLs |

**Reaffirmed rejections:** generic key/value configuration; JSONB for core gameplay (JSONB OK for metadata, import payloads, UI state only).

### Migration file structure (agreed)

```
database/
  000_extensions.sql
  001_domains.sql
  002_enums.sql
  003_lookup_tables.sql
  004_seed_lookup_tables.sql
  010_players.sql
  020_reference.sql
  030_templates.sql
  040_activities.sql … 045_darts.sql   ← runtime split by concern
  050_constraints.sql                  ← separated from tables
  060_indexes.sql
  070_views.sql
  080_materialized_views.sql
  090_seed_system_data.sql
  README.md
```

Numbering gaps intentional for future insertions. **Every migration leaves DB in valid state** — no deferred FKs, no half-finished nullable columns.

---

## Clean Slate & Layer Ownership (Prompt 38)

Client: **fresh database**, no production data to migrate. Wire UI to clean schema afterward. Agrees to generate every migration file individually with review-freeze cycle.

### Responsibility contract

| Layer | Owns | Does NOT own |
|-------|------|--------------|
| **PostgreSQL** | Referential integrity, constraints, historical truth, replayability, aggregation, views, transactions | Business workflows |
| **API** | Authorization, validation, business rules, session orchestration, snapshot creation, transaction boundaries | — |
| **Frontend** | UX, game engine (for now), temporary state, optimistic UI, rendering | — |

### CQRS-lite pattern identified

- **Writes:** Game → API → runtime tables
- **Reads:** Views → API → frontend (statistics never read raw tables)
- Swappable view ↔ materialized view without frontend changes

**Rule:** API never exposes raw tables. Repository abstracts tables and views.

### Progress at end of Prompt 38

| Area | Completion |
|------|------------|
| Architecture / conceptual / logical model | 100% |
| Physical design | ~90% |
| Migration strategy | ~95% |
| SQL implementation | 0% (by design) |

---

## Documentation System (Prompts 39–40)

Client requested **flows for developers and AI agents** to prevent architectural drift. Agrees: DB/API/UI separation, views for reads, single-concern migrations, best practices throughout.

### Hierarchical doc structure (proposed → implemented in `architecture/docs/`)

```
architecture/
  README.md, 01-Principles.md, 02-System-Architecture.md
  03-Engineering-Workflow.md
  04-Architecture-patterns.md
  05-Database/ (overview, naming, design rules, migrations, indexes, views, data model, …)
  API/, Frontend/, AI/, ADR/ (planned)
```

Core philosophy: **database is single source of truth**; everything else is a projection.

### 15 frozen principles (summary)

Architecture before implementation; DB as truth; immutable runtime; replay first-class; derived statistics; normalize first; views as API contracts; config copied not referenced; one responsibility per migration/table/endpoint/component; AI must preserve architecture; consistency beats cleverness; optimize after measuring.

### Key rules for AI agents

- No implementation before architecture approval
- Before table changes: review ADR → ERD → design rules → SQL
- Before API endpoint: check if view exists; justify new view if not
- Never invent architectural decisions; request clarification when info missing
- Mandatory PR checklist: duplication, replay, immutability, coupling, view bypass

### First document drafted (Prompt 40)

**`03-Engineering-Workflow.md`** — merged Development Lifecycle + Decision Framework:

- Progressive architecture (evolve controlled, never drift)
- Feature workflow: Problem → Requirements → Arch Review → ADR → DB → API → Frontend → Implement → Test → Perf → Docs → Merge
- 10-step human decision framework + 10-step AI decision framework
- Architectural escalation triggers, PR checklist, definition of done

### Proposed next document

**`04-Architecture-Patterns.md`** — recipe catalog: how to add game type, runtime entity, config table, API endpoint, analytics view, frontend page, routine, feature flag, deprecation. Intended before SQL migrations begin.

**Actual next step in chat:** `database/README.md` + `000_extensions.sql` (requested Prompt 39; implementation in subsequent prompts).

---

## Change Log vs 006_context.md

| Earlier (006) | Revised (36–40) |
|---------------|-----------------|
| Game-specific config only | `exercise_configurations` generic parent + game children |
| `score_before`/`score_after` on turns | `remaining_before`/`remaining_after` |
| Single `miss_direction` | `radial_miss` + `angular_miss` |
| Runtime design in progress | **All layers frozen v1.0** |
| Migration plan outline | Split runtime files; constraints/indexes separated |
| No project docs | Full `architecture/docs/` handbook structure |
| — | `version` on lookups, `public_code` on reference entities |
| — | Layer ownership + CQRS-lite read/write split |

---

## Open at End of Phase

- `04-Architecture-Patterns.md` — proposed, drafting deferred to next prompt
- `000_extensions.sql` and remaining migrations — next conversation
- `board_segments` lookup — proposed, not frozen in chat
- API route/validation/repository docs — planned under `04-API/`
- Event sourcing table — deferred

---

## Next Phase (agreed)

1. Draft `04-Architecture-Patterns.md` (or proceed per client priority)
2. `database/README.md` → `000_extensions.sql` → migration-by-migration with review-freeze per file
3. Then API contract and frontend wiring to clean database
