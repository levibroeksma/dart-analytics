# Context Summary — Prompts 59–63

**Handoff note:** This phase freezes the hybrid ID strategy, splits migrations from seeds, and implements reference through runtime event tables (`0002`–`0006`). Builds on `001_context.md` through `013_context.md`.

**Formal outputs:** Revised migrations and `architecture/docs/database/seeds/0001_reference_data.sql` live in the repo. This file captures conversational decisions and iterative refinements — not full DDL.

---

## Phase Objective

Apply **SMALLINT reference / UUID domain** ID strategy, establish **schema vs seed** split, and build migrations through the runtime event layer (`turns`, `darts`).

---

## Identifier Strategy Frozen (Prompt 59)

Client confirmed earlier agreement:

| Table type | Primary key |
|------------|-------------|
| Domain entities | UUIDv7 (application-generated) |
| Reference / lookup tables | SMALLINT |

### `0002_reference_tables.sql` — first revision

Added missing reference tables required before `player_settings`:

- `capture_modes` — recreational vs analytics capture depth
- `input_modes` — quick score vs detailed dart entry

Existing tables retained: `game_types` (UUID — domain entity, not lookup), `game_features`, `game_type_features`, `game_statuses`, `ruleset_versions`.

Dependency chain validated: `0002` → `0003_players` → `player_settings` (no forward references).

---

## `0003_players.sql` (Prompt 59)

Requested after `0002` revision. Creates:

| Table | Key points |
|-------|------------|
| `players` | UUID PK; `auth_user_id` UNIQUE (Neon Auth); `display_name` on player row (nickname, not unique) |
| `player_settings` | Shared PK `player_id` → `players`; `default_capture_mode_id`, `default_input_mode_id` → SMALLINT FKs |

Note: earlier architecture split `player_profiles` from `players`; implementation in chat/repo consolidated display name onto `players`.

---

## Migrations vs Seeds — Option B Frozen (Prompts 59–60)

**Rejected:** `0004_game_definitions.sql` inserting game data inside migrations.

**Adopted:**

> Migrations define structure. Seeds define controlled application data.

### Final layout

```
database/migrations/     — schema only
database/seeds/          — controlled reference data + default templates
```

### Revised migration sequence

```
0001_extensions
0002_reference_tables
0003_players
0004_templates
0005_runtime_core
0006_runtime_events
0007_constraints
0008_indexes
0009_views
```

### Seed files

- `0001_reference_data.sql` — statuses, modes, features, game types, feature mappings, ruleset versions
- `0002_default_templates.sql` — system routines (later)

### Seed rules

- **Explicit fixed IDs** for SMALLINT rows (identical across environments)
- **Fixed UUIDs** for seeded domain entities (`game_types`, `ruleset_versions`)
- `INSERT ... ON CONFLICT DO NOTHING` — idempotent, deterministic

---

## `seeds/0001_reference_data.sql` (Prompt 61)

Inserts controlled domain data (not test/user data):

| Category | Examples |
|----------|----------|
| `game_statuses` | ACTIVE, COMPLETED, ABANDONED |
| `capture_modes` | RECREATIONAL, ANALYTICS |
| `input_modes` | QUICK_SCORE, DETAILED_DARTS |
| `game_features` | TIMED_MODE, ROUNDS_MODE, OPPONENT_SUPPORT, DARTBOT_SUPPORT, DOUBLE_OUT |
| `game_types` | 501, TUOD, SINGLES_TRAINING, SCORE_TRAINING (fixed UUIDs) |
| `game_type_features` | Per-game feature mappings |
| `ruleset_versions` | v1 ruleset per game type |

**Design observation:** Game config defaults (e.g. "501 = 3 legs") do **not** belong in reference seeds. Correct flow: game type exists → default template/configuration layer → runtime snapshot.

---

## `0004_templates.sql` (Prompt 61)

Template layer tables:

- `exercise_templates` — reusable exercises; `game_type_id`; `is_system_template`
- `routine_templates` — composable routines; optional `player_id` (NULL = system)
- `routine_steps` — ordered composition; `exercise_template_id`, `sequence_number`, duration fields

**Issue flagged:** `routine_steps.duration_type TEXT` — should be `duration_type_id SMALLINT` FK to reference table (matches finite controlled-set rule).

---

## `0002` revision — `duration_types` (Prompt 62)

Added `duration_types` (ROUNDS, MINUTES) to reference layer. Seeds updated. `routine_steps` uses `duration_type_id SMALLINT NOT NULL` with FK.

Rule reinforced:

> If a value controls application behaviour and has a finite controlled set, it belongs in a reference table.

---

## `0005_runtime_core.sql` (Prompt 62)

Runtime foundation — actual gameplay history.

| Table | Purpose |
|-------|---------|
| `activities` | User interaction lifecycle; `status_id` → `game_statuses`; refresh recovery |
| `exercise_sessions` | Executed game; links activity, player, game type, capture/input modes, status, `ruleset_version_id` |
| `exercise_configurations` | Immutable snapshot; **1:1 with session** |
| `participants` | PLAYER / GUEST / DARTBOT involvement |
| `exercise_stages` | Hierarchical subdivisions; `parent_stage_id` self-FK; `sequence_number` |

### Tension: `exercise_configurations.configuration JSONB`

Runtime migration uses JSONB for config snapshot. Earlier architecture preferred typed per-game child tables (`501_configuration`, etc.). Flagged in Prompt 56 review — not resolved in this range; hybrid typed tables may still be added in constraints layer or later revision.

### Issues flagged post-draft

`participant_type TEXT` and `stage_type TEXT` → should become `participant_types` and `stage_types` reference tables before event tables.

---

## `0002` + `0005` revision — participant & stage types (Prompt 63)

Added to reference layer:

| Table | Values |
|-------|--------|
| `participant_types` | PLAYER, GUEST, DARTBOT |
| `stage_types` | MATCH, SET, LEG, ROUND, EXERCISE_BLOCK |

Seeds updated with explicit SMALLINT IDs.

**`0005` updated:**

- `participants.participant_type_id SMALLINT NOT NULL` → FK
- `exercise_stages.stage_type_id SMALLINT NOT NULL` → FK

---

## `0006_runtime_events.sql` (Prompt 63)

Gameplay event model — analytics foundation.

```
exercise_session → exercise_stage → turn → dart
```

| Table | Columns (summary) |
|-------|-------------------|
| `turns` | `exercise_stage_id`, `participant_id`, `sequence_number`, `total_score`, `created_at` |
| `darts` | `turn_id`, `dart_number` (1–3), `target_number`, `multiplier`, `score`; CHECK constraints on ranges |

Turn = one oche visit by one participant. Dart = one physical throw.

### Gap flagged before `0007_constraints.sql`

Current `darts` captures `target_number`, `multiplier`, `score` only — missing for analytics mode:

- intended target
- miss direction (radial/angular from earlier design)
- training metadata

Recreational games OK with less. Options: extend `darts` or add `dart_details` — **review required** before constraints migration.

---

## Reference layer inventory (end of Prompt 63)

`0002` now includes:

```
game_types (UUID)
game_features, game_type_features
game_statuses, capture_modes, input_modes
duration_types, participant_types, stage_types
ruleset_versions (UUID)
```

---

## Implementation order at end of range

| Step | Artifact | Status in chat |
|------|----------|----------------|
| 1 | `0001_extensions` | Done (pg_stat_statements only) |
| 2 | `0002_reference_tables` | Revised multiple times |
| 3 | `0003_players` | Drafted |
| 4 | `seeds/0001_reference_data` | Drafted |
| 5 | `0004_templates` | Drafted |
| 6 | `0005_runtime_core` | Drafted, revised |
| 7 | `0006_runtime_events` | Drafted |
| 8 | `0007_constraints` | Next — after dart model review |

---

## Change Log vs 013_context.md

| Earlier (013) | Revised (59–63) |
|---------------|-----------------|
| Lookup PK type open | **SMALLINT frozen** for references |
| `0002` UUID for all lookups | **Hybrid:** SMALLINT lookups, UUID domain |
| Game data in migration debated | **Seeds only** for reference data |
| `0003` next | `0003`–`0006` drafted in sequence |
| Typed config snapshots | **JSONB** used in `0005` (unresolved tension) |
| `duration_type` TEXT on routine steps | **`duration_types` lookup** |
| Participant/stage as TEXT | **`participant_types`, `stage_types` lookups** |

---

## Open at End of Phase

- Dart model extension (intended target, miss direction) before `0007_constraints`
- `exercise_configurations` JSONB vs typed per-game snapshot tables
- `0007_constraints`, `0008_indexes`, `0009_views`
- `seeds/0002_default_templates.sql`
- Partial unique index for one active session per game type (deferred to constraints)
- `remaining_before`/`remaining_after` on turns (discussed in Prompt 36, not in `0006` draft)

---

## Next Phase (agreed)

1. Review and finalize dart entity fields
2. `0007_constraints.sql`
3. `0008_indexes.sql`, `0009_views.sql`
