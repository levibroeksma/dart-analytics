# Context Summary — Prompts 54–55

**Handoff note:** This phase drafts the canonical data model and runs a formal design-gate review before SQL implementation. Builds on `001_context.md` through `011_context.md`.

**Formal outputs:** `architecture/docs/architecture/05-Database/06-Data-Model.md`, `07-Data-Model-Review.md`, and later `08-Physical-Schema-Mapping.md` exist in the repo. This file captures conversational decisions — not full entity specs or DDL.

---

## Phase Objective

Bridge **architecture rules → canonical schema → review → physical mapping → migrations**. SQL remains blocked until the model passes review.

---

## `06-Data-Model.md` (Prompt 54)

Role: **canonical domain model specification** — every entity, ownership, relationships, lifecycle, modelling decisions, and ERD. **No SQL.**

Readers should know exactly what to create in `database/migrations/` without inferring from governance docs alone.

### Design principle (restated)

```
Store what happened. Derive what it means.
```

### Four layers (entity map)

| Layer | Entities drafted |
|-------|------------------|
| **Reference** | `game_types`, `game_features`, `game_type_features`, `game_statuses`, `input_modes`, `capture_modes` |
| **Player** | `players`, `player_settings` (shared PK 1:1) |
| **Template** | `routine_templates` (system + user), `routine_steps`, `exercise_templates`, `game_configurations` |
| **Runtime** | `activities`, `exercise_sessions`, `exercise_configurations`, `participants`, `exercise_stages`, `turns`, `darts` |
| **Analytics** | Views / materialized views (not tables) |

### Key modelling statements in draft

- **Players:** app-owned identity; auth external (Neon). Display name = nickname, not unique, not username (note: earlier prompts moved display name to `player_profiles` — draft still mentions on `players`; resolved in review/mapping phase).
- **Activities:** created on gameplay start; supports refresh recovery, abandonment, usage analytics. Rule stated: one active activity per game type (later refined to exercise session in review).
- **Exercise sessions:** executed game/exercise; 1 activity → N sessions.
- **Exercise configurations:** immutable snapshot; 1:1 with session.
- **Participants:** player, guest, DartBot; opponent detail optional; outcome relevance only.
- **Exercise stages:** structural parts (501 set/leg; training blocks).
- **Turns:** one oche visit; up to 3 darts.
- **Darts:** smallest performance unit; stores dart number, target, hit, multiplier, score, timestamp — foundation for all advanced analytics.

### Mermaid ERD included

Core chain: `PLAYERS → ACTIVITIES → EXERCISE_SESSIONS → EXERCISE_STAGES → TURNS → DARTS`, with config snapshot, participants, game types, routines.

### Self-review: 9.5/10

Explicitly **not SQL yet**. Four areas flagged for review pass:

1. Activity vs exercise session — purpose and cardinality
2. `exercise_stage` — can one abstraction cover 501 legs and routine blocks?
3. Configuration — generic `game_configurations` vs per-game child tables
4. Dart entity — exact fields (target, multiplier, miss direction, recreational gaps)

**Proposed next:** `07-Data-Model-Review.md` — stress-test before migrations.

---

## `07-Data-Model-Review.md` (Prompt 55)

Role: **design gate** — stress-test model against edge cases, future requirements, scalability. Outcomes: approve, adjust, or document accepted trade-offs.

### Review result

```
APPROVED WITH REVISIONS
```

Overall architecture strong; refinements required before PostgreSQL implementation.

### Fifteen review decisions (summary)

| # | Topic | Decision |
|---|-------|----------|
| 1 | Activity vs exercise session | **Keep both.** Activity = user interaction / resumable container; exercise session = actual gameplay / historical record. Activity may contain multiple exercises, may be abandoned. |
| 2 | One active session per game type | **Maintain.** Partial unique index on `(player_id, game_type_id) WHERE status = ACTIVE`. |
| 3 | Browser refresh recovery | **Supported.** DB holds recovery source (activity, stage, turn state, config snapshot); frontend owns temp state during play. |
| 4 | Game configuration | **Hybrid model.** Shared `exercise_configuration` parent + per-game children (`501_configuration`, `tuod_configuration`, `singles_configuration`). Reject one wide table with game-specific nullable columns. |
| 5 | Ruleset versioning | **Add `ruleset_versions`.** Chain: `game_type → ruleset_version → configuration_snapshot → exercise_session`. Historical sessions unaffected when rules evolve. |
| 6 | Routine composition | **Approved** `routine_templates → routine_steps` with `sequence_number`. Steps reference exercise template + configuration. |
| 7 | Nested routines | **Not initially.** Avoid recursion/complex UI; future `routine_components` if needed. |
| 8 | Detailed dart capture | **Store individual darts.** Minimum: `dart_number`, `target_number`, `multiplier`, `score`, `result_type`. Optional future: coordinates, board section. |
| 9 | Recreational vs training | **Support incomplete granularity.** Recreational may store turn-level score only without per-dart rows; model must allow missing dart detail. |
| 10 | Opponents | **Participants table.** Types: PLAYER, GUEST, DARTBOT — lightweight, future multiplayer ready. |
| 11 | DartBot | **Supported.** Future `bot_configuration` additive. |
| 12 | Statistics reliability | **Verified derivable** from darts, turns, sessions + config. |
| 13 | Game extension | New game = game_type + features + config model + views + frontend engine — no runtime redesign. |
| 14 | Commercial expansion | **No multi-tenancy now.** `player_id` isolation; `organization_id` addable later. |
| 15 | Immutable history | **Approved.** Snapshots store config, ruleset version, gameplay events for replay. |

### Required model changes (before SQL)

| Action | Detail |
|--------|--------|
| **Add** | `ruleset_versions` |
| **Split** | `game_configurations` → `exercise_configuration` + per-game configuration tables |
| **Confirm** | `capture_mode` on exercise sessions |

### Final approved entity list

```
Reference:  game_types, game_features, ruleset_versions, statuses
Template:   routine_templates, routine_steps, exercise_templates
Runtime:    activities, exercise_sessions, exercise_configurations,
            participants, stages, turns, darts
Analytics:  views, materialized views
```

### Review improvements vs `06-Data-Model` draft

- Ruleset versioning made explicit (largest gap)
- Configuration split formalized
- Activity vs session separation justified
- Partial data capture (recreational) formalized

### Proposed next artifact

**`08-Physical-Schema-Mapping.md`** — maps conceptual entity → logical entity → PostgreSQL table → migration file. After that, migration generation becomes mechanical.

**SQL still not written** in this range.

---

## Change Log vs 011_context.md

| Earlier (011) | Revised (54–55) |
|---------------|-----------------|
| `06-Data-Model.md` identified as gap | **Drafted** with full entity catalogue + ERD |
| SQL blocked on data model | Model **reviewed**; approved with revisions |
| `rulesets` from earlier prompts | Review adds **`ruleset_versions`** chain explicitly |
| Hybrid config discussed | **Frozen:** `exercise_configuration` + per-game children |
| Next = write migrations | Next = **`08-Physical-Schema-Mapping.md`**, then migrations |

---

## Inconsistencies noted (draft vs prior decisions)

The `06-Data-Model` first draft simplified some earlier decisions. The review pass realigned:

- `player_profiles` vs `display_name` on `players` — draft 06 conflated; physical mapping expected to follow Prompt 31–35 split
- `game_configurations` (template) vs `exercise_configurations` (runtime snapshot) — review clarifies hybrid runtime split
- Active session rule — clarified on **exercise_session**, not activity

These are resolved in review required changes, not left open.

---

## Open at End of Phase

- Draft `08-Physical-Schema-Mapping.md`
- Generate `database/migrations/` from frozen mapped model
- Reconcile `06-Data-Model.md` draft with review revisions (entity names, ruleset_versions)
- Holistic 10/10 doc polish pass (still deferred)
- `06-API/` documentation — not started

---

## Next Phase (agreed)

1. **`08-Physical-Schema-Mapping.md`** — entity-to-table-to-migration mapping
2. Mechanical migration file generation
3. Seed data, then API layer
