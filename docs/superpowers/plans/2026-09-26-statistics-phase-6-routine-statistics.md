# Statistics Phase 6 — Routine Statistics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship rollout phase 6 of the detailed statistics pages: the Routines tab of `/statistics`.
- A picker of the routines the player has trained, each with run-level sections (volume, completion).
- Per step: a GAME step shows its game's phase 1–4 sections, scoped to that step's sessions with `context = routine` fixed by the server. A non-game dart step (Switching, Double Pattern, …) shows a volume and a result section.
- Every step session lists and replays, which closes phase 5's training-session deferral.

**Architecture:**
- One migration adds two owner-scoped views:
  - `v_stats_routine_run_facts`: one row per terminal training activity
  - `v_stats_routine_step_facts`: one row per terminal step session, game and non-game
  - Both derive the routine and step identity from the `activity_configurations` snapshot and never reference a template.
- Run and step volume/completion are `sql` sections over the new views.
- The non-game `step-result` section is a `server` fold. It rebuilds each session's exercise engine from its facts (`v_game_replay`), and reads per-kind metrics through the same extractors the routine summary modal uses. It is bounded by phase 3's dart cap and chunk windows.
- GAME steps reuse the game section handlers unchanged. Phase 2's `dartScopeWhere` and phase 3's `sessionScopeWhere` gain one optional `routineStep` predicate, so no handler is edited.
- The client cache generalizes its game key to a scope key (`game:…`, `routine:…`, `routine:…:step:…`) with one schema bump.

**Tech Stack:** TypeScript, Astro, Alpine, Vitest, Drizzle ORM, dbmate, PostgreSQL (Neon), zod, IndexedDB (`fake-indexeddb` in tests).

**Spec:** `docs/architecture/10-Statistics/00-Overview.md` §1, §5–§8, §10 and `01-Section-Catalog.md` §3 (canonical); `09-Training/01-Routines.md` §11, §18 and `05-Database/06-Spec/04-Runtime-Layer.md` §`activity_configurations` for the snapshot. Earlier plans own what this one extends:
- phase 1 (`2026-09-26-statistics-phase-1-foundation.md`): the section registry and route, `Series`, the session-list cursor, the stats cache (`db.ts`, `keys.ts`, `cache.ts`), `dataVersion`, `game-stats.store.ts`
- phase 2 (`2026-09-26-statistics-phase-2-board-sections.md`): `SectionHandler`, `DartScope`, `dartScopeWhere`
- phase 3 (`2026-09-26-statistics-phase-3-checkout-sections.md`): `MAX_FOLD_DARTS`, `findScopeDartCount`, `sessionScopeWhere`, `chunkWindows`, `mergeMetrics`
- phase 4 (`2026-09-26-statistics-phase-4-derived-intent-sections.md`): `configGroupKey`, the game-specific sections a GAME step inherits
- phase 5 (`2026-09-26-statistics-phase-5-replay.md`): the replay gate, `ReplayHeader`, `rowsToTurns`, `stageOrder`, `replayFacts`, `foldReplay`, `REPLAY_PRESENTERS`, `replayPath`

**Prerequisite:** Phases 1–5 are merged. If a name differs from what this plan says, follow the code and note the difference in the PR body.

## Plan-level decisions

Each is written into the canonical docs in Task 11 under decision **D372** (confirm with `bash scripts/next-decision-id.sh`; D367–D371 belong to phases 1–5).

1. **Routine identity is the snapshot's `routineTemplateId`.**
   - `routine_key = configuration ->> 'routineTemplateId'`, read from `activity_configurations`, never from a template FK. Deleted routines keep their statistics.
   - Snapshots written before D321 added `routineTemplateId` lack it. They key as `name-<md5(routineName)>`, so one legacy name is one routine. The UUID and `name-` forms cannot collide.
   - The display name is the `routineName` of the routine's latest run. A renamed routine keeps its history.
2. **Step identity is index plus fingerprint: `step_key = <sequenceNumber>-<md5>`.**
   - `00-Overview.md` §8 scopes by "routine snapshot identity + step index". A routine is editable, so step 3 today may not be step 3 last month. Index alone would blend unlike steps.
   - `step_fingerprint = md5((step - 'sequenceNumber')::text)` over the step's snapshot element. `jsonb` text output is canonical (keys sorted), so equal steps hash equally.
   - Any change to the exercise, its ruleset, its duration or its configuration starts a new step key. Earlier keys stay listed as earlier versions of that index. This is stricter than `configSensitive`: a step key never mixes configurations, so no step section needs `configGroupKey`.
   - The step element is found by `sequenceNumber`, not by array position, because `startTrainingStep` looks it up the same way.
3. **Two views; no widening of `v_stats_session_facts`.**
   - `v_stats_session_facts` stays game-only (phase 1). Non-game steps have no game pair, and every game section filters on `game_type_key`.
   - `v_stats_routine_step_facts` holds every terminal session with a non-null `routine_step_sequence_number` under an activity with a snapshot. GAME steps appear in both views; the grains differ, so this is not a second derivation of one fact.
   - Both views keep phase 1's rule-free counts: `turn_count`, `counted_score`, `dart_count` over the owning participant, as integer-cast `LATERAL` subqueries.
   - `v_stats_routine_run_facts` counts `step_count = jsonb_array_length(configuration -> 'steps')`, plus `steps_started` and `steps_completed` over the activity's step sessions.
4. **`context = routine` is fixed by the route, not a parameter.**
   - The routine routes accept `from`, `to`, `tz`, `bucket` and `status` only. `context`, `inputMode` or anything else → `VALIDATION_FAILED` (`00-Overview.md` §5 "never silently ignored").
   - For a GAME step the service calls the game section path with `context: "routine"` and `routineStep: { routineKey, stepKey }` set server-side. The client has no way to widen either.
5. **One scope predicate, not per-handler edits.**
   - `DartScope` and the session scope gain `routineStep?: { routineKey: string; stepKey: string }`.
   - When it is set, `dartScopeWhere` and `sessionScopeWhere` add `session_id IN (SELECT session_id FROM v_stats_routine_step_facts WHERE player_id = $p AND routine_key = $r AND step_key = $s)`. Every phase 2–4 handler inherits it. Their tests stay unedited and green.
   - A GAME step page lists exactly `sectionsForGame(step.gameTypeKey)`. A section id outside that list → `NOT_FOUND`, as on the game page.
6. **Run- and step-level sections.** A second registry, `ROUTINE_SECTIONS`, uses phase 1's `SectionMeta` shape:

   | Id | Surface | Site | Bucketable | `includesAbandoned` | Metric |
   | -- | ------- | ---- | ---------- | ------------------- | ------ |
   | `routine-volume` | routine | sql | yes | no | runs, minutes (sum, min, max), darts |
   | `routine-completion` | routine | sql | yes | yes | completed, abandoned, never started; `stepsCompletedAtAbandon: Record<n, runs>` |
   | `step-volume` | any step | sql | yes | no | sessions, minutes, darts |
   | `step-result` | non-game dart step | server | yes | no | per-kind metric sums and extremes (decision 7) |

   - Runs bucket by the activity's `completed_at`, step sections by the session's `completed_at`.
   - A run with zero step sessions is "never started" (the training-activity abandon path, `00-Overview.md` §9).
   - Warm-Up throws no darts, so it gets `step-volume` only.
7. **Per-kind step metrics have one definition.**
   - `STEP_METRIC_SPECS: Record<DartExerciseKind, StepMetricSpec>` declares each kind's metric keys, their merge (`sum` or `max`), the headline and its direction, and the rate pairs the client divides:

     | Kind | Metrics (merge) | Headline | Rates |
     | ---- | --------------- | -------- | ----- |
     | SWITCHING | points, darts, hits (sum) | points ↑ | hits/darts |
     | DOUBLE_PATTERN | hits, darts (sum) | hits ↑ | hits/darts |
     | TARGET_SCORING | bestChain (max); darts, hits (sum) | bestChain ↑ | hits/darts |
     | SWITCHING_TARGET_SCORING | bestChain (max); sequences, darts, hits (sum) | bestChain ↑ | hits/darts |
     | SCORE_THRESHOLD | beats, visits, darts (sum) | beats ↑ | beats/visits |
     | BULLSEYE_CHECKOUT | checkouts, visits, darts (sum) | checkouts ↑ | checkouts/visits |
     | BULL_UP | throws, bullseyes, bulls (sum) | bullseyes ↑ | bullseyes/throws, bulls/throws |

   - `stepMetrics(kind, state, facts)` reads engine state exactly as `routine-summary.module.ts` does today. The `summarise*` functions are rewritten onto it under their existing, unedited tests, so the modal and the statistics page cannot disagree.
   - Per bucket, `step-result` returns the merged metrics plus `min`/`max` of the headline per session. Both re-aggregate exactly, like phase 1's `session-result`.
   - Hit counts that the summary derives from facts (Switching) come from the same fact walk.
8. **The `step-result` fold runs on the server.**
   - Facts load from `v_game_replay`, which has no game join (`0033`), so it already holds non-game sessions. Rows become facts through phase 5's `rowsToTurns`, `stageOrder` and `replayFacts`. If `replayFacts` sits in `lib/`, it moves to `modules/stats/replay.module.ts`; that extraction is required work.
   - Per session: `getDartExerciseEngineFactory(exerciseRulesetVersionKey).create(configuration, facts).state()`, then `stepMetrics`. `configuration` is the session's own snapshot, passed exactly as the routine play adapter's `open()` passes it.
   - Engines self-register on import. The fold imports the engine modules directly, so no client entry point is pulled onto the server.
   - The request is bounded by phase 3's `MAX_FOLD_DARTS`, counted over the step's scoped sessions, and the client asks in `chunkWindows`.
   - A session whose engine is missing or throws is skipped and counted in `skippedSessions`, never guessed.
9. **Picker and header endpoints.**
   - `GET /api/statistics/routines`: `{ items: TrainedRoutine[] }`. Each item has `routineKey`, `routineTemplateId | null`, `routineName` (latest), `runCount`, `completedRunCount`, `lastRunAt`, ordered by `lastRunAt DESC`. The list is unpaginated: it is bounded by routines trained, not by runs. Any parameter → `VALIDATION_FAILED`.
   - `GET /api/statistics/routines/:routineKey`: `{ routineKey, routineName, runCount, firstRunAt, lastRunAt, dataVersion, steps: RoutineStepDescriptor[] }`.
     - A descriptor has `stepKey`, `sequenceNumber`, `exerciseTypeKey`, `exerciseRulesetVersionKey`, `gameTypeKey`, `rulesetVersionKey`, `durationSeconds`, `sessionCount`, `firstSeenAt`, `lastSeenAt` and `current`.
     - `current` means the step key appears in the latest run's snapshot.
     - Order: `sequenceNumber`, then `lastSeenAt DESC`.
   - An unknown or unowned `routineKey` → `NOT_FOUND`. A malformed one → `VALIDATION_FAILED`.
   - The Routines tab stops calling `GET /api/routines`. That call lists routines that exist today; statistics need routines that were trained.
10. **Step session list.** `GET /api/statistics/routines/:routineKey/steps/:stepKey/sessions` follows phase 1's session list: the same params, cursor and `(completed_at DESC, session_id DESC)` order, over `v_stats_routine_step_facts`. Each row links to its replay.
11. **Replay covers training sessions.**
    - The phase 5 gate becomes: the session is in `v_stats_session_facts`, **or** in `v_stats_routine_step_facts` with a non-null `input_mode_key`, for this player. Warm-Up has no capture pair and nothing to replay, so it stays `NOT_FOUND`.
    - `ReplayHeader` gains `exerciseTypeKey`, `exerciseRulesetVersionKey`, `routineKey` and `stepKey`, and `gameTypeKey` becomes nullable. The phase 5 fields are unchanged.
    - The client fold picks `getEngineFactory` when `gameTypeKey` is set, otherwise `getDartExerciseEngineFactory`. `STEP_REPLAY_PRESENTERS` shows each kind's running headline from `stepMetrics`, following decision 7.
    - Pages stay immutable. The header change is a contract change, so phase 5's replay cache takes a schema bump (decision 12).
12. **Cache scope key; one schema bump.**
    - Phase 1's cache keys take `gameTypeKey`. They become `scopeKey`: `game:<gameTypeKey>`, `routine:<routineKey>`, `routine:<routineKey>:step:<stepKey>`.
    - `dataVersion` for both routine scopes is base64url of `v1:<runCount>:<max activity completed_at epoch ms>` over the routine's terminal runs. A new run is the only thing that changes either scope.
    - `STATS_SCHEMA_VERSION` bumps by one. The bump wipes every store, including `replayPages`, which covers decision 11's header change.
13. **Scope out:** dart-level sections for non-game steps (heat map, per-target accuracy). They need a non-game dart fact view, which is additive later. Adaptive or cross-routine comparisons are out too.

## Global Constraints

- TDD: write the failing test, run it, watch it fail, then implement (`app/CLAUDE.md` §Test-Driven Development).
- `cd app && npm test` runs the whole suite. Finish every task with the full suite.
- Migration number: the next free one after phase 5's (`0045` unless taken). Written here as `NNNN`. Never edit an applied migration. The D344 carve-out applies only with `db:status` and `db:status:prod` both reporting it pending.
- `app/src/db/schema.ts` is generated: run `npm run db:introspect` after the migration is applied. A session without `DATABASE_URL` **stops at Task 1 Step 5** and asks the owner to run `npm run db:migrate && npm run db:introspect`.
- Reads go through views only: `vStatsRoutineRunFacts`, `vStatsRoutineStepFacts`, `vStatsSessionFacts`, `vStatsDartFacts`, `vGameReplay`.
- Statistics are never persisted. No exercise rule in SQL; engines run in TS only.
- The snapshot is read, never trusted blindly: a step element with a missing or non-integer `sequenceNumber` yields no row, and the verification script proves it.
- Engine modules and phase 2–4 section handlers stay unedited. `routine-summary.module.ts` is refactored under unedited tests.
- NUMERIC arrives as a string: wrap sums in `Number(nonNull(…))`.
- JSDoc only (`check-no-inline-comments.sh`). Exported types go in the barrels (`check-type-barrels.sh`). No `x-init`.
- `npm run format` before every commit.
- Branch: `feat/statistics-routines` from `main` after phase 5 has merged.
- Anything noticed that this plan does not ask for → GitHub issue via `capturing-discovered-work`, never fixed in the same pass.

## File map

| Action | Path | Responsibility |
| ------ | ---- | -------------- |
| Create | `database/migrations/NNNN_stats_routine_views.sql` | the two views, any measured index |
| Create | `database/verification/NNNN_stats_routine_views_checks.sql` | live-DB assertions (D193) |
| Regenerate | `app/src/db/schema.ts` | `vStatsRoutineRunFacts`, `vStatsRoutineStepFacts` |
| Create | `app/src/modules/stats/routine-scope.module.ts` | key codecs and validation |
| Create | `app/src/modules/stats/step-metrics.module.ts` | `STEP_METRIC_SPECS`, `stepMetrics`, `mergeStepMetrics` |
| Modify | `app/src/modules/training/routines/routine-summary.module.ts` | `summarise*` onto `stepMetrics` |
| Create | `app/src/modules/stats/sections/routine-*.module.ts`, `step-*.module.ts` | shape rows into `Series` |
| Modify or move | `app/src/modules/stats/replay.module.ts` | gains `replayFacts` if it sat in `lib/` |
| Modify | `app/src/repositories/statistics.repository.ts`, `app/src/modules/types.ts` | routine readers, scope predicate |
| Modify | `app/src/lib/stats/section-registry.ts`, `app/src/lib/stats/types.ts` | `ROUTINE_SECTIONS`, `sectionsForStep` |
| Modify | `app/src/services/statistics.service.ts`, `app/src/services/types.ts` | routine services, replay gate |
| Modify | `app/src/pages/api/statistics/types.ts` | zod contracts |
| Create | `app/src/pages/api/statistics/routines/index.ts`, `[routineKey]/index.ts`, `[routineKey]/sections/[sectionId].ts`, `[routineKey]/steps/[stepKey]/sections/[sectionId].ts`, `[routineKey]/steps/[stepKey]/sessions.ts` | routes |
| Modify | `app/src/lib/client/api/statistics.ts`, `api/types.ts` | routine fetchers |
| Modify | `app/src/lib/client/stats-cache/db.ts`, `keys.ts`, `cache.ts` | scope key, schema bump |
| Modify | `app/src/lib/stats/replay-fold.ts`, `replay-presenters.ts` | exercise engines, step presenters |
| Create | `app/src/stores/routine-stats.store.ts` | Routines tab state |
| Modify | `app/src/pages/statistics/index.astro`, `app/src/lib/training/routines/statistics-routines.data.ts` | Routines tab |
| Tests | mirror each path under `app/tests/` | |
| Docs | Task 11 list | |

---

### Task 1: Migration — routine fact views

**Files:**
- Create: `database/migrations/NNNN_stats_routine_views.sql`, `database/verification/NNNN_stats_routine_views_checks.sql`
- Regenerate: `app/src/db/schema.ts`

**Interfaces:**
- `v_stats_routine_run_facts`, one row per `COMPLETED` or `ABANDONED` activity that has an `activity_configurations` row. Columns:
  - `activity_id`, `player_id`
  - `routine_key` (decision 1), `routine_template_id` (nullable), `routine_name`
  - `status_key`, `started_at`, `completed_at`, `duration_seconds`
  - `step_count`, `steps_started`, `steps_completed`, `dart_count`
- `v_stats_routine_step_facts`, one row per `COMPLETED` or `ABANDONED` exercise session whose activity has a snapshot and whose `routine_step_sequence_number` is not null. Columns:
  - `session_id`, `activity_id`, `player_id`
  - `routine_key`, `routine_name`
  - `sequence_number`, `step_fingerprint`, `step_key` (decision 2), `step` (the snapshot element)
  - `exercise_type_key`, `exercise_ruleset_version_key`, `game_type_key`, `ruleset_version_key`, `input_mode_key` (the last four nullable)
  - `status_key`, `configuration` (the session's `exercise_configurations`)
  - `started_at`, `completed_at`, `duration_seconds`, `turn_count`, `counted_score`, `dart_count`
- The step element is found with a `LEFT JOIN LATERAL (SELECT e FROM jsonb_array_elements(ac.configuration -> 'steps') e WHERE e ->> 'sequenceNumber' = es.routine_step_sequence_number::text LIMIT 1)`. A session with no matching element is dropped by requiring the element to be non-null.
- Lookups `LEFT JOIN` wherever `0033` made the key nullable. Counts are `::integer` (`migration-numeric-typing`).
- The header comment states decisions 1–3.
- `migrate:down` drops both views.

- [ ] **Step 1: Write the verification script first** (fixture pattern: `0023_owner_scoped_dart_view_checks.sql` and phase 1's `0043` checks, ending in `ROLLBACK`). It asserts:
  1. A completed training with a snapshot carrying `routineTemplateId` and three steps (Warm-Up, Switching, a `SCORE_TRAINING_V1` game) → one run row, `step_count = 3`, `steps_completed = 3`, `routine_key` equal to the template id.
  2. A snapshot without `routineTemplateId` → `routine_key = 'name-' || md5(routineName)`.
  3. Step rows: three, with the Warm-Up's `input_mode_key` null and the game step's `game_type_key` set. `step_key` is `sequenceNumber || '-' || md5(...)`.
  4. Two runs whose step 2 differs only in configuration → two `step_key` values at `sequence_number = 2`. Two identical runs → one.
  5. An activity abandoned with zero step sessions → one run row, `steps_started = 0`.
  6. An `ACTIVE` activity and an `ACTIVE` step session → absent.
  7. A standalone game (no snapshot) → absent from both views and still present in `v_stats_session_facts`.
  8. `dart_count` counts the owner participant only.
  9. A step whose `sequenceNumber` has no matching snapshot element → absent.
- [ ] **Step 2: Write the migration.**
- [ ] **Step 3: Query plans.** `EXPLAIN (ANALYZE, BUFFERS)` in the dev database:
  - the step-facts filter by `player_id, routine_key, step_key` and a `completed_at` range
  - the run-facts filter by `player_id, routine_key`

  Neither may sequentially scan `turns` or `darts`. **On fail:** add the index to this same migration with its rationale (`04-Indexes.md`). The likely candidate is `activities (player_id, completed_at DESC)`. Record the plan summary in the PR body.
- [ ] **Step 4: Numeric typing.** Every count and sum is cast; `duration_seconds` follows phase 1's `FLOOR(EXTRACT(...))::integer`.
- [ ] **Step 5: Apply and introspect.** `cd app && npm run db:migrate && psql "$DATABASE_URL" -f ../database/verification/NNNN_stats_routine_views_checks.sql && npm run db:introspect`. Without `DATABASE_URL`: stop and ask (Global Constraints).
- [ ] **Step 6: Suite.** `cd app && npm test`. `schema-view-drift` and `migration-numeric-typing` must pass.
- [ ] **Step 7: Commit.** `feat(db): routine statistics fact views (NNNN)`

---

### Task 2: Routine scope module

**Files:**
- Create: `app/src/modules/stats/routine-scope.module.ts`
- Modify: `app/src/modules/types.ts`
- Test: `app/tests/modules/stats/routine-scope.module.test.ts`

**Interfaces:**
- `isRoutineKey(s): boolean`: a UUID, or `name-` followed by 32 lowercase hex characters.
- `parseStepKey(s): { sequenceNumber: number; fingerprint: string } | null`: a positive integer, `-`, then 32 lowercase hex characters.
- `RoutineStepScope = { routineKey: string; stepKey: string }`.
- `routineScopeKey(routineKey)` → `routine:<key>`. `stepScopeKey(routineKey, stepKey)` → `routine:<key>:step:<stepKey>`. `gameScopeKey(gameTypeKey)` → `game:<key>` (decision 12).

- [ ] **Step 1: Failing tests.**
  - Valid and invalid routine keys: an uppercase-hex `name-` key, a short hash, `name-` alone, and a plain name are all rejected.
  - Step keys: `0-…`, `-1-…`, `1.5-…` and a 31-character hash are rejected; `3-<32 hex>` parses.
  - The scope keys are distinct for equal inputs across the three kinds.
- [ ] **Step 2: Implement.** Green, full suite. Commit: `feat(stats): routine and step key codecs`

---

### Task 3: Step metrics — one definition for modal and page

**Files:**
- Create: `app/src/modules/stats/step-metrics.module.ts`
- Modify: `app/src/modules/training/routines/routine-summary.module.ts`, `app/src/modules/types.ts`
- Tests: `app/tests/modules/stats/step-metrics.module.test.ts`; `routine-summary.module` tests stay **unedited**

**Interfaces:**
- `DartExerciseKind`: the seven keys in decision 7's table.
- `StepMetricSpec = { metrics: Readonly<Record<string, "sum" | "max">>; headline: string; direction: "higher"; rates: readonly (readonly [string, string])[] }`
- `STEP_METRIC_SPECS: Readonly<Record<DartExerciseKind, StepMetricSpec>>`
- `stepMetrics(kind, state: unknown, facts: EngineFacts): Record<string, number>`. It returns exactly the spec's keys and throws on a state missing a field, which means a contract break, not bad data.
- `mergeStepMetrics(spec, a, b)`: merges per key by the spec's merge function.

- [ ] **Step 1: Failing tests.**
  - For each kind: drive the real engine through a scripted run in the test, then assert `stepMetrics` equals the numbers its summary modal shows. Switching's `hits` counts intended = hit darts.
  - `mergeStepMetrics` sums `sum` keys and takes `max` of `max` keys.
  - The spec's keys match `stepMetrics` output for every kind: the test iterates over `STEP_METRIC_SPECS`, so a new kind without an extractor fails.
- [ ] **Step 2: Implement `stepMetrics`.** Green.
- [ ] **Step 3: Refactor** each `summarise*` for the seven kinds to read its numbers from `stepMetrics`. The labels and formatting stay in the summary module. The existing summary tests pass unedited.
- [ ] **Step 4:** Full suite. Commit: `refactor(training): routine summary reads shared step metrics`

---

### Task 4: Repository — routine readers and scope predicate

**Files:**
- Modify: `app/src/repositories/statistics.repository.ts`, `app/src/modules/types.ts`
- Test: `app/tests/repositories/statistics.repository.test.ts` (extend; rendered SQL via `tests/repositories/render-sql.ts`, plus fake-chain row mapping)

**Interfaces:**
- `findTrainedRoutines(db, playerId): Promise<TrainedRoutineRow[]>`: grouped by `routine_key`. `routine_name` is from the latest run (`DISTINCT ON` or `array_agg(... ORDER BY completed_at DESC)[1]`).
- `findRoutineHeader(db, playerId, routineKey): Promise<RoutineHeaderRow | null>`: counts, first and last run, and the latest run's `activity_id`.
- `findRoutineStepDescriptors(db, playerId, routineKey, latestActivityId): Promise<RoutineStepDescriptorRow[]>`: grouped by `step_key` from the step view. `current` is `bool_or(activity_id = $latest)`, with fields from `step` (`durationSeconds`, `exerciseTypeKey`, …).
- `findRoutineDataVersion(db, playerId, routineKey): Promise<string>`: decision 12.
- `findRoutineRunBuckets(db, q: RoutineScope & { bucket; tz }): Promise<RoutineRunBucketRow[]>`: phase 1's whitelisted bucket expressions over `completed_at`. Returns runs, `minutes_sum/min/max`, darts, completed, abandoned, `never_started`, and `steps_completed` for abandoned runs as a grouped sub-select.
- `findStepBuckets(db, q: StepScope & { bucket; tz }): Promise<StepBucketRow[]>`: sessions, minutes and darts from the step view.
- `findStepSessionPage(db, q)`: phase 1's session-list query and cursor over the step view.
- `findStepFoldRows(db, q: StepScope): Promise<(ReplayRow & { sessionId; completedAt; exerciseRulesetVersionKey; configuration })[]>`: `v_game_replay` joined to the step view on `session_id`, ordered by `session_id, stage, turn_sequence, dart_number`.
- `findStepScopeDartCount(db, q: StepScope): Promise<number>`: phase 3's cap input, over the step view.
- `RoutineScope = { playerId; routineKey; from; to; statuses }`, `StepScope = RoutineScope & { stepKey }`.
- Decision 5: `dartScopeWhere` and `sessionScopeWhere` accept `routineStep?`. When it is set they add the `session_id IN (…)` sub-select, bound by `player_id`, `routine_key` and `step_key`.

Every reader filters `player_id`. `nonNull` guards view-guaranteed columns.

- [ ] **Step 1: Failing tests.**
  - The rendered SQL of each reader: the view name, `player_id`, `routine_key`, `step_key` where scoped, and the bucket expression.
  - `dartScopeWhere` and `sessionScopeWhere` render the sub-select only when `routineStep` is set. Every existing phase 2–4 reader test still renders unchanged SQL (unedited tests).
  - Mapping: NUMERIC strings → numbers, nullable game keys stay `null`, and `nonNull` throws on a null `step_key`.
- [ ] **Step 2: Implement.** Green, full suite. Commit: `feat(stats): routine repository readers and step scope predicate`

---

### Task 5: Registry and section modules

**Files:**
- Modify: `app/src/lib/stats/section-registry.ts`, `app/src/lib/stats/types.ts`
- Create: `app/src/modules/stats/sections/routine-volume.module.ts`, `routine-completion.module.ts`, `step-volume.module.ts`, `step-result.module.ts`
- Tests: `app/tests/lib/stats/section-registry.test.ts` (extend), one test per module

**Interfaces:**
- `RoutineSectionId = "routine-volume" | "routine-completion" | "step-volume" | "step-result"`.
- `ROUTINE_SECTIONS: Readonly<Record<RoutineSectionId, SectionMeta & { surface: "routine" | "step" }>>` (decision 6).
- `sectionsForRoutine(): SectionMeta[]` returns the routine sections in page order.
- `sectionsForStep(step: { exerciseTypeKey; gameTypeKey; inputModeKey }): { kind: "game"; gameTypeKey; sections: SectionMeta[] } | { kind: "exercise"; sections: SectionMeta[] }`.
  - A GAME step gets `sectionsForGame(gameTypeKey)`.
  - A dart exercise gets `step-result` and `step-volume`.
  - Warm-Up gets `step-volume` only.
- The shape modules turn rows into `Series` with `SeriesPoint` metrics:
  - `routine-volume`: `{ runs, minutes, minMinutes, maxMinutes, darts }`
  - `routine-completion`: `{ completed, abandoned, neverStarted, stepsCompletedAtAbandon }`
  - `step-volume`: `{ sessions, minutes, darts }`
  - `step-result`: `{ metrics, headlineMin, headlineMax, sessions, skippedSessions }`
- `foldStepResult(kind, sessions: readonly StepFoldSession[]): StepResultMetric` groups rows per session, rebuilds `EngineFacts` (decision 8), creates the engine, applies `stepMetrics` and merges. A missing factory or a `create` throw is a skip.

- [ ] **Step 1: Failing tests.**
  - The registry: section ids are disjoint from `SECTIONS`; each routine meta's `includesAbandoned` matches decision 6.
  - `sectionsForStep` for a `SCORE_TRAINING_V1` game step equals `sectionsForGame("SCORE_TRAINING")`, for Switching `["step-result", "step-volume"]`, and for Warm-Up `["step-volume"]`.
  - Each shape module on a two-bucket fixture.
  - `foldStepResult`:
    - Two scripted Switching sessions → metrics equal the sum of their `stepMetrics`, and the min/max headline is per session.
    - An unregistered ruleset → `skippedSessions: 1` and no throw.
    - `bestChain` merges by max across sessions.
- [ ] **Step 2: Implement.** If `replayFacts` is in `lib/stats/replay-fold.ts`, move it to `modules/stats/replay.module.ts` first; its tests move with it unedited. Green, full suite. Commit: `feat(stats): routine and step sections`

---

### Task 6: Services

**Files:**
- Modify: `app/src/services/statistics.service.ts`, `app/src/services/types.ts`
- Test: `app/tests/services/statistics.service.test.ts` (extend; mock the repository)

**Interfaces:**
- `listTrainedRoutines(playerId): Promise<ServiceResult<{ items: TrainedRoutine[] }>>`
- `getRoutineHeader(playerId, routineKey): Promise<ServiceResult<RoutineHeader>>`
- `getRoutineSection(playerId, routineKey, sectionId, q: RoutineSectionQuery): Promise<ServiceResult<Series<unknown>>>`
- `getRoutineStepSection(playerId, routineKey, stepKey, sectionId, q): Promise<ServiceResult<Series<unknown>>>`
- `listRoutineStepSessions(playerId, routineKey, stepKey, q): Promise<ServiceResult<SessionList>>`

Behaviour:
1. A malformed `routineKey` or `stepKey` → `VALIDATION_FAILED`. An unknown routine, or a step key absent from that routine's descriptors → `NOT_FOUND`.
2. A section outside `sectionsForRoutine()` or `sectionsForStep(step)` → `NOT_FOUND`.
3. For a GAME step the service delegates to the phase 1 game section path with `gameTypeKey = step.gameTypeKey`, `context: "routine"` and `routineStep` set (decisions 4 and 5). The returned `dataVersion` is replaced by the routine's (decision 12), so the client keys it under the step scope.
4. Status rules follow phase 1 decision 5 per section.
5. `step-result` checks `findStepScopeDartCount` against `MAX_FOLD_DARTS` first, and fails with the cap in the `reason` when it is exceeded.
6. Bucketed responses use phase 1's widened `range` and the `closed` rule.

- [ ] **Step 1: Failing tests** for each behaviour, plus:
  - A GAME step's delegated call receives `context: "routine"` and the exact `routineStep`, whatever the query held.
  - An earlier (non-current) step key still resolves.
  - A legacy `name-` routine key resolves.
  - Another player's routine → `NOT_FOUND`, with no section reader called.
- [ ] **Step 2: Implement.** Green, full suite. Commit: `feat(stats): routine statistics services`

---

### Task 7: Routes and contracts

**Files:**
- Modify: `app/src/pages/api/statistics/types.ts`
- Create: the five routes in the file map
- Test: `app/tests/pages/api/statistics/routines*.test.ts` (pattern: phase 1's `games-sessions.test.ts` and section route tests)

**Interfaces:**
- `RoutineStatsQuery`: a zod `.strict()` object over `from`, `to`, `tz`, `bucket`, `status` (decision 4). It reuses phase 1's field schemas.
- `RoutineSessionsQuery`: phase 1's session-list query minus `context` and `inputMode`, `.strict()`.
- `TrainedRoutineSchema`, `RoutineHeaderSchema`, `RoutineStepDescriptorSchema` and the per-section `contract` schemas, `z.infer`'d into the barrels.
- `GET /api/statistics/routines` accepts no parameters.

- [ ] **Step 1: Failing tests.**
  - The happy path for each route calls its service with `auth.playerId` and the parsed params, and the body parses against its schema.
  - `context=routine`, `context=all`, `inputMode=VISUAL_BOARD` and `foo=1` → 400 `VALIDATION_FAILED` on every routine route.
  - A malformed `routineKey`/`stepKey` → 400. A service `NOT_FOUND` → 404.
  - The routes use phase 1's cache headers.
- [ ] **Step 2: Implement** following the phase 1 routes (`fail("VALIDATION_FAILED", requestId, { reason })`, `ok()`).
- [ ] **Step 3:** Green, full suite, `cd app && npm run validate:app`. Commit: `feat(api): routine statistics routes`

---

### Task 8: Replay of training sessions

**Files:**
- Modify: `app/src/repositories/statistics.repository.ts` (`findReplaySession`), `app/src/services/statistics.service.ts` (`getSessionReplay`), `app/src/pages/api/statistics/types.ts` (`ReplayHeaderSchema`)
- Modify: `app/src/lib/stats/replay-fold.ts`, `app/src/lib/stats/replay-presenters.ts`
- Tests: extend the phase 5 repository, service, route, fold and presenter tests

**Interfaces:**
- `findReplaySession` reads `v_stats_session_facts` and, when that misses, `v_stats_routine_step_facts` with `input_mode_key IS NOT NULL`. Both are filtered by `player_id` and `session_id`. It returns one `ReplaySessionRow` with the decision 11 fields.
- `ReplayHeader` changes:
  - `gameTypeKey: GameTypeKey | null`
  - new `exerciseTypeKey: string`, `exerciseRulesetVersionKey: string | null`, `routineKey: string | null`, `stepKey: string | null`
- `foldReplay` picks the factory by decision 11. The skip reasons gain `NO_EXERCISE_ENGINE`.
- `STEP_REPLAY_PRESENTERS: Record<DartExerciseKind, ReplayPresenter>`. Each turn cell is the running headline and darts from `stepMetrics` over the state after that turn; the session line is the final `stepMetrics`.

- [ ] **Step 1: Failing tests.**
  - The gate: a Switching step session replays. A Warm-Up session, another player's step session and an `ACTIVE` step session → `NOT_FOUND`.
  - A game step session still resolves through `v_stats_session_facts`, and its header carries `routineKey` and `stepKey`.
  - The fold: a scripted Switching session round-trips (facts → replay turns → engine) to the same `state()`. A missing exercise factory → `NO_EXERCISE_ENGINE`.
  - Presenters: Switching's running points after each turn equal the engine's.
  - The phase 5 game cases pass unedited, apart from the header fixtures gaining the four new fields.
- [ ] **Step 2: Implement.** Green, full suite. Commit: `feat(stats): replay training step sessions`

---

### Task 9: Client API and cache scope key

**Files:**
- Modify: `app/src/lib/client/api/statistics.ts`, `app/src/lib/client/api/types.ts`
- Modify: `app/src/lib/client/stats-cache/db.ts`, `keys.ts`, `cache.ts`, and their callers in `game-stats.store.ts`
- Tests: `app/tests/lib/client/api/statistics.test.ts`, `app/tests/lib/client/stats-cache/*.test.ts` (extend)

**Interfaces:**
- `fetchTrainedRoutines()`, `fetchRoutineHeader(routineKey)`, `fetchRoutineSection(routineKey, sectionId, q)`, `fetchRoutineStepSection(routineKey, stepKey, sectionId, q)`, `fetchRoutineStepSessions(routineKey, stepKey, q)`. Each throws `StatisticsApiError` on failure.
- `readSection(playerId, scopeKey, meta, q, fetcher, now)` and `readSessionPage(playerId, scopeKey, q, fetcher)` replace their `gameTypeKey` argument with `scopeKey` (decision 12). `meta.dataVersion` is keyed `player:scopeKey`.
- `game-stats.store.ts` passes `gameScopeKey(gameTypeKey)`.
- `STATS_SCHEMA_VERSION` bumps by one.

- [ ] **Step 1: Failing tests.**
  - The API builds each path and query. The routine calls never send `context` or `inputMode`.
  - A game-scope read and a routine-scope read with equal params do not share entries.
  - Two steps of one routine do not share entries.
  - A routine `dataVersion` change refetches `bucket=none` results for the routine and its steps. A game scope is untouched.
  - The bump wipes a v(n−1) database, `replayPages` included.
  - The existing phase 1 cache tests pass with only the argument renamed.
- [ ] **Step 2: Implement.** Green, full suite. Commit: `feat(client): statistics cache scope key and routine fetchers`

---

### Task 10: Store and Routines tab

**Files:**
- Create: `app/src/stores/routine-stats.store.ts`; register it beside `gameStats`
- Modify: `app/src/lib/training/routines/statistics-routines.data.ts`, `app/src/pages/statistics/index.astro`
- Tests: `app/tests/stores/routine-stats.store.test.ts`; extend or replace `statistics-routines.data` tests, re-pointed at the same guarantee (the picker is seeded with the first option)

**Interfaces:**
- Store fields:
  - `routines: TrainedRoutine[]`, `routineKey`, `header: RoutineHeader | null`
  - `stepKey: string | null`, `showEarlierSteps: boolean`
  - `range` and `bucket` as in `game-stats.store.ts`
  - `routineSections: Record<RoutineSectionId, SeriesView | null>`
  - `stepSections: Record<string, SeriesView | null>`
  - `stepSessions`, `nextCursor`, `loading`, `error`
- Store methods:
  - `init()` loads the trained routines and selects the first.
  - `selectRoutine(key)` loads the header and routine sections, and selects the first `current` step.
  - `selectStep(stepKey)` loads the step sections from `sectionsForStep` and the first session page.
  - `loadMoreStepSessions()`.
- Getters:
  - `currentSteps` and `earlierSteps`, split by `current`
  - the step label from the client's step adapter `headerLabel` (`stepAdapterKey()`), plus "Step n"
  - per-kind rates from `STEP_METRIC_SPECS.rates`; a zero denominator gives `null`
  - the headline PB from `direction`
- For a GAME step, the store renders the game section cards through the same partials the Games tab uses, fed from `stepSections`.

- [ ] **Step 1: Failing tests.**
  - `init` with no trained routines → empty state, no header call.
  - `selectRoutine` loads the header plus both routine sections through a mocked cache under `routine:<key>`.
  - `selectStep` on a game step requests `sectionsForGame` ids under the step scope. On Warm-Up it requests `step-volume` only.
  - Earlier steps are hidden until `showEarlierSteps`.
  - A zero-dart rate is `null`.
  - Session rows link through `replayPath`.
- [ ] **Step 2: Implement the store, then the tab.** Replace the "statistics coming soon" paragraph in the Routines tab. The tab shows:
  - the picker over trained routines
  - run cards: volume, and completion with the abandon-point distribution
  - the step list: current steps, then a collapsed "Earlier versions" group
  - the selected step's cards: game sections, or step result and step volume
  - the step session list with replay links

  Reuse the Games-tab components. For a new visual pattern, read `07-Frontend/10-Frontend-Agent-Guide.md` first.
- [ ] **Step 3:** Full suite, `npm run validate:app`, then the `app/` gate scripts from `run-all-gates`. Commit: `feat(stats): routines tab`

---

### Task 11: Docs, decision, gates

**Files:**
- `decisions/api.md`: **D372**, covering plan-level decisions 1–13. Get the id from `bash scripts/next-decision-id.sh`.
- `docs/architecture/10-Statistics/00-Overview.md`:
  - §1: the Routines tab is built
  - §6: the five routine routes
  - §7: the scope key and the schema bump
  - §8: the routine consumer is built, with the identity rules (decisions 1–2) and the fixed context (decision 4)
  - §10: the two views
  - §12: phase 6 done
  - version 1.6.0 citing D372; status **built** once every phase has landed
- `docs/architecture/10-Statistics/01-Section-Catalog.md`: a routine section table (decisions 6–7); remove "Routine pages" from §3 Deferred and add the decision 13 deferral.
- `docs/architecture/10-Statistics/02-Replay.md`: the training-session scope and the header fields (decision 11); version bump citing D372.
- `docs/architecture/06-API/04-Endpoint-Contracts.md` and `06-API/00-Overview.md`: the five routes, their params, errors and schemas.
- `docs/architecture/05-Database/06-Spec/05-Read-Model-Layer.md` and `05-Views/00-Overview.md`: both views. `03-Migrations.md`: an entry for `NNNN`. `04-Indexes.md`: only if Task 1 Step 3 added an index.
- `docs/architecture/09-Training/01-Routines.md` §18: one line that routine statistics read the snapshot's identity (D372).
- `docs/CLAUDE.md`, root `CLAUDE.md`, `database/CLAUDE.md`: the migration range wherever it is stated. Root `CLAUDE.md`'s never-modify range moves only once `NNNN` is applied.

- [ ] **Step 1:** Make the doc edits: minimal diffs, canonical doc first.
- [ ] **Step 2:** Run the `context-maintenance` skill: the context map, File Inventory rows (new verification script, new routes and store) and a history entry.
- [ ] **Step 3:** Run the `run-all-gates` skill: the Always-run set, the `app/` set, `check-constraint-mirror.sh` and `check-decision-ids.sh`. Report each result.
- [ ] **Step 4:** Commit `docs(stats): phase 6 routine statistics contract, views and D372`. Then run `superpowers:finishing-a-development-branch` with `finishing-a-dart-branch` (push + PR).

---

## Out of scope

- Dart-level sections for non-game steps (heat map, per-target accuracy) and the non-game dart fact view they need (decision 13).
- A run list or per-run detail page. A run is reached through its step sessions' replays.
- Comparisons across routines, and adaptive-training statistics.
- Merging step keys across edits. An owner-chosen "same step" link would be a new decision.
- The `supersededBy` header field, which lands with corrections.
