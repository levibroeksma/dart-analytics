# Context Summary — Prompts 26–30

**Handoff note:** This phase revises the ERD to ~9.8+ robustness, introduces `exercise_stage` as the key abstraction, freezes the conceptual architecture at v1.0, drafts the Database Design Specification, and begins physical PostgreSQL conventions. Builds on `001_context.md` through `004_context.md`.

**Formal outputs:** The frozen principles, data model, design rules, migrations, and Mermaid ERD now live in `architecture/docs/`. This file captures the conversational pivots and decisions that produced those documents — not their full contents.

---

## Phase Objective

Eliminate remaining polymorphic/generic relationships, reach architectural confidence (~9.8+/10), **freeze the conceptual model**, and transition to physical PostgreSQL design.

---

## Major ERD Revision (Prompt 26)

Self-review of Prompt 25's Mermaid ERD identified structural inconsistencies. Revisions:

### Configuration ↔ Structure symmetry

Configuration was generic (JSONB parent) while structure was game-specific. **Both now follow the same pattern:** game-specific 1:1 child tables per exercise session.

**Removed:** generic `EXERCISE_CONFIGURATION` entity.

```
exercise_session → x01_configuration | tuod_configuration | singles_configuration | score_training_configuration
exercise_session → x01_sets/legs | tuod_targets | singles_targets | score_rounds (via stages)
```

No JSON, no nullable config columns, proper FKs and CHECK constraints.

### Turn parent linkage — polymorphism eliminated

`TURN.structure_id` (nullable polymorphic FK) rejected.

**Considered and rejected:** per-game turn tables (`x01_turn`, `tuod_turn`, …) — duplicates every future column.

**Adopted:** `exercise_stage` — the only abstraction deemed justified.

```
exercise_session → exercise_stage → turn → dart
                      ↓
              game-specific stage (x01_leg, tuod_target, singles_target, score_round)
```

- Every turn references exactly **one** `exercise_stage_id` — non-nullable, no polymorphism
- Stage = "current objective before walking to the oche" (leg, target, round)
- Generic queries possible ("all stages in this exercise") while game-specific attributes live in child tables

**Option confirmed (Prompt 27):** `exercise_stage` as a real PostgreSQL table with 1:1 game-specific stage children — not a purely logical concept.

### Routine step flexibility

Added `configuration_source` enum concept:

| Value | Meaning |
|-------|---------|
| `FIXED_RULESET` | Step specifies exact ruleset |
| `PLAYER_DEFAULT` | Use player's preferred ruleset for that game |
| `CUSTOM` | Step defines custom overrides |

### Player preferences hierarchy

```
player_preferences (general settings)
    ↓
player_game_preferences (per-game defaults)
```

### Capabilities normalized

Rejected `capability + enabled` columns on game type. Adopted many-to-many:

```
capabilities ←→ game_type_capabilities ←→ game_types
```

Reusable across timed, analytics, bot, online, multiplayer, coach, tournament, etc.

---

## Naming Debate: Stage vs Objective (Prompt 27)

Brief proposal to rename `exercise_stage` → `exercise_objective` ("current objective" reads better in domain language).

**Walked back:** A leg/round/target is structural position *and* objective. "Stage" is intentionally neutral for the persistence model; UI displays domain names ("Leg 2", "Target 81"). **Kept `exercise_stage`** for database concept.

---

## Configuration Templates (Introduced, Prompt 27)

Gap identified between ruleset and session config:

```
Ruleset → Configuration Template → Session (copies values, immutable)
```

Examples: "501 Practice — Best of 3 Legs, Double Out, Analytics." Not a ruleset, not a session — a **preset**.

Enables: system presets, player favorite configurations, routine steps referencing templates instead of embedding full config.

Distinction from ruleset: ruleset = immutable gameplay rules; template = reusable session configuration defaults.

---

## Ownership Model (Prompt 27)

| Category | Entities |
|----------|----------|
| **Developer-owned** | game_types, rulesets, capabilities, system routines |
| **Player-owned** | player, player settings/preferences, player routines, player presets |
| **Runtime** | activity, exercise, stages, turns, darts |

---

## Platform Realization

Architecture recognized as an **Exercise Execution Platform**, not a darts-specific database. Game-specific logic isolated in game types, rulesets, config tables, and stage tables. Generic execution hierarchy (activity → exercise → stage → turn → dart) is domain-agnostic.

Self-rated maturity after revision: ~9.8–10/10 across all areas; configuration at 9.8 pending template refinement in physical schema.

---

## Architecture Freeze v1.0 (Prompt 28)

Client agreed to freeze. **Conceptual domain model declared stable.** Future changes must be additive extensions, not structural redesign.

### Frozen layer structure

```
01 Identity     → players (users = Neon Auth, external)
02 Reference    → game_types, rulesets, capabilities, lookups
03 Templates    → routine_templates, routine_steps, configuration_templates
04 Runtime      → activity_sessions, exercise_sessions, exercise_stages,
                  game-specific config/stage tables, participants, turns, darts
05 Analytics    → views, materialized views (no persisted stat tables)
```

### Frozen principles (10)

1. Facts immutable after `COMPLETED`
2. Darts are source of truth for all statistics
3. Game engines own their config/stage tables (Open/Closed)
4. Published rulesets never change — new behavior = new ruleset
5. Sessions snapshot everything for eternal replayability
6. Preferences/settings are defaults only — never history
7. No JSONB, EAV, or nullable polymorphic FKs for core gameplay
8. UUIDv7 everywhere
9. TIMESTAMPTZ everywhere (UTC storage)
10. Frontend executes gameplay; database owns historical truth

### Agreed roadmap post-freeze

1. Physical PostgreSQL schema
2. Replay & persistence contract
3. Analytics layer (views, materialized views)
4. API contract (Controller → Service → Repository → Neon)
5. Database Design Specification as companion ADR document

---

## Database Design Specification (Prompt 29)

Full markdown draft produced in chat as **"DartFlow Database Design Specification" v1.0**. Covers: design goals, principles, layered architecture, UUID/timestamp/naming conventions, soft-delete policy, status lifecycle, ruleset/config/stage/turn/dart philosophy, indexing philosophy, replay philosophy, and updated Mermaid ERD.

**Recommendation appended:** Add two appendices before calling it complete:
1. Data Lifecycle Matrix (ownership, mutability, archival per entity)
2. Performance & Scalability Assumptions (row growth, query patterns, index rationale)

These became part of the formal doc set in `architecture/docs/architecture/05-Database/`.

---

## Physical PostgreSQL Foundations (Prompt 30)

First physical design decisions before table DDL:

### Type strategy

| Category | PostgreSQL approach | Examples |
|----------|---------------------|----------|
| Never changes | ENUM | `exercise_status`, `capture_mode`, `participant_type`, `miss_direction` |
| Rarely changes | Reference/lookup table | `capabilities`, `game_type_capabilities` |
| Frequently changes | Normal table | `game_types`, `rulesets` |

`input_modes` and `completion_types` → **lookup tables** (expected to grow: voice, camera, endless mode, etc.).

### UUID generation

**Application-generated UUIDv7** (Option B) — not DB default, not BIGSERIAL.

Rationale: Neon compatibility today, offline support, IDs available before insert, easier batch session upload.

### Timestamp conventions

- Immutable tables: `created_at` only
- Mutable tables: `created_at` + `updated_at`
- Runtime: `started_at`, `completed_at` ( **`completed_at` preferred over `ended_at`** for consistency)

No `created_by`/`updated_by` — single-user app; ownership via player FK.

### Status enums

`exercise_status` and `activity_status` share same values:

```
CREATED → IN_PROGRESS → PAUSED → COMPLETED | ABANDONED
```

`ABANDONED` added for unresumed sessions (e.g. battery death) — distinct from completed.

### CHECK constraints & DOMAIN types

Database rejects impossible states (dart_number 1–3, multiplier 1/2/3, bull rules, board_number 1–20 or 25).

PostgreSQL `DOMAIN` types recommended for reusable constraints (`dart_number`, `multiplier`, `board_number`).

### Naming refinement

`player_preferences` → **`player_settings`** (theme, locale, timezone, capture/input defaults are settings, not optional preferences).

### Schema organization

Dedicated **`core` schema** (or `shared`) for domains, ENUMs, extensions, utility/trigger functions. Application tables in `public`.

### FK policy

`ON DELETE RESTRICT` by default; `CASCADE` only for true composition.

---

## Re-evaluation Scores (Post-Revision)

| Area | Score |
|------|-------|
| Identity, Activities, Exercise Sessions, Rulesets | 10/10 |
| Configuration (typed tables) | 9.8/10 |
| Exercise Stage abstraction | 9.9/10 |
| Turns, Darts, Replayability, Analytics, Extensibility | 10/10 |

Adding Cricket = `cricket_configuration` + `cricket_stage` only. Nothing else changes.

---

## Change Log vs 004_context.md

| Earlier (004) | Revised (26–30) |
|---------------|-----------------|
| `EXERCISE_CONFIGURATION` JSONB or generic | Per-game typed 1:1 config tables |
| `TURN.structure_id` polymorphic | `exercise_stage` table + game-specific stage children |
| `game_type_capability` flag columns | Many-to-many `capabilities` |
| Conceptual model open | **Frozen v1.0** |
| Physical schema not started | Type/UUID/timestamp/enum conventions locked |
| Routine steps = ruleset + overrides only | + `configuration_source`, configuration templates |
| `ended_at` | `completed_at` |
| Player preferences | Player settings (+ game-level settings) |

---

## Open at End of Phase

- Data Lifecycle Matrix and Performance appendices (requested; incorporated into formal docs)
- First physical table DDL (`players`) — started in Prompt 30, continued in subsequent prompts
- `ROUTINE_RUN` entity from Prompt 25 — not explicitly resolved in 26–30
- Resume enforcement partial unique index — convention established, DDL in migrations
- Configuration templates — conceptual only; physical tables in later prompts/docs

---

## Next Phase (agreed)

Physical PostgreSQL schema: full table definitions, constraints, indexes, then Neon migrations (`architecture/docs/database/migrations/`).
