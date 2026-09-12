<!--
status: historical
scope: design spec — making Balanced Training playable (orchestration/API/UI layer)
read-when: implementing the training-session service, /api/training-sessions, or the Balanced Training play page
updated: 2026-09-12
-->

# Making Balanced Training Playable — Design

## 1. Problem

Balanced Training's data model, seed, and every exercise engine it needs
(`WarmUpEngine`, `SwitchingEngine`, `DoublePatternEngine`, the existing TUOD
`GameEngine`) already exist and are tested. There is no orchestration,
persistence, or UI layer on top of them: `RoutineDetail.astro`'s Start button
is hardcoded `disabled` (`ariaLabel="Start — coming soon"`). This spec covers
only that missing layer — nothing in the schema or engines changes.

## 2. Scope decisions (confirmed)

- **Full persistence from the first playable version.** Each step writes a
  real `exercise_sessions` row and its facts as it is played, not a
  deferred/batched summary. Matches every other game in the app.
- **Finishing step reuses the existing TUOD play UI in place**, pre-configured
  from the routine step's own `configuration`, rather than a dedicated
  in-routine screen.
- **Switching / Double Pattern reuse the existing visual dartboard capture
  path** (`DartBoard.astro` + `BoardMagnifier.astro` + `boardInputData()`),
  not a new tap-UI.
- **Warm-Up intentionally produces no dart/turn facts.** This is the
  architecture (`09-training-routines.md` §16 — "a deliberate example of a
  non-analytical exercise... should not invent artificial performance
  metrics"), not a gap. Its `exercise_sessions` row carries only
  `started_at`/`completed_at`.

## 3. What "reuse the visual board" actually means

`BoardInputPanel.astro` (the component rendered by existing game play pages)
is not reusable as-is: it is wired directly to `$store.game.turns` inside
`boardInputData()`'s `visitMarkers()`, and to `$store.game.inputModeKey` in
its own `x-show`. Both couple it to the existing per-game `game` Alpine
store, which a Switching/Double-Pattern exercise session does not use.

What *is* store-agnostic and directly reusable:

- `DartBoard.astro`, `BoardMagnifier.astro` (pure rendering).
- `boardInputData(onCommit)` (`app/src/lib/game/board-input.data.ts`) — pointer
  handling, geometry, magnifier math. Its only store reads are
  `this.$store.boardInput.handedness` (a global setting, fine to keep) and
  `this.$store.game.turns` inside `visitMarkers()`.

**Required small generalization:** `boardInputData()` and `markersForTurns()`
take a `turns` accessor (or the turns array itself) as a parameter instead of
reading `this.$store.game.turns` directly. `BoardInputPanel.astro`'s own call
site passes `() => this.$store.game.turns` and is otherwise unchanged; the new
exercise panel passes its own store's turns. This is a one-call-site
refactor, not a new parallel implementation.

A new, small `ExerciseBoardInputPanel.astro` (or similarly named) renders
`DartBoard` + `BoardMagnifier` + undo, mirroring `BoardInputPanel.astro`'s
markup but reading from the exercise store instead of `$store.game`.

## 4. Service layer

New file, parallel to `session.service.ts` (never modifies it):
`app/src/services/training-session.service.ts`.

### `startTraining(playerId, routineTemplateName)`

`routine_templates` has no `implementation_key` column (only `id`, `name`,
`is_system_template` — migration `0004`) — unlike the catalog tables this
spec's other lookups go through. With exactly two system routines today
("Warm-Up", "Balanced Training"), resolving by
`WHERE name = $1 AND is_system_template = true` is an acceptable de facto
key; it is not a scalable pattern and should become a real
`implementation_key` column if user-created routines (§20) or more system
routines arrive later.

Resolves `routine_templates` by that name, reads its `routine_steps` in order
joined to `exercise_templates`, merges each step's `configuration` over its
template's `default_configuration` (Resolved Training Configuration, §18).
Creates one `activities` row and one `activity_configurations` snapshot row
(the resolved step list, JSONB). Returns:

```ts
{
  activityId: string;
  routineName: string;
  steps: {
    sequenceNumber: number;
    exerciseTypeKey: string; // WARM_UP | SWITCHING | DOUBLE_PATTERN | GAME
    gameTypeKey?: string;     // set only when exerciseTypeKey === GAME
    durationSeconds: number;
    configuration: Record<string, unknown>;
  }[];
}
```

### `startTrainingStep(playerId, activityId, sequenceNumber)`

Reads the step from the **activity's own snapshot**, never the live
template — runtime immutability. Creates the `exercise_sessions` row under
the **existing** `activityId`, stamping `routine_step_sequence_number`
(column already exists — migration `0029`, "indexes into
`activity_configurations`, no foreign key"):

- **`GAME` step (Finishing/TUOD):** `insertSessionRecords`
  (`session.repository.ts`) inserts `activities` + `exercise_sessions` +
  `exercise_configurations` + `participants` in **one transaction on every
  call** — correct for a standalone game (one activity per session,
  today's only case) but wrong for a routine's Finishing step: the
  activity already exists (created once by `startTraining`), so calling
  this as-is would either collide on that row's id or mint a second,
  orphaned activity. `insertSessionRecords` must split into two repository
  functions sharing its current transaction: `insertActivityRecord(tx,
  {activityId, playerId, activeStatusId})` (just the `activities` insert)
  and `insertExerciseSessionRecord(tx, {...the rest})` (session +
  configuration + participants, against a caller-supplied `activityId`).
  `insertSessionRecords` itself becomes a thin wrapper calling both inside
  one `withTransaction` — every existing caller (`createSession` via
  `insertSessionWithActiveGuard`) is unaffected. `startTrainingStep`'s
  `GAME` path calls `insertExerciseSessionRecord` alone, inside its own
  `withTransaction` + the same `uq_sessions_single_active` conflict guard
  `insertSessionWithActiveGuard` already wraps around today's insert. The
  exercise-type lookup itself (`findExerciseTypeId(db, "GAME")`) already
  exists and needs no change (merged into `main` as part of the
  `exercise_type_id` NOT NULL fix, commit `e9cd19e`, closes F78/F79).
- **Non-game steps (`WARM_UP`, `SWITCHING`, `DOUBLE_PATTERN`):** a simpler
  insert — `exercise_type_id` (via the same generic `findExerciseTypeId(db,
  key)`) + `exercise_ruleset_version_id` (the dedicated column, separate
  from `ruleset_version_id` which stays NULL for non-game steps — D264's
  parallel-contract split, confirmed in `schema.ts`), and for `WARM_UP` no
  game pair and no capture pair (both NULL, migration 0029's verified
  shape); for `SWITCHING`/`DOUBLE_PATTERN` a capture pair (`ANALYTICS` +
  `VISUAL_BOARD`) with no game pair (also already verified by
  `database/verification/0029_session_generalization_checks.sql`).

`CreateSessionRecordsInput` (`app/src/repositories/interfaces.ts`) only
covers the `GAME` shape today — `gameTypeId`/`rulesetVersionId`/
`captureModeId`/`inputModeId` are all required fields, and it has no
`exerciseRulesetVersionId` or `routineStepSequenceNumber`. Two additive
changes, not a rewrite: (1) widen those four fields to optional (the
columns are already nullable) and add `exerciseRulesetVersionId?`/
`routineStepSequenceNumber?` to the one interface and its one
`insertSessionRecords` implementation — both the `GAME` and non-game insert
paths go through it; (2) a new, small `insertExerciseSessionRecords`-style
call in `training-session.service.ts` supplies the non-game fields
(`exerciseTypeId`, `exerciseRulesetVersionId`) and omits the game ones,
while the existing `createSession`/`insertSessionWithActiveGuard` path
keeps supplying its own unchanged.

Returns `{ sessionId, exerciseTypeKey, configuration, participants? }`. For
v1 the Finishing step always runs as a single `PLAYER` seat — no
bot/guest — matching `createSession`'s own default when `participants` is
omitted; the request body's `participants?` exists only because the
underlying insert path accepts it, not because this spec exposes a seat
picker anywhere in the routine flow.

### `completeTraining(playerId, activityId)`

Marks the `activities` row completed once the last step's own session has
completed. Independent of each step's own `exercise_sessions.status_id`,
which the existing per-session PATCH endpoint already sets unchanged.

## 5. API surface (additive, nothing existing changes shape)

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/training-sessions` | `startTraining` — body `{ routineTemplateName }` |
| POST | `/api/training-sessions/[activityId]/steps/[sequenceNumber]` | `startTrainingStep` — body `{ participants? }`, meaningful only for the `GAME` step |
| PATCH | `/api/training-sessions/[activityId]/complete` | `completeTraining` |

Dart/turn capture and per-session status reuse the **existing, untouched**
endpoints, keyed only by `sessionId`:

- `POST /api/sessions/[sessionId]/events/batch`
- `PATCH /api/sessions/[sessionId]`

## 6. Frontend

New page `app/src/pages/training/balanced-training/play/index.astro`
(mirrors `games/singles-training/play`), new store
`app/src/lib/training/balanced-training-play.data.ts`.

On mount: `POST /api/training-sessions` with `routineTemplateName:
"Balanced Training"`, construct the client-side `trainingEngine`
(`modules/training/training.module.ts`, already exists) from the returned
step list. Per current step:

| Exercise | UI | Engine driving it | Facts persisted |
| --- | --- | --- | --- |
| Warm-Up | phase countdown, auto-advance | `WarmUpEngine`, clock owned by the store (D264) | none — §16, by design |
| Switching | `ExerciseBoardInputPanel` (new, §3) | `SwitchingEngine.record(dart)` | stage/turn/dart facts via events/batch |
| Double Pattern | same panel | `DoublePatternEngine.record(dart)` | stage/turn/dart facts via events/batch |
| Finishing | existing `TenUpOneDown.astro` interface + `tuod-play.data.ts`, bound to this step's session id | existing TUOD `GameEngine`, unchanged | unchanged (full game log) |

Each step calls `startTrainingStep` when the player actually reaches it (not
all four upfront), so `started_at` reflects real arrival time. After the
last step completes, the store calls `PATCH .../complete` and navigates back
to `/training`.

`RoutineDetail.astro`'s Start button: drop `disabled`/`ariaLabel="...coming
soon"`, wire `@click="startTraining()"` on a small `x-data` wrapper the page
adds (mirrors how other setup screens invoke their store's start method,
e.g. `singlesTrainingSetup()`), where `startTraining()` POSTs then sets
`window.location.href` to the new play page on success.

## 7. Out of scope (note, don't build)

- A routine-completion summary screen — lands on `/training` directly for
  v1; a follow-up if wanted.
- Resuming a training abandoned mid-routine (no `ContinueSessionModal`
  equivalent) — each standalone game already has this per-session; a
  routine-level equivalent is a separate, larger piece of work.
- Any change to `09-training-routines.md`'s architecture — this spec
  implements it, not revises it.

## 8. Testing

- `training-session.service.ts`: Vitest unit tests mocking the DB client,
  covering the three functions above, mirroring `session.service.test.ts`'s
  structure.
- API route handlers: thin, tested the same way existing `/api/sessions/*`
  handlers are (parse/validate/delegate).
- `boardInputData()`'s generalization: existing
  `board-input.data.test.ts` (if present) extended to cover the
  parameterized turns source; `BoardInputPanel.astro`'s own behavior must be
  unchanged (regression, not new coverage).
- New Alpine store (`balanced-training-play.data.ts`): unit-tested like
  other `*-play.data.ts` files — pure functions extracted where the existing
  pattern already does this (see `play-lifecycle.ts`).
