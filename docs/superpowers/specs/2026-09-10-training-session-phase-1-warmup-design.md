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
  applied — see §3).
- `Training` (runtime) → an `activities` row. No schema change to `activities` itself beyond gaining
  a sibling snapshot table (see §3) — no FK to the routine template, per the Template Layer's own
  rule that no runtime table holds a foreign key to a template.
- `Exercise` (runtime) → an `exercise_sessions` row, generalized to admit non-game exercises.
- `WarmUpEngine` implements the new `ExerciseEngine` contract (§9–10 of `09-training-routines.md`),
  parallel to `GameEngine` (Pattern 18) — not built on top of a `GameEngine`.
- Lifecycle: `activities.status_id` stays `ACTIVE → COMPLETED / ABANDONED`, unchanged. No `PAUSED`
  status is added anywhere. Pause is an Alpine store persisting `{activityId, exerciseSessionId,
  pausedAt}` to `localStorage`; resume rehydrates through the same `create(config, prior)` replay
  path already used for page-refresh recovery today.

## 3. Data model — migration `0027`

Existing applied schema already anticipates most of this (migration `0004_templates.sql`:
`exercise_templates`, `routine_templates`, `routine_steps`; `04-Runtime-Layer.md`'s design rationale
for `activities`: *"one activity can contain multiple exercise sessions (for example a routine run
executing several exercises)"*). The gap is that every game-type-bound column across the template and
runtime layers is currently `NOT NULL`, which forces a game abstraction onto a non-game exercise —
contradicting `09-training-routines.md` §12. Resolution (user-selected: most scalable): introduce an
explicit `exercise_type_id` discriminator everywhere `game_type_id` currently is, and relax
`game_type_id` to nullable, populated only when the exercise type is `GAME`.

1. **New `exercise_types`** (SMALLINT, seeded reference table, same shape as `capture_modes` /
   `input_modes`): `id`, `implementation_key`, `name`, `created_at`. Seed: `GAME`, `WARM_UP`.
2. **`exercise_templates`** (applied, currently empty): add `exercise_type_id SMALLINT NOT NULL
   REFERENCES exercise_types RESTRICT`; relax `game_type_id` to nullable; add
   `CHECK (exercise_type_id = <GAME> ⟺ game_type_id IS NOT NULL)` (same pattern as the existing
   PLAYER/DartBot participant CHECK from migration `0005`).
3. **`configuration_templates`** (applied): same treatment as (2).
4. **`ruleset_versions`** (applied): same treatment as (2) — every exercise, game or not, still has a
   ruleset version per §9.
5. **`exercise_sessions`** (applied, non-empty — the one real data backfill in this migration): add
   `exercise_type_id SMALLINT NOT NULL`, backfilled to `GAME` for every existing row; relax
   `game_type_id` / `capture_mode_id` / `input_mode_id` to nullable (dart capture is meaningless for
   Warm-Up); `ruleset_version_id` stays `NOT NULL`. Same CHECK pattern, extended to cover
   `capture_mode_id`/`input_mode_id` alongside `game_type_id`.
6. **`exercise_sessions`**: add `routine_step_sequence_number INTEGER` (nullable, no FK) — records
   "this was step N of the training" without referencing the mutable `routine_steps` row.
7. **New `activity_configurations`** (UUIDv7, 1:1 CASCADE on `activities`, JSONB `configuration`) —
   mirrors `exercise_configurations` exactly: a snapshot of the resolved routine (name + ordered step
   list) copied at Training start, never a live reference. This is what lets `activities` know which
   routine it's running without violating the "no runtime FK to a template" rule.
8. **Seed** (new seed file, not part of the migration): one system `routine_templates` row
   (`is_system_template = TRUE`, `player_id = NULL`), one `exercise_templates` row
   (`exercise_type_id = WARM_UP`, `game_type_id = NULL`), one `routine_steps` row linking them, one
   `configuration_templates` row holding the five-phase list (`Upper/Lower/Right/Left/Bull`, §16) as
   JSONB, and the `WARM_UP_V1` `ruleset_versions` row.
9. Reuse the **already-seeded** `stage_types.id = 5` (`EXERCISE_BLOCK`, *"Individual routine exercise
   block"*) for each Warm-Up phase's `exercise_stages` row — no new stage type needed.
10. Doc updates required alongside: `05-Database/06-Spec/02-Template-Layer.md`,
    `05-Database/06-Spec/04-Runtime-Layer.md` (docs-first per `docs/CLAUDE.md`).

## 4. Engine / orchestration

- New `app/src/modules/exercise/` tree, parallel to `modules/game/`: `warm-up.engine.module.ts`,
  `engine.registry.ts` (ExerciseEngine registry keyed by ruleset-version key, e.g. `"WARM_UP_V1"`,
  mirroring `modules/game/engine.registry.ts`), `types.ts`.
- `WarmUpEngine` state: `{currentPhaseIndex, overallElapsed, completed}`. No dart-shaped `record()` —
  advancement is time/tap-driven (`advancePhase()`). Facts (`ExerciseStarted` /
  `ExerciseSectionChanged` / `ExerciseCompleted`, §15) map onto `exercise_stages` rows using
  `EXERCISE_BLOCK` — one row per phase, `sequence_number` 1–5, zero `turns`/`darts` rows.
- New thin `TrainingEngine` (`modules/training/training.module.ts`): owns active-exercise index (from
  the `activity_configurations` snapshot), overall elapsed time, creates the `exercise_sessions` row
  (`exercise_type_id = WARM_UP`) when a step starts, marks the parent `activities` row `COMPLETED`
  when the last exercise completes. Built to the general §8 orchestration shape even though phase 1
  has exactly one step.
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
2. **Engine + validator** — `modules/exercise/`, `modules/training/`, `WARM_UP_V1` validator, unit
   tests. Depends on (1)'s seeded stage/exercise types. No route, no UI yet.
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
