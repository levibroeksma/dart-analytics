<!--
status: historical
scope: design spec — training session phase 1 (warm-up)
read-when: implementing or revisiting the first training-session slice
updated: 2026-09-10
-->

# Training Session — Phase 1 Design: Warm-Up

> Scope: the smallest end-to-end playable slice of `docs/architecture/09-training-routines.md`'s
> Routine/Training/ExerciseEngine architecture — one system-seeded routine containing exactly one
> non-game exercise (Warm-Up), persisted from the start, with client-only pause/abandon.

---

## 1. Scope decisions (from brainstorming)

- Phase 1 exercise: **Warm-Up only** (`09-training-routines.md` §16) — non-analytical, no dart input,
  no `GameEngine` involved. The riskier game-backed-exercise delegation boundary (§11) is deferred.
- **Persisted from the start** — real migration, not a frontend prototype. Matches the root
  `CLAUDE.md` Hard Invariant that an engine-only task must still prove its persisted state shape.
- Routine/exercise schema is **general ordered composition** (§4) even though phase 1 only ever
  inserts one `routine_steps` row — avoids a second migration once a second exercise type exists.
- **One fixed system routine**, no routine picker, no user-created routines (§19–20 deferred).
- **Pause and abandon supported from day 1**, both **client-side only** — nothing about "paused" is
  ever written to the database. This mirrors the existing convention: `activities`' own design
  rationale already states in-progress recovery is client-local and the abandon flow is client-driven.

## 2. Domain model

- `Routine` (template) → existing `routine_templates` / `routine_steps` (migration `0004`, already
  applied), with `routine_steps` gaining the per-step configuration column §3.5 requires (see §3).
- `Training` (runtime) → an `activities` row. No schema change to `activities` itself beyond gaining
  a sibling snapshot table (see §3) — no FK to the routine template, per the Template Layer's own
  rule that no runtime table holds a foreign key to a template.
- `Exercise Type` (§3.4) → a new `exercise_types` row; it selects the `ExerciseEngine` and the
  exercise ruleset. `GAME` is one exercise type among many, not a layer above them.
- `Exercise` (runtime) → an `exercise_sessions` row, generalized to admit non-game exercises.
- `WarmUpEngine` implements the new `ExerciseEngine` contract (§9–10 of `09-training-routines.md`),
  parallel to `GameEngine` (Pattern 18) — not built on top of a `GameEngine`. Its ruleset
  (`WARM_UP_V1`) is an *exercise* ruleset, tracked separately from game rulesets (§24).
- Lifecycle: `activities.status_id` stays `ACTIVE → COMPLETED / ABANDONED`, unchanged. No `PAUSED`
  status is added anywhere. Pause is an Alpine store persisting `{activityId, exerciseSessionId,
  pausedAt}` to `localStorage`; resume rehydrates through the same `create(config, prior)` replay
  path already used for page-refresh recovery today.

## 3. Data model — migration `0027`

Existing applied schema already anticipates the composition half of this (migration `0004_templates.sql`:
`exercise_templates`, `routine_templates`, `routine_steps`; `04-Runtime-Layer.md`'s design rationale
for `activities`: *"one activity can contain multiple exercise sessions (for example a routine run
executing several exercises)"*). Two gaps remain, both from `09-training-routines.md`:

- every game-type-bound column across the template and runtime layers is `NOT NULL`, forcing a game
  abstraction onto a non-game exercise — contradicting §12;
- `routine_steps` carries only a duration, so it cannot express the per-step **Routine Exercise
  Configuration** that §3.5 / §4 / §18 require (targets, sequences, patterns, game selection).

Resolution: introduce an `exercise_type_id` discriminator and a separate exercise-ruleset table,
relax the game-bound columns to nullable, and put configuration on the routine step.

### Design rules this migration follows

- **Exercise type is a growing catalog, not a fixed enum.** §26 makes each new exercise type ship with
  its own ruleset, engine and configuration schema — structurally identical to `game_types`, which is
  UUID for exactly that reason. SMALLINT stays reserved for fixed structural enums (`stage_types`,
  `capture_modes`, `input_modes`).
- **Exercise rulesets and game rulesets are distinct.** §24 lists `ExerciseRuleset` and `GameRuleset`
  as separate components, and §11's path (`ExerciseEngine → GameEngine → Game Ruleset`) has both live
  at once. A single `ruleset_version_id` column cannot hold two values, so exercise rulesets get their
  own table rather than a discriminator on `ruleset_versions`.
- **No CHECK constraint names a specific exercise type.** Constraints assert column *pairings*, never
  `exercise_type_id = <GAME>`; a literal id in DDL would have to be revisited for every new type.
- **Dart capture is independent of game binding.** `SWITCHING` (§17) takes dart observations with no
  game engine, so `capture_mode_id`/`input_mode_id` are constrained separately from `game_type_id`.

### Changes

1. **New `exercise_types`** (UUID PK, same shape as `game_types`): `id`, `implementation_key`, `name`,
   `description`, `is_published`, `created_at`, `updated_at`. Seed: `GAME`, `WARM_UP`.
2. **New `exercise_ruleset_versions`** (UUID PK, mirrors `ruleset_versions`): `id`,
   `exercise_type_id UUID NOT NULL REFERENCES exercise_types RESTRICT`, `implementation_key`,
   `version_number`, `description`, `created_at`. Seed: `WARM_UP_V1`.
3. **`exercise_templates`** (applied, currently empty): add
   `exercise_type_id UUID NOT NULL REFERENCES exercise_types RESTRICT`; relax `game_type_id` to
   nullable (the FK and its RESTRICT are kept — deleting a game type stays blocked while templates
   reference it); add `default_configuration JSONB` (nullable) for the §5 defaults/constraints an
   exercise type provides.
4. **`routine_steps`** (applied, currently empty): add `configuration JSONB` (nullable) — the §3.5
   Routine Exercise Configuration. `duration_type_id`/`duration_value` stay as dedicated columns
   (§5 duration is structural and queried); everything else contextual lives in the JSONB. Resolution
   merges `exercise_templates.default_configuration` with this, giving §21 adaptive resolution a place
   to land with no further schema change.
5. **`exercise_sessions`** (applied, non-empty — the one real data backfill in this migration):
   - add `exercise_type_id UUID NOT NULL REFERENCES exercise_types RESTRICT`, backfilled to `GAME`
     for every existing row (a standalone game is an exercise of type `GAME`);
   - add `exercise_ruleset_version_id UUID` (nullable, RESTRICT) — set for every exercise run inside a
     training, NULL for a standalone game session;
   - relax `game_type_id`, `ruleset_version_id`, `capture_mode_id`, `input_mode_id` to nullable;
   - `CHECK ((game_type_id IS NULL) = (ruleset_version_id IS NULL))` — a game binding is all-or-nothing;
   - `CHECK ((capture_mode_id IS NULL) = (input_mode_id IS NULL))` — dart capture is all-or-nothing,
     and independent of the game pair.

   Warm-Up sets `exercise_ruleset_version_id` only; a standalone 501 sets the game pair and capture
   pair only; a 501-inside-a-routine sets all four.
6. **`exercise_sessions`**: add `routine_step_sequence_number INTEGER` (nullable, no FK) — records
   "this was step N of the training", indexing into the snapshot of (7) without referencing the
   mutable `routine_steps` row.
7. **New `activity_configurations`** (UUIDv7, 1:1 CASCADE on `activities`, JSONB `configuration`) —
   mirrors `exercise_configurations` exactly: the §18 **Resolved Training Configuration**, a snapshot
   of the resolved routine (name + ordered resolved step list, post-resolution) copied at Training
   start, never a live reference. This is what lets `activities` know which routine it ran without
   violating the "no runtime FK to a template" rule.
8. **`stage_types`**: seed id `6` `EXERCISE_SECTION` ("Timed section inside an exercise"). Warm-Up
   writes one flat row per phase (`sequence_number` 1–5, `parent_stage_id` NULL) directly under the
   exercise session — the session already represents the exercise, so no grouping row is created.
   `EXERCISE_BLOCK` (id 5) is left untouched and unused, reserved for a routine-level grouping if one
   is ever needed. `stage_types` is a genuine fixed structural enum, so SMALLINT is correct here.
9. **Seed** (new seed file, not part of the migration): one system `routine_templates` row
   (`is_system_template = TRUE`, `player_id = NULL`), one `exercise_templates` row
   (`exercise_type_id = WARM_UP`, `game_type_id = NULL`, `default_configuration` holding the
   five-phase list `Upper/Lower/Right/Left/Bull`, §16), one `routine_steps` row linking them with
   `duration_type_id = MINUTES` and a NULL `configuration` (phase 1 overrides nothing), and the
   `WARM_UP_V1` `exercise_ruleset_versions` row.
10. **Deliberately untouched**: `ruleset_versions` and `configuration_templates` keep their current
    `NOT NULL game_type_id`. Both are game-scoped by definition — exercise rulesets live in (2), and
    `configuration_templates` is the §19 named-preset concept, not the per-step configuration of (4).
11. Doc updates required alongside: `05-Database/06-Spec/01-Reference-Layer.md` (new
    `exercise_types`, `exercise_ruleset_versions`, `EXERCISE_SECTION`),
    `05-Database/06-Spec/02-Template-Layer.md`, `05-Database/06-Spec/04-Runtime-Layer.md`
    (docs-first per `docs/CLAUDE.md`).

## 4. Engine / orchestration

- New `app/src/modules/exercise/` tree, parallel to `modules/game/`: `warm-up.engine.module.ts`,
  `engine.registry.ts` (ExerciseEngine registry keyed by *exercise* ruleset-version key, e.g.
  `"WARM_UP_V1"`, mirroring `modules/game/engine.registry.ts`), `types.ts`.
- `WarmUpEngine` state: `{currentPhaseIndex, overallElapsed, completed}`. No dart-shaped `record()` —
  advancement is time/tap-driven (`advancePhase()`). Facts (`ExerciseStarted` /
  `ExerciseSectionChanged` / `ExerciseCompleted`, §15) map onto `exercise_stages` rows using
  `EXERCISE_SECTION` — one flat row per phase, `sequence_number` 1–5, `parent_stage_id` NULL, zero
  `turns`/`darts` rows.
- New thin `TrainingEngine` (`modules/training/training.module.ts`): owns active-exercise index (from
  the `activity_configurations` snapshot), overall elapsed time, creates the `exercise_sessions` row
  (`exercise_type_id = WARM_UP`) when a step starts, marks the parent `activities` row `COMPLETED`
  when the last exercise completes. Built to the general §8 orchestration shape even though phase 1
  has exactly one step.
- **Routine-composition validator** owns §7's *"a routine may not exceed 60 minutes"* rule: it sums
  `routine_steps` durations and rejects a routine over the cap. It cannot be a DB CHECK (cross-row
  sum), and it is not a trigger (no precedent in this repo). Phase 1 seeds the only routine, so the
  validator ships as a pure function with unit tests and is wired into routine writes when §20
  user-created routines land.
- Same Pattern 18 discipline: config-driven construction, `create(config, prior)` rehydration, pure
  `state()`/`facts()`, no aliased internals.

## 5. Frontend

- No setup page — one fixed routine, nothing to configure. Entry point: a single "Start Warm-Up"
  card (on `/games` or a minimal new `/training` landing route) — not a `training-visibility.ts`
  registry, since a registry for one entry is premature abstraction (§27); add one at the second
  routine.
- `app/src/pages/training/play/index.astro` mounts `x-data="warmUpTrainingPlay()"`.
- `app/src/lib/training/warm-up-play.data.ts` (new `lib/training/` domain folder, `@lib/training/`
  alias) — drives the engines, exposes phase/timer state, pause/resume/abandon actions, triggers the
  phase-transition sound ping.
- `app/src/components/layout/training/interfaces/WarmUp.astro` — phase name, timer, pause/abandon
  controls, reusing existing shells/`Button.astro`.
- `app/src/components/layout/training/result-modals/WarmUpResults.astro` — completion summary (total
  time, phases completed).
- `register-route-data.ts` gains one import + one `Alpine.data(...)` call.

## 6. Sub-phasing (landable steps, branch-stack-cap respected)

1. **Schema** — migration `0027` + seed + doc updates + verification scripts. Fully additive and
   backward-compatible; nothing else depends on landing before it, and no existing game path changes.
   Lands first.
2. **Engine + validators** — `modules/exercise/`, `modules/training/`, the `WARM_UP_V1` configuration
   validator and the routine-composition (60-minute cap) validator, unit tests. Depends on (1)'s
   seeded exercise types, exercise ruleset and `EXERCISE_SECTION` stage type. No route, no UI yet.
3. **API** — start-training / advance-phase / complete / abandon endpoints, extending the existing
   session-lifecycle endpoints where possible. Depends on (2).
4. **Frontend** — route, controller, components, pause store, sound ping, route-data wiring. Depends
   on (3). First end-to-end playable slice.
5. **Context maintenance** — mandatory `context-maintenance` skill run; `FINDINGS.md` gets the
   `09-training-routines.md` frontmatter (`status: canonical`) vs. body (*"Status: Proposed
   architectural design"*) mismatch, noticed during this design but out of scope to fix here.

(1) is worth keeping as its own PR since it's the one step safe to ship alone and de-risks everything
after it; (2)+(3) or (3)+(4) can be combined if a schema-only PR with zero consumers is undesirable.

## 7. Open items to verify during planning (not blocking this design)

- Whether the existing per-session abandon endpoint can be called against an `exercise_sessions` row
  belonging to a training (vs. a standalone game) without changes, and whether a second call is needed
  against `activities` or whether one call already cascades.
- Whether a sound-ping utility already exists to reuse for phase transitions, or needs to be added.
