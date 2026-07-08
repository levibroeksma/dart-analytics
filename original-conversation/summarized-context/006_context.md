# Context Summary — Prompts 31–35

**Handoff note:** This phase translates the frozen conceptual model into physical PostgreSQL table design — identity, reference, template, and the start of the runtime layer. Builds on `001_context.md` through `005_context.md`.

**Formal outputs:** Table definitions, migrations, design rules, and the split documentation set live in `architecture/docs/`. This file captures conversational decisions and pivots — not the full DDL or spec documents.

---

## Phase Objective

Begin **table-by-table physical schema design** with a freeze-review process per table. Split the growing Database Design Specification into a multi-document set rather than one chat response.

---

## Documentation Structure Decision (Prompt 31)

Full spec too large for chat. Agreed structure:

```
/docs/database/
  01-database-design-specification.md   ← frozen architecture + appendices + core schema
  02-postgresql-schema.md               ← physical schema
  03-index-strategy.md
  04-analytics-design.md
  05-migration-strategy.md
```

Spec to include: Data Lifecycle Matrix, Performance & Scalability Assumptions, Core Schema & Shared Database Objects (`core` schema, domains, enums, triggers).

**Per-table design process:** define columns → types → constraints → indexes → normalization review → challenge → freeze.

---

## Identity Layer

### `players` (frozen)

- Application profile only — **not** authentication (Neon Auth owns email, password, OAuth)
- `id` UUID PK (app-generated UUIDv7); `auth_user_id` UUID UNIQUE (Neon reference)
- `core.set_updated_at()` trigger for `updated_at`
- Kept despite possible use of `auth_user_id` everywhere — decouples domain from auth provider migration

### Three-identity model (Prompt 32)

Client clarified display name is a **nickname** ("The Power"), not username, not unique.

```
Authentication Identity (Neon) → Application Identity (players) → Public Identity (player_profiles)
```

**Removed `display_name` from `players`.** Moved to `player_profiles` — presentation layer, optional (supports pre-onboarding accounts). Future: avatar, dominant hand, favorite checkout, etc.

### Shared primary key pattern (Prompts 33–34)

1:1 tables use `player_id` as PK (no separate UUID):

- `player_profiles`
- `player_settings`

Advantages: guaranteed 1:1, fewer indexes, better performance.

### `player_settings` + `player_game_settings`

| Table | Scope | Examples |
|-------|-------|----------|
| `player_settings` | Global defaults (one row per player) | timezone, locale, preferred capture mode, preferred input mode |
| `player_game_settings` | Per-game overrides | preferred ruleset, capture/input overrides; `UNIQUE(player_id, game_type_id)` |

**Load algorithm:** game override → else global settings.

**Excluded from DB:** theme and UI cosmetics — frontend only. DB stores domain-behavior settings.

---

## Reference Layer

### Rename: capabilities → features

`game_capabilities` → **`game_features`** + **`game_type_features`** (many-to-many).

Rationale: "feature" describes what a game supports (timed, bot, routines); cleaner than boolean columns (`supports_routines`, `supports_bot`, etc.).

### `game_statuses` lookup table (not boolean `is_published`)

Lifecycle for game types (and later rulesets):

```
DRAFT → TESTING → PUBLISHED → DEPRECATED
```

Supports staging, beta, deprecation — one boolean insufficient. **SMALLINT PK** for tiny stable lookups (not UUID).

Client agreed: lookup table over ENUM for extensibility (e.g. future `BETA`, `ARCHIVED`).

### `game_types`

- `code` — immutable API identifier (X01, TUOD, SINGLES, SCORE, CRICKET)
- `name` — display name (localized later)
- `implementation_key` — renamed from `engine_key`; DB doesn't care if frontend or backend executes
- `game_status_id` FK → `game_statuses`
- `default_ruleset_id` — which ruleset presents on "New Game" (Prompt 34)
- `sort_order`

### `game_features` + `game_type_features`

Feature codes: TIMED, ROUNDS, LEGS, SETS, ANALYTICS, BOT, GUEST, ROUTINES, REPLAY, etc.

Purpose: DB documents game capabilities; frontend/API/admin query without hardcoding. REPLAY as feature allows future lightweight non-replay modes.

### Reference table standardization (Prompt 34)

Developer-managed lookups share base pattern where applicable:

```
id, code, name, description, sort_order, is_system, created_at, updated_at
```

**Rule documented:** `code` is **immutable forever** — API contract. UI shows translated names; joins use IDs.

### `rulesets` (simplified)

Ruleset = **versioned specification identifier**, not a configuration store.

```
id, game_type_id, code, name, version, is_system, is_default(?), game_status_id, published_at, created_at
```

**No configuration values, no JSON.**

| Concept | Answers |
|---------|---------|
| Ruleset | What game logic applies? (TUOD Classic 3-dart vs Beginner 6-dart) |
| Configuration | How was this session configured? (10 rounds vs 15 minutes) |

- Reuses `game_statuses` lifecycle (DRAFT → DEPRECATED)
- `game_types.default_ruleset_id` for current default; historical sessions keep original ruleset FK
- Optionally references **default configuration template** per ruleset

---

## Template Layer (frozen, Prompt 34)

### Three-tier configuration hierarchy

```
Ruleset              → what the game is (immutable logic)
Configuration Template → how it usually starts (recommended defaults)
Session Configuration  → how this session was actually played (immutable snapshot)
```

Pattern mirrors Specification → Template → Execution (IDEs, CI/CD, cloud platforms).

### `configuration_templates`

Single table with ownership model:

```
owner_type: SYSTEM | PLAYER
player_id (nullable for SYSTEM)
game_type_id, ruleset_id, name
```

Player favorites ("My Tournament Setup") and developer presets in one table — no duplication.

Per-game detail tables: `x01_configuration_templates`, `tuod_configuration_templates`, etc. (shared-PK 1:1).

Runtime mirrors with immutable snapshot tables.

### Routine steps reference templates

```
Routine Step → Configuration Template (not Ruleset directly)
```

Routine says "run this configuration" without knowing game internals.

### Critical rule: runtime never FKs to templates

On session start: **copy** template values into snapshot. No `configuration_template_id` FK on `exercise_sessions` (revised in Prompt 35).

Replay must not depend on mutable templates. Optional provenance metadata (template code/version) informational only.

**Reference + Template layer frozen** at 10/10 before runtime.

---

## Runtime Layer (started, Prompt 35)

### Activities as containers

Activity = **everything the player intended to do** — not gameplay itself.

- Routine evening: one activity, multiple exercises
- Casual 501: one activity, one exercise child
- Same abstraction for both

### `activity_types` lookup

```
PRACTICE | MATCH | TOURNAMENT | ROUTINE | CUSTOM
```

Replaces relying on `routine_template_id` alone to classify intent. Routine references template; practice has no template; tournament = future expansion.

### `activities` table (proposed)

```
id, player_id, activity_type_id, routine_template_id (nullable),
name (nullable), notes (nullable), status, started_at, completed_at, timestamps
```

`name` / `notes` for user context ("Club Night", "Trying new grip") — future AI analytics enrichment.

### `exercise_sessions` (minimal execution record)

```
id, activity_id, game_type_id, ruleset_id, status, sequence,
capture_mode, started_at, completed_at, timestamps
```

- **No** statistics, scores, averages
- **No** `configuration_template_id` — snapshot only, no template FK
- `sequence` for routine ordering (warmup → singles → scoring → 501)

Reuses same status ENUM as activities: CREATED → IN_PROGRESS → PAUSED → COMPLETED | ABANDONED.

### Participants on exercise, not activity

Opponents vary per exercise within a routine (only last step may be vs guest). `exercise_participants`:

```
participant_type (PLAYER | GUEST | BOT)
player_id, display_name, bot_profile_id (nullable by type)
play_order, is_winner
```

### One active exercise per game type

Partial unique index enforced in DB:

```sql
UNIQUE (player_id, game_type_id) WHERE status IN ('CREATED', 'IN_PROGRESS', 'PAUSED')
```

### No stored `current_stage`

Resume position derived from latest stage → turn → dart. No duplicated state.

### Session recovery

Query non-completed `exercise_sessions` ordered by `updated_at`; load configuration snapshot → stages → turns → darts. No special recovery table.

### Runtime hierarchy (frozen conceptually)

```
Player → Activity → Exercise Session → Configuration Snapshot
    → Exercise Stage → Turn → Dart
```

**Next in chat:** game-specific configuration snapshot tables, `exercise_stages`, `turns`, `darts`.

---

## Table Naming Evolutions

| Earlier | Revised |
|---------|---------|
| `player_profile` | `player_profiles` (plural convention) |
| `player_preferences` | `player_settings` |
| `player_game_preferences` | `player_game_settings` |
| `game_capabilities` | `game_features` |
| `engine_key` | `implementation_key` |
| `activity_sessions` | `activities` (in runtime discussion) |
| `is_published` boolean | `game_statuses` lifecycle |
| `configuration_template_id` on session | Removed — copy-only snapshots |

---

## Change Log vs 005_context.md

| Earlier (005) | Revised (31–35) |
|---------------|-----------------|
| `players.display_name` | Moved to `player_profiles` |
| `game_type_capabilities` | `game_features` / `game_type_features` |
| Ruleset contains config | Ruleset = spec ID only; config in templates/snapshots |
| Configuration templates conceptual | First-class frozen entity with SYSTEM/PLAYER ownership |
| Physical schema not started | Identity + Reference + Template frozen; Runtime started |
| Spec as single document | Split into 5-doc set under `/docs/database/` |

---

## Open at End of Phase

- Game-specific runtime configuration snapshot tables (x01, tuod, singles, score)
- `exercise_stages` + per-game stage tables
- `turns` and `darts` physical DDL
- `ROUTINE_RUN` entity (from Prompt 25) — not addressed in 31–35
- Data Lifecycle Matrix and Performance appendices — requested in 31, incorporated into formal docs
- `bot_profile` table — referenced, not yet designed

---

## Next Phase (agreed)

Complete runtime layer tables (config snapshots, stages, turns, darts), then indexes, views, and Neon migrations (`architecture/docs/database/migrations/`).
