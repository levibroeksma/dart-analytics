# Context Summary — Prompts 67–71

**Handoff note:** This phase reviews and freezes the **runtime event model** (`turns`/`darts`), applies schema changes to existing migrations (`0002`, `0006`), and drafts integrity (`0007`) and performance (`0008`) layers. Builds on `001_context.md` through `015_context.md`.

**Formal outputs:** Updated `0002_reference_tables.sql`, `0006_runtime_events.sql`, `0007_constraints.sql`, `0008_indexes.sql`, and seed data for `dart_zones` already exist in the repo (or partially — validate against this summary). Do **not** regenerate; use `000_master_context.md` validation checklist when reconciling.

---

## Phase Objective

Harden the **Session → Stage → Turn → Dart** event chain for analytics, replay, and interrupted play — then add constraint and index migrations driven by real query patterns.

---

## Runtime Event Model Review (Prompt 67)

Pre-freeze senior review. Overall: **8.8/10 → 9.8/10** after recommended changes.

### Verdicts by area

| Area | Verdict | Decision |
|------|---------|----------|
| `turns` | Correct | No structural change; turn = single oche visit (501 leg, TUOD round, singles attempt) |
| `darts` | Too minimal | Only stored outcome; missing **intention** — blocks double accuracy, worst doubles, inside/outside misses, recovery |
| Training metadata on darts | Reject | Do not store `miss_direction`, `inside_outside` — derive from intended vs hit |
| Board coordinates | Defer | UI does not capture; nullable `location_x`/`location_y` reserved for future scatter/coaching |
| `dart_number <= 3` CHECK | Remove | Ruleset owns max darts (e.g. TUOD easy = 6); DB must not hard-code 3 |
| `turns.completed_at` | Add | Supports interrupted play (`completed_at IS NULL` = unfinished turn after browser close) |
| `turn.total_score` + `dart.score` | Keep both | **Controlled denormalisation** — visits queried constantly; app controls writes |
| Bull scoring | Fix via zones | `target_number` + `multiplier` insufficient for outer/inner bull distinction |

### Frozen dart model

Replace `target_number` + `multiplier` with:

```
intended_target_number, intended_zone_id
hit_target_number, hit_zone_id
score
```

Supporting reference table **`dart_zones`** (SMALLINT): `SINGLE`, `DOUBLE`, `TREBLE`, `OUTER_BULL`, `INNER_BULL`, `MISS`.

### Capture modes (reaffirmed)

| Mode | Storage |
|------|---------|
| Recreational 501 | `turn.total_score` only; **no dart rows required** |
| Analytics | Full dart rows with intended + hit target and zone |

### Analytics capture strategy

Question posed: intention-only (A) vs physical board placement (B). User agreed to recommendations → **Option A** (target intention); coordinates deferred.

### Post-change capabilities

Single/double/treble accuracy, worst doubles/singles, inside/outside misses, recovery, finish dart number, target progression, replay. Left/right misses reserved for future UI with coordinates.

---

## Implementation Guide (Prompt 68)

User requested a clear change list. Three concentration areas:

### 1. `0002_reference_tables.sql` + seeds

- Add `dart_zones` table (`id SMALLINT`, `implementation_key`, `name`, `description`)
- Seed six zones in `database/seeds/0001_reference_data.sql` (IDs 1–6)

### 2. `0005_runtime_core.sql`

- No structural changes; confirm `stage_type_id` and `participant_type_id` usage

### 3. `0006_runtime_events.sql`

**`turns`:** add `completed_at TIMESTAMPTZ` (nullable).

**`darts`:** replace minimal model with intention+result fields; FKs to `dart_zones` for intended and hit zones; keep `dart_number > 0` only (no upper bound); target numbers `1–25` or NULL when zone NULL.

**Remove:** `multiplier` column; `CHECK dart_number BETWEEN 1 AND 3`.

### Documentation action (agreed)

Update architecture docs to document **controlled denormalisation** for `turn.total_score` + `dart.score`. Freeze `0006` before `0007`.

---

## `0007_constraints.sql` (Prompt 69)

User confirmed files updated; proceed to constraints.

### Migration philosophy (frozen)

> Migrations create tables and basic FKs. Constraint migrations enforce cross-table business integrity. Indexes belong in `0008`.

`0007` adds CHECK constraints, uniqueness, domain invariants — **not indexes**.

### Constraint coverage

| Layer | Examples |
|-------|----------|
| Reference | Non-empty `implementation_key`, names; `uq_game_type_feature` |
| Rulesets | `version_number > 0` |
| Players | Non-empty `display_name` when set |
| Activities / sessions | `completed_at >= started_at` |
| Configurations | `jsonb_typeof(configuration) = 'object'` |
| Participants | `player_id IS NOT NULL OR display_name IS NOT NULL` |
| Stages | Positive sequence; no self-parent |
| Routines | Positive sequence and duration |
| Turns | Positive sequence; `completed_at >= created_at` |
| Darts | Positive `dart_number`; `score >= 0`; zone/target consistency (zone without target invalid) |

### Intentionally omitted (ruleset-owned)

- `CHECK dart_number <= 3` (or any max darts per turn)
- `score <= 180` (or game-specific score caps)

---

## `0008_indexes.sql` (Prompt 70)

Index strategy: **real access patterns**, not blind FK indexing.

### Six critical query flows

1. Resume interrupted session (`player_id` + active status)
2. Completed game replay (session → stage → turn → dart hierarchy, chronological)
3. Player statistics (completed sessions by player, date order)
4. Routine execution (template → steps → exercise templates)
5. Analytics (`darts` filtered by `intended_target_number` + `intended_zone_id`)
6. Historical session lists

### Notable index choices

| Index | Rationale |
|-------|-----------|
| `idx_sessions_active` partial `WHERE completed_at IS NULL` | Active game lookup among thousands of completed rows |
| `idx_darts_intended_target`, `idx_darts_hit_target`, `idx_darts_zone_accuracy` | Target/zone analytics |
| `idx_turns_stage_sequence`, `idx_stages_session_sequence` | Replay traversal |
| No index on every FK | e.g. `participants.player_id` omitted — queries filter by `exercise_session_id` |

### Anti-patterns (reaffirmed)

- No redundant indexes on PK columns (Postgres creates them)
- No premature materialized views, aggregation tables, or warehouse patterns
- Measure first; optimize later

### Layer status after `0008`

Reference, Template, Runtime, Integrity, Performance layers complete. **Next:** `0009_views.sql` as stable API read contract (may already exist — validate alignment with revised dart model).

---

## Change Log vs 015_context.md

| Earlier (015) | Revised (67–71) |
|---------------|-----------------|
| Views assume extended dart model | **Dart model formally reviewed and frozen** with `dart_zones`, intended/hit fields |
| `0007`–`0008` listed as next | **`0007_constraints` and `0008_indexes` drafted** with explicit philosophy |
| Doc sync on `00-Overview` in progress | Parallel track: **runtime hardening** before full doc pass continues |
| `dart_zones` deferred since Prompt 37 | **`dart_zones` added** to reference layer + seeds |
| Turn = `total_score` only | **`completed_at` added**; controlled denormalisation documented |

---

## Open at End of Phase

- Validate existing `0002`/`0006`/`0007`/`0008` files against this summary (do not regenerate)
- Ensure `0009_views` references frozen dart columns (`intended_*`, `hit_*`, `dart_zones`)
- Document controlled denormalisation in `02-Design-Rules` / `06-Data-Model`
- Continue `05-Database/` doc sync (`01`–`09`, `10-Database-Agent-Guide`)
- Final requirements traceability review

---

## Next Phase (agreed)

1. Draft or validate `0009_views.sql` against revised event model
2. Continue doc-by-doc review (`01-Naming-Conventions.md` onward)
3. API architecture (`06-API/`), repository contracts, service boundaries
