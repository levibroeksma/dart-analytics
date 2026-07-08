# Context Summary — Prompts 79–81

**Handoff note:** This phase pivots `06-Data-Model.md` from a principle overview to a **canonical database specification** mirroring migrations `0001`–`0009`. Delivers **Parts 1–2 only** (foundation + Reference Layer tables). Template, Runtime, Read Model, ERD, and Table Matrix remain outstanding. Builds on `001_context.md` through `018_context.md`.

**Formal outputs:** Partial content for `architecture/docs/architecture/05-Database/06-Data-Model.md` may exist in the repo. Do **not** regenerate; validate against this summary and `000_master_context.md`.

---

## Phase Objective

Transform `06` into the **master specification** developers and AI agents consult before SQL/API work — synced to frozen migrations, not another philosophy document.

---

## Strategic Pivot (Prompt 79)

Architect **paused** a simple update. Rationale:

| Doc type (`00`–`05`) | Doc type (`06`) |
|----------------------|-----------------|
| **How** we build the DB | **What** the DB actually is |
| Principles, strategy | Canonical reference mapping to SQL |

### Proposed structure (agreed direction)

1. Purpose → High-Level Model → per-layer table specs → Relationships → Event Flow → Config/Ruleset flows → ID/Timestamp strategies → Design Decisions → Mermaid ERD → **Table Matrix**

### New artifacts proposed

- **Table Matrix** — per-table: Layer, Mutable, Owner, PK type (quick onboarding)
- **Relationship Philosophy** — explicit chain: Player → Activity → Session → Participant → Stage → Turn → Dart

Target size: **700–1000 lines**; quality bar = internal eng spec (RFC-style rationale per table).

---

## Rename & Structure Refinement (Prompt 80)

User agreed to rewrite. Further proposals:

| Proposal | Detail |
|----------|--------|
| **Rename** | `06-Data-Model.md` → **`06-Database-Specification.md`** (preferred over "Architecture Specification") |
| **Per-table template** | Purpose → Ownership → Lifecycle → Columns → Relationships → Constraints → Indexes → **Design Rationale** |
| **Layer sections** | Philosophy first, then tables (why before what) |
| **13-section outline** | Principles, cross-cutting standards, four layers, relationship matrix, ERD, future expansion, architectural decisions |

Note: Part 1 delivery still uses title **"Database Data Model"** and filename `06-Data-Model.md` — rename **deferred** until final polish.

---

## Delivery Approach (Prompt 81)

User directive: stop proposing structure; **sync docs to frozen SQL first**; deliver in **parts**; final 10/10 holistic review at end.

**Delivered:** Parts 1 and 2 only (continuous document, appendable).

**Not yet delivered:** Template Layer, Runtime Layer, Read Model Layer, Table Matrix, Mermaid ERD, remaining reference tables.

---

## Part 1 — Foundation (frozen content)

### Scope documented

Persistent entities, ownership, relationships, PKs/FKs, identifier/timestamp strategy, lifecycle, runtime event model, configuration snapshots, ruleset versioning. SQL syntax/indexes/migrations referenced separately (`03`–`05` docs).

### Architectural principles (reaffirmed)

- Relational-first; denormalize with evidence
- Facts over calculations (darts, targets, configs — not averages/percentages in tables)
- Historical accuracy — replay independent of current templates/rulesets
- Stable domain concepts (no frontend leakage)
- Explicit ownership per entity

### Four logical layers (in Part 1)

```
Reference → Template → Runtime → Read Model
```

(Analytics layer implied via views; not a separate section in Part 1.)

### Cross-cutting standards

| Topic | Rule |
|-------|------|
| Domain PK | UUIDv7 (players, sessions, turns, darts, …) |
| Reference PK | SMALLINT (statuses, zones, stage types, …) |
| Timestamps | `TIMESTAMPTZ`; `created_at`/`updated_at`; lifecycle names explicit |
| Auth | Neon Auth owns identity; DB stores external ID only |
| Event model | Session → Stage → Turn → Dart |
| Config | Template → Snapshot → Runtime Session |
| Rulesets | Immutable after publish; sessions pin version at start |

### Relationship philosophy (frozen)

```
Player → Activity → Exercise Session → Participant → Exercise Stage → Turn → Dart
```

Each level has distinct responsibility (grouping, playable instance, logical sections, oche visit, atomic event).

---

## Part 2 — Reference Layer (partial)

### Reference layer rules

- SMALLINT PKs, `implementation_key`, human `name`, seeded deterministically
- No user-specific data; system-owned

### Tables documented (Part 2)

| Table | Purpose summary |
|-------|-----------------|
| `game_statuses` | Activity/session lifecycle (ACTIVE, PAUSED, COMPLETED, …) |
| `game_types` | Supported games/exercises |
| `game_features` | Reusable capabilities (CHECKOUT, MULTIPLAYER, TIMED, …) |
| `game_type_features` | M:N game ↔ feature |
| `ruleset_versions` | Immutable per-game rule definitions (UUID PK) |
| `dart_zones` | Scoring zones (MISS through INNER_BULL) |
| `participant_types` | PLAYER, BOT, GUEST |
| `stage_types` | WARMUP, MATCH, CHECKOUT, PRACTICE, ROUND |
| `duration_types` | ROUNDS, MINUTES |

### Reference tables in SQL but **not** in Part 2

- `capture_modes`
- `input_modes`

---

## Validation notes (Part 2 vs migrations — reconcile)

| Topic | Part 2 text | Implementation (`0002`) |
|-------|-------------|-------------------------|
| `game_types` PK | SMALLINT | **UUID** — domain entity |
| `ruleset_versions` columns | `version`, `configuration_schema` | Validate actual column names |
| `participant_types` | BOT | Master uses **DARTBOT** |
| `stage_types` examples | WARMUP, CHECKOUT, PRACTICE | Master uses MATCH, SET, LEG, ROUND, EXERCISE_BLOCK |
| Missing tables | — | `capture_modes`, `input_modes` need spec sections |

---

## Change Log vs 018_context.md

| Earlier (018) | Revised (79–81) |
|---------------|-----------------|
| `06-Data-Model` next full rewrite | **Strategic pivot** — spec doc, not principle doc |
| Single-shot rewrite expected | **Phased delivery** — Parts 1–2 only |
| Filename `06-Data-Model.md` | **Rename to `06-Database-Specification.md` proposed** (not applied in Part 1) |
| Entity list in master only | **Per-table RFC sections** started for Reference Layer |
| Final polish deferred | Explicit: sync all docs first, **holistic 10/10 review at end** |

---

## Open at End of Phase

- Validate / complete `06-Data-Model.md` (or renamed spec) — Parts 3+ (Template, Runtime, Read Model)
- Add Table Matrix and Mermaid ERD
- Document `capture_modes`, `input_modes`; fix `game_types` PK in spec
- Align stage/participant enum examples with seeds
- Continue `07-Data-Model-Review`, `08-Physical-Schema-Mapping`, `09-Pre-Implementation-Review`
- Draft `10-Database-Agent-Guide.md`
- Final requirements traceability review

---

## Next Phase (agreed)

1. Deliver Part 3 — **Template Layer** (same per-table structure)
2. Deliver Part 4 — **Runtime Layer** (largest section; event model tables)
3. Deliver Part 5 — Read Model views + Table Matrix + ERD
4. Final architecture review for 10/10 polish
