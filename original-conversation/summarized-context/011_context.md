# Context Summary — Prompts 51–53

**Handoff note:** This phase completes the `05-Database/` handbook (indexes and views), then resolves a structural gap — where SQL lives vs architecture docs. Builds on `001_context.md` through `010_context.md`.

**Formal outputs:** `architecture/docs/architecture/05-Database/04-Indexes.md`, `05-Views.md`, and later `06-Data-Model.md` exist in the repo; SQL lives under `architecture/docs/database/`. This file captures conversational decisions — not full document text or DDL.

---

## Phase Objective

Finish database **governance docs** (indexes, views), then clarify **documentation vs implementation** separation before generating migrations.

---

## `05-Database/04-Indexes.md` (Prompt 51)

Workload-driven indexing for a darts app — not generic CRUD.

### Two access patterns

| Path | Character | Operations |
|------|-----------|------------|
| **Write** | High frequency, batched | Activity/session create, turn/dart inserts, completion state |
| **Read** | Analytical | Progression, accuracy, doubles, checkouts, training effectiveness, session comparison |

**Philosophy:** Index known access patterns — not assumptions. Measure first, optimize second.

### Key rules

- Every index needs clear purpose, documented query pattern, owner
- PK indexes automatic; **FK columns must be indexed manually** in PostgreSQL
- Composite indexes: equality filters → range → sort; leftmost-column rule applies
- **Partial indexes** for subsets (e.g. active sessions per player)
- Time columns in composites with `player_id` — not bare `completed_at` unless global time queries needed
- UUIDv7 PKs: better locality than v4 for writes
- **Avoid:** boolean-only indexes, low-cardinality indexes, speculative indexes, JSON indexes without justification
- Runtime write path stays lightweight — no real-time aggregation on insert
- Use `EXPLAIN ANALYZE` before adding indexes

### Documented index patterns (examples)

```
idx_exercise_sessions_player_id_created_at     — player history, newest first
idx_turns_session_id_sequence                  — turns per session
idx_darts_turn_id_dart_number                  — darts per turn
idx_sessions_player_game_completed             — analytics by player + game + date
```

### Deferred to future `07-Performance.md`

Covering indexes (`INCLUDE`), BRIN for massive dart history, planner tuning, partitioning strategy.

**Rated 9.8/10** — exact per-table indexes deferred until physical schema + API queries + measurable plans exist.

---

## `05-Database/05-Views.md` (Prompt 52)

Views are the **analytical contract** between runtime data and API/frontend — not a convenience layer.

### Problem views solve

1. Statistics logic leaking into frontend/API → inconsistent results
2. Over-storing statistics → duplicated, stale data

**Principle:** Tables store facts; views explain performance. Every statistic must be reproducible from runtime data.

### Architecture flow

```
Runtime tables → Database views → API read models → Frontend
```

### Four view categories

| Category | Purpose | Examples |
|----------|---------|----------|
| Entity | Convenient domain projections | `vw_players`, `vw_game_types`, `vw_active_sessions` |
| Session | Completed gameplay summaries | `vw_exercise_session_summary`, `vw_game_result_summary` |
| Statistics | Performance metrics | `vw_double_accuracy`, `vw_checkout_statistics` |
| Progression | Improvement over time | `vw_player_progression`, `vw_training_progress` |

### Five view design rules

1. Clear purpose — one question per view
2. Single authoritative calculation location (DB, not duplicated in API/frontend)
3. Stable contracts — breaking changes require review
4. Prefer views over complex reusable API queries
5. Read-only — not hidden business workflows

### Analytics levels

- **Dart-level:** accuracy, miss direction, recovery, double analysis
- **Turn-level:** visit scoring, consistency, recovery after bad visit
- **Session-level:** duration, completion, accuracy trend
- **Game-specific:** e.g. `vw_501_checkout_statistics`, `vw_tuod_progression` — stats only, not game rules

### Materialized views

Only when query cost high, data changes infrequently, refresh strategy defined (nightly or post-session). Naming: `mv_<purpose>`.

### Edge cases to define explicitly

Empty player history, abandoned partial sessions (include or exclude?), configuration changes over time (historical stats must remain correct).

**Rated 9.9/10.** Deferred: formal statistics taxonomy, view ownership prefixes (`vw_statistics_*`), fixture-based view testing, MV lifecycle.

### Milestone

Initial `05-Database/` set complete:

```
00-Overview → 01-Naming → 02-Design-Rules → 03-Migrations → 04-Indexes → 05-Views  ✅
```

Natural checkpoint for holistic 10/10 review. Logical next: `06-API/00-Overview.md` — but client question redirected priorities.

---

## Repository Structure Clarification (Prompt 53)

Client asked: rules exist in `05-Database/`, but **where is the SQL?**

**Not forgotten — intentionally separated:**

| Location | Contains |
|----------|----------|
| `architecture/` | **Why and how** — principles, rules, ERD, decisions |
| `database/` | **Implementation** — migrations, seeds, executable DDL |

### Revised project layout

```
project-root/
├── architecture/
│   ├── 00–04 foundation docs
│   ├── 05-Database/     ← governance (00–06)
│   ├── 06-API/, 07-Frontend/, 08-AI/, 09-ADR/
│
└── database/
    ├── migrations/      ← 0001_extensions.sql, reference, runtime, indexes, views, …
    ├── seeds/           ← reference_game_types, statuses, features
    └── README.md
```

### ERD exists in two forms

| Artifact | Location | Audience |
|----------|----------|----------|
| Conceptual/logical ERD, entity catalogue, modelling rationale | `architecture/05-Database/06-Data-Model.md` | Humans, AI agents |
| `CREATE TABLE` DDL | `database/migrations/*.sql` | PostgreSQL execution |

Earlier table designs from chat → **migration files**, mapped roughly:

- Reference: `0002_reference_tables.sql`
- Templates: `0006_templates.sql`
- Runtime: `0007_runtime_sessions.sql`, `0008_turns.sql`, `0009_darts.sql`
- Indexes/views: separate migration files

### Identified gap: `06-Data-Model.md`

Governance docs answered why/name/design/evolve/optimize/query — but not **what exactly to build**.

**Must exist before SQL generation** — otherwise an agent can follow all rules and still invent the wrong schema.

Should contain: entity catalogue, logical ERD, relationship rules, ownership, layer boundaries, per-table responsibilities.

### Corrected implementation sequence

```
1. ✅ Database principles (Overview)
2. ✅ Naming conventions
3. ✅ Design rules
4. ✅ Migration strategy
5. ✅ Index strategy
6. ✅ View strategy
7. → Define complete data model (06-Data-Model.md)   ← gap filled here
8. → Create migrations from frozen model
9. → Seed data
10. → API repositories → views/tables
```

---

## Change Log vs 010_context.md

| Earlier (010) | Revised (51–53) |
|---------------|-----------------|
| `04-Indexes` next | **Drafted** |
| `05-Views` planned | **Drafted**; `05-Database/` handbook complete |
| SQL after index/view docs | **Blocked on `06-Data-Model.md`** first |
| `architecture/` only | **`database/` sibling folder** for migrations/seeds |
| ERD in chat / spec | Split: **docs vs migrations** |
| Next = `04-Indexes` | Next = **Data Model doc**, then SQL, then `06-API/` |

---

## Open at End of Phase

- Draft `architecture/05-Database/06-Data-Model.md` (entity catalogue + ERD + table responsibilities)
- Generate `database/migrations/` files one-by-one (discussed earlier, not yet in this range)
- `database/README.md`
- Holistic 10/10 review of foundation + database docs
- `06-API/00-Overview.md` — deferred
- `07-Performance.md` — covering indexes, BRIN, partitioning
- Migration tooling still unchosen

---

## Next Phase (agreed)

1. **`06-Data-Model.md`** — canonical schema definition before any DDL
2. Migration files from frozen model
3. Seed data, then API layer documentation/implementation
