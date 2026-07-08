# Context Summary — Prompts 76–78

**Handoff note:** Continues **doc sync** with full-document rewrites of `05-Database/03-Migrations`, `04-Indexes`, and `05-Views` — aligned with implemented `0001`–`0009` migration chain. Builds on `001_context.md` through `017_context.md`.

**Formal outputs:** `architecture/docs/architecture/05-Database/03-Migrations.md`, `04-Indexes.md`, and `05-Views.md` already exist in the repo. Do **not** regenerate; validate against this summary and `000_master_context.md`.

---

## Phase Objective

Document the **migration strategy**, **index philosophy**, and **view strategy** as governing handbooks matching the frozen SQL foundation.

---

## `03-Migrations.md` — Complete Rewrite (Prompt 76)

### Migration principles frozen

| Principle | Rule |
|-----------|------|
| **One responsibility** | Each migration answers one capability question |
| **Deterministic** | Empty DB → migrations → seeds → ready app |
| **Immutable history** | Never edit/rename executed migrations; add `0010_*` for changes |
| **Schema vs data** | Migrations = structure only; seeds = reference data |
| **Atomicity** | `BEGIN`/`COMMIT` where possible; failed migration rolls back |
| **Size** | Small focused files; avoid "complete restructure" migrations |

### Documented migration chain (`0001`–`0009`)

| Migration | Purpose |
|-----------|---------|
| `0001_extensions` | PostgreSQL extensions |
| `0002_reference_tables` | Controlled definitions (incl. `dart_zones`); SMALLINT IDs; data via seeds |
| `0003_players` | Player structures; external auth only |
| `0004_templates` | Reusable exercise/routine definitions |
| `0005_runtime_core` | Activities, sessions, config, participants, stages |
| `0006_runtime_events` | Turns, darts — replay/analytics foundation |
| `0007_constraints` | CHECK, uniqueness, domain validation (no indexes) |
| `0008_indexes` | Query-pattern performance |
| `0009_views` | API read models |

### Seeds (frozen)

- Location: `database/seeds/`
- `0001_reference_data.sql` — deterministic, idempotent (`ON CONFLICT DO NOTHING`)
- Allowed: static lookups, system config (`DOUBLE`, `ACTIVE`, etc.)
- Forbidden: users, sessions, runtime history, test data

### Schema change workflow

New column → new migration → constraint update → index if needed. Separate schema migrations from data backfills when possible.

### Review checklist (per migration)

Purpose, ownership, integrity, performance, API/view impact, historical data impact.

### AI agent rules

Inspect existing migrations; never modify executed ones; new numbered files; separate schema/seeds; deliberate constraints; justified indexes; update docs.

---

## `04-Indexes.md` — Complete Rewrite (Prompt 77)

### Index philosophy frozen

> Design query patterns first. Add indexes based on evidence.

- PK indexes automatic — **no redundant `id` indexes**
- **FKs not auto-indexed** — index only when used for filter/join/ordering/child retrieval
- UUIDv7 gives chronological locality — no extra ordering index on PK unless justified
- Composite indexes: leading column must match query filter order
- Naming: `idx_<table>_<columns>`; partial indexes same pattern

### Access patterns documented

| Layer | Pattern | Index approach |
|-------|---------|----------------|
| Activities | Player history by `created_at` | `idx_activities_player_created_at` |
| Sessions | Active resume | Partial `WHERE completed_at IS NULL` |
| Sessions | Completed history | `(player_id, completed_at DESC)` |
| Turns | Replay order | `(stage_id, sequence_number)` — validate column name vs `exercise_stage_id` in SQL |
| Darts | Turn reconstruction | `(turn_id, sequence_number)` — validate vs `dart_number` in `0008` |
| Darts | Player analytics | Optional `idx_darts_player_created` — **do not add automatically**; derive via joins first |
| Reference | Lookup | PK + unique `implementation_key` only |
| Templates | User/published | `player_id`; partial `WHERE is_published = true` |

### Partial indexes

Lifecycle states (active sessions, published templates, incomplete games). Avoid when most rows match or condition changes frequently.

### Rules reaffirmed

- Index underlying tables, not views directly
- JSONB GIN only when JSON queried frequently; prefer relational columns
- Analytics indexes after measurement, not upfront
- 5-question review before any new index (query, frequency, write impact, restructure alternative, purpose documented)

---

## `05-Views.md` — Complete Rewrite (Prompt 78)

### View philosophy frozen

```
Tables (source of truth) → Views (read models) → API → Frontend
```

Views: stable contracts, simplify joins, hide schema — **never own data or alter historical truth**.

### Three view categories

| Category | Purpose | Examples (doc) | Implemented (`0009`) |
|----------|---------|----------------|------------------------|
| **API read models** | App-facing stable structures | `v_active_sessions`, `v_session_overview` | `v_active_sessions`, `v_session_overview`, `v_routine_execution` |
| **Replay views** | Deterministic event reconstruction | `v_game_replay` | `v_game_replay` |
| **Analytics views** | Derived metrics from facts | `v_player_accuracy`, `v_training_progress` | `v_dart_analytics` |

Validate doc examples against actual five views in `0009_views.sql`.

### Replay rules (frozen)

Replay hierarchy: Session → Stage → Turn → Dart. Must use **stored** config + ruleset version — never current templates/rulesets/settings.

### Design rules

- Focused views; avoid `v_everything` mega-views
- `snake_case` columns; expose `implementation_key` where applicable
- Allowed in views: joins, filter, aggregation, formatting
- **Forbidden:** workflow decisions, permissions, game engine logic, win/loss determination
- Shallow view dependency chains (tables → focused views → API)
- Breaking changes: versioned view name (`v_*_v2`), migration period, then drop old

### Materialized views

Only with evidence: expensive calc, infrequent change, defined refresh strategy. Not a substitute for indexing.

### View migration

Managed in migrations (`0009_views.sql`); changes require new migration files.

### Testing + AI rules

Test correctness, completeness, historical accuracy, performance. AI must identify consumer, category (API/replay/analytics), avoid business logic, document purpose.

---

## Change Log vs 017_context.md

| Earlier (017) | Revised (76–78) |
|---------------|-----------------|
| `03-Migrations` next in queue | **`03-Migrations` full rewrite** with `0001`–`0009` + seeds |
| `04-Indexes`, `05-Views` pending | **Both rewritten** with access-pattern and view-category guidance |
| Index/view philosophy in master only | **Formalized in handbook docs** |
| AI migration rules scattered | **Consolidated in `03-Migrations`** + per-doc AI sections |

---

## Validation notes (doc vs implementation)

| Topic | Check |
|-------|-------|
| `0001_extensions` | Doc mentions UUID extensions; master says `pg_stat_statements` only — reconcile |
| Turn index column | Doc may say `stage_id`; SQL uses `exercise_stage_id` |
| Dart index column | Doc may say `sequence_number`; SQL uses `dart_number` |
| View examples | Doc lists aspirational views; `0009` has exactly five — align terminology |

---

## Open at End of Phase

- Validate `03-Migrations.md`, `04-Indexes.md`, `05-Views.md` against repo (do not regenerate)
- Continue full rewrites: **`06-Data-Model.md`** next
- Then `07-Data-Model-Review`, `08-Physical-Schema-Mapping`, `09-Pre-Implementation-Review`
- Draft `10-Database-Agent-Guide.md`
- `database/README.md`; final requirements traceability review

---

## Next Phase (agreed)

1. Full rewrite `06-Data-Model.md` (entity list, runtime hierarchy, dart intention+result)
2. Continue through `09`
3. API architecture (`06-API/`)
