# Context Summary — Prompts 56–58

**Handoff note:** This phase produces the physical schema mapping, final pre-implementation approval, and the first two SQL migrations. Builds on `001_context.md` through `012_context.md`.

**Formal outputs:** `architecture/docs/architecture/05-Database/08-Physical-Schema-Mapping.md`, `09-Pre-Implementation-Review.md`, and `architecture/docs/database/migrations/0001_extensions.sql`, `0002_reference_tables.sql` exist in the repo. This file captures conversational decisions — not full DDL or mapping text.

---

## Phase Objective

Complete **logical → physical mapping**, pass final implementation gate, and **begin the migration chain** with extensions and reference tables.

---

## `08-Physical-Schema-Mapping.md` (Prompt 56)

Role: **implementation blueprint** — how each logical entity becomes PostgreSQL (tables, PKs, FKs, relationship patterns, migration order). Migrations must be generated from this document.

### PostgreSQL standards (frozen in mapping)

| Standard | Choice |
|----------|--------|
| Primary keys | UUIDv7 |
| Timestamps | `TIMESTAMPTZ` always |
| Naming | `snake_case`, FK = `<entity>_id` |
| Schema | `public` initially; optional future split into `reference` / `template` / `runtime` / `analytics` |

### Implementation patterns

- **Shared primary keys** for strict 1:1 (e.g. `player_settings.id` → `players.id`, per-game config extensions)
- **Composite PK** for junction tables (`game_type_features`: `game_type_id` + `game_feature_id`)

### Layer → table mapping (summary)

| Layer | Tables mapped |
|-------|---------------|
| Reference | `game_types`, `game_features`, `game_type_features`, `game_statuses`, `ruleset_versions` |
| Player | `players`, `player_settings` (shared PK) |
| Template | `routine_templates`, `routine_steps`, `exercise_templates`, `game_configurations` + `501_`/`tuod_`/`singles_configurations` |
| Runtime | `activities`, `exercise_sessions`, `exercise_configurations`, `participants`, `exercise_stages`, `turns`, `darts` |

### Proposed migration sequence

```
0001_extensions → 0002_reference_tables → 0003_players → 0004_game_definitions
→ 0005_templates → 0006_runtime_core → 0007_runtime_events
→ 0008_constraints → 0009_indexes → 0010_views → 0011_seed_reference_data
```

### Self-review: 9.6/10 — open before SQL

1. **`exercise_configurations.configuration_json`** vs typed snapshot child tables — affects replay/analytics; needs final decision (mapping draft used JSON; earlier architecture rejected JSON for core gameplay)
2. **`exercise_stages.stage_type`** — verify controlled types cover 501 set/leg, routine blocks, TUOD rounds without becoming generic catch-all
3. **Dart entity** — finalize miss storage, radial/angular, recreational gaps
4. **Analytics** — correctly no statistics tables; views only

**Proposed gate:** `09-Pre-Implementation-Review.md` before `0001_extensions.sql`.

---

## `09-Pre-Implementation-Review.md` (Prompt 57)

Role: **final validation** before PostgreSQL implementation.

### Result

```
APPROVED — ready for physical implementation
```

### Re-confirmed decisions

| Area | Status |
|------|--------|
| Auth isolation | Neon Auth external; DB stores player profile only |
| UUIDv7 + TIMESTAMPTZ | All entities |
| Reference / Template / Runtime layers | Approved |
| Hybrid configuration | `exercise_configurations` + per-game extension tables |
| Ruleset versioning | Immutable `ruleset_versions`; sessions reference execution-time version |
| Darts stored individually | Analytics foundation |
| Capture modes | Recreational (turn score only) and training (per-dart) both valid; missing dart data OK |
| Activity vs exercise_session | Separate lifecycles — kept |
| Stage abstraction | Kept; stage types must remain controlled |
| Analytics | Views only initially — no statistics tables |
| Indexing | Access-pattern driven; no speculative indexes |
| Migrations | One concern per file; seeds separate from schema |
| Future | Teams, online matches, AI coaching — additive extensions |

### Production details deferred (not blockers)

Enum strategy, exact CHECK constraints, retention, backup, monitoring.

---

## First migrations (Prompts 57–58)

### `0001_extensions.sql` — evolution

**Initial draft (Prompt 57):** `pgcrypto` + `pg_stat_statements`. Rejected `uuid-ossp`, `citext`.

**Client decision (Prompt 58):** **Application-generated UUIDv7** (Option B).

| Change | Reason |
|--------|--------|
| **Remove `pgcrypto`** | No `gen_random_uuid()` — IDs from TypeScript before insert |
| **Keep `pg_stat_statements`** | Query monitoring, slow-query analysis, view cost tracking |

### New implementation rule (frozen)

Every `INSERT` must supply `id UUID NOT NULL`. Database never generates IDs.

Aligns with: batch session upload, resumable state, shared IDs across frontend/API/DB, future offline-first.

### `0002_reference_tables.sql` (Prompt 58)

Creates reference layer **schema only** — no seeds, no player/runtime data.

| Table | Purpose |
|-------|---------|
| `game_types` | Game definitions; `implementation_key` UNIQUE |
| `game_features` | Capabilities (timed, rounds, bot, etc.) |
| `game_type_features` | M:N composite PK |
| `game_statuses` | Lifecycle states (ACTIVE, COMPLETED, ABANDONED) |
| `ruleset_versions` | Immutable rules per `game_type_id`; unique `(game_type_id, implementation_key)` and `(game_type_id, version_number)` |

All tables: app-supplied UUID PKs, `implementation_key`, timestamps, comments.

Dependency order: `game_types` → `ruleset_versions`; `game_features` ↔ `game_type_features`.

### Open decision before `0003_players.sql`

**Lookup table PK type:** UUID everywhere (current `0002`) vs `SMALLINT` for immutable lookups?

| UUID | SMALLINT |
|------|----------|
| Consistency, AI maintainability, uniform FK handling | Smaller indexes, faster joins, easier debugging |

Architect noted enterprise pattern often uses UUID for domain + SMALLINT for lookups; UUID-everywhere defensible for this project — **worth freezing before player/runtime tables**.

---

## Draft vs earlier architecture (notable deltas)

The physical mapping draft simplified or diverged in places; pre-implementation review largely reaffirmed earlier decisions:

| Topic | Mapping draft | Prior architecture |
|-------|---------------|------------------|
| Player display name | On `players` | `player_profiles` table (Prompts 31–35) |
| Runtime config | `configuration_json` on `exercise_configurations` | Typed per-game snapshot tables; JSON only for rare overrides |
| Rulesets | `ruleset_versions` | Aligns with review — replaces simpler `rulesets` entity |
| Lookup PKs | UUID in `0002` | Earlier chat suggested SMALLINT for tiny lookups |

Physical migrations and later docs expected to converge on review-approved hybrid model.

---

## Change Log vs 012_context.md

| Earlier (012) | Revised (56–58) |
|---------------|-----------------|
| `08-Physical-Schema-Mapping` next | **Drafted** |
| SQL after mapping | **Pre-implementation review APPROVED** |
| Migrations not started | **`0001` + `0002` drafted** |
| UUIDv7 app-generated (Prompt 37) | **Frozen** — `pgcrypto` removed from `0001` |
| `ruleset_versions` from review | **In `0002` DDL** |
| Next = mapping doc | Next = **`0003_players.sql`** (+ lookup PK decision) |

---

## Open at End of Phase

- Freeze lookup table PK strategy (UUID vs SMALLINT)
- Resolve `configuration_json` vs typed snapshot tables in runtime migrations
- Reconcile `players` / `player_profiles` in `0003`
- `0003_players.sql` through full migration chain
- Seed file separate from `0002` (per migration rules)
- `configuration_json` and dart field finalization in runtime migrations (`0006`/`0007`)

---

## Next Phase (agreed)

1. Decide lookup PK type
2. Draft `0003_players.sql` (and subsequent migrations per mapping order)
3. Reference seed data in dedicated seed migration
