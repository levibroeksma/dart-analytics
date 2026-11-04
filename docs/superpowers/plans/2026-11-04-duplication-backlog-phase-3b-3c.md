# Duplication Backlog Phase 3b and 3c Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the server-side clones: the statistics read path (PR F, Phase 3b) and the CRUD write path, routes and ruleset validators (PR G, Phase 3c), without changing behaviour or output.

**Architecture:** Same method as Phases 0–3a: extract typed helpers next to the code, migrate every copy, let existing tests plus a new rendered-SQL golden prove nothing moved, then lower `scripts/dupes-baseline.txt`. The statistics repository's ten "`bucket === "none"` vs bucketed" query pairs collapse into one path each through a bucket-window helper; drizzle drops an empty `GROUP BY` (`groupBy.length > 0` check in `pg-core/dialect.js`), so the unbucketed SQL is unchanged.

**Tech Stack:** TypeScript, drizzle-orm (pg-proxy renderer in tests), Zod, Astro API routes, Vitest, fallow.

**Spec:** `docs/superpowers/specs/2026-10-31-duplication-backlog-design.md` (Phase 3). Baseline at start: 32 rows, 55 groups, 1,425 duplicated lines (1.6%), from `main` at `23c1fac`.

## Global Constraints

- No behaviour change. For every statistics reader the rendered SQL text and params are byte-identical before and after (Task F1 golden, no snapshot update). HTTP status, envelope and body unchanged for every route.
- Existing test assertions are never weakened or re-pointed. Tests may gain additions, imports, or construction changes only.
- No per-caller boolean flags. Variation goes through parameters that carry data (a column, a condition list, a schema). A group that needs a flag is skipped and named, with the reason, in the task report.
- Select-object key order is preserved (spread helpers at the position the keys sat), so column order in SQL and JSON key order are unchanged.
- Exported types go in the area's `types.ts`; no `//` comments inside function bodies in `app/src`.
- Incidental findings become `discovered-work` issues, never fixes.
- Gates per task: `cd app && npx vitest run <area>`. At PR end: `npm test`, `npx astro check --minimumFailingSeverity hint`, `bash ../scripts/fallow-gate.sh`, `npm run format:check`, `bash ../scripts/check-dupes.sh`. `validate:app` skips fallow without `DATABASE_URL`; run it locally.
- Never `prettier --write` docs. Decision id from `bash scripts/next-decision-id.sh` at write time (D521 expected). History version re-checked at write time (1.203.0 / 1.204.0 expected).
- Owner reviews and merges each PR; work stops after each PR opens. PR G branches from `main` after PR F lands.

## Review Focus

- A section read with `bucket: "none"` still emits no `GROUP BY` bucket terms and binds `from`/`to` as the bucket bounds; a bucketed read still carries tz as the same literal in SELECT and GROUP BY (42803).
- `findStepBuckets` with `bucket: "none"` over an empty scope still returns `[]` (the `sessions > 0` filter survives the merge).
- A game section with both an unsupported `bucket` and a bad `target` still reports the bucket error first (bucket → target → status order).
- `DELETE /api/routines/:id` and `/api/schedules/:id` still answer `204` with no body and the `X-Request-Id` header; `POST` still answers `201`.
- A ruleset config sent with an unsupported capture/input pair still returns the same issue string per game (`"TUOD V1 only supports …"`, `"121 only supports …"`, `"<label> V1 only supports …"`).

---

## PR F — Phase 3b: statistics read path

Rows: `statistics.repository.ts` (11 groups), `statistics.service.ts` (1), `pages/api/statistics/types.ts` (2 groups). Issue #1172.

### Task F1: Rendered-SQL golden for the bucket-switching readers

**Files:**
- Create: `app/tests/repositories/statistics-sql-golden.test.ts` (+ its `__snapshots__/` file)

**Interfaces:**
- Consumes: `renderingDb`, `onlyStatement` from `tests/repositories/render-sql.ts`.

- [ ] **Step 1:** For each of `findX01FoldRows`, `findDartFoldRows`, `findVisitScoring`, `findHomeScoring`, `findHitNumberCells`, `findIntentCells`, `findIntentMoments`, `findBucketedSessionAggregates`, `findRoutineRunBuckets`, `findStepBuckets`, `findStepFoldRows`, `findHeatmapCells` (target null and set), `findHomeHeatmapCells`, `findGameSessionsPage` (with and without `after`), `countGameSessions`, `findStepSessionPage` (with and without `after`), `findX01CheckoutDarts`: render with `bucket: "none"` and `bucket: "week", tz: "Europe/Amsterdam"` where the reader takes a bucket, and `expect({ sql, params }).toMatchSnapshot()`. Fixed scope values (one player id, `from`/`to`, statuses `["COMPLETED"]`, context `"ALL"` or the reader's equivalent).
- [ ] **Step 2:** Run `npx vitest run tests/repositories/statistics-sql-golden.test.ts`; snapshot written; re-run passes. This file's snapshot is never updated in this PR.
- [ ] **Step 3: Commit** `test(stats): rendered-SQL golden for statistics readers`.

### Task F2: One bucket window per reader

**Files:**
- Modify: `app/src/repositories/statistics.repository.ts` (`bucketExprs` neighbourhood and the ten readers below)
- Test: `app/tests/repositories/statistics.repository.test.ts` (add a `bucketWindow` describe via a reader), F1 golden

**Interfaces:**
- Produces (unexported): `bucketWindow(completedAt: Column, q: { from: string; to: string; bucket: Bucket; tz: string | undefined }): { columns: { bucketStart: SQL<string>; bucketEnd: SQL<string> }; groupBy: SQL[] }` — `"none"`: `columns` = `` sql`${q.from}::timestamptz` `` / `` sql`${q.to}::timestamptz` ``, `groupBy: []`; else `nonNull(q.tz ?? null, "tz")`, `bucketExprs(...)`, `groupBy: [bucketStartExpr, bucketEndExpr]`.
- Readers re-expressed as one query each, spreading `...window.columns` where `bucketStart`/`bucketEnd` sat and `.groupBy(...window.groupBy, <existing terms>)`: `findX01FoldRows`, `findDartFoldRows`, `selectVisitScoring`, `findHitNumberCells`, `findIntentCells`, `findIntentMoments`, `findBucketedSessionAggregates`, `findRoutineRunBuckets`, `findStepBuckets`, `findStepFoldRows`.

- [ ] **Step 1: Pin test** in `statistics.repository.test.ts`: `findStepBuckets` with `bucket: "none"` and seeded row `{ sessions: 0, … }` returns `[]`, and the `"none"` SQL has no `group by`. A refactor has no red step; this test and the F1 golden must be green before and after.
- [ ] **Step 2:** Implement `bucketWindow`; migrate one reader; run F1 golden + `statistics.repository.test.ts`; then the remaining nine, re-running after each. A reader whose `"none"` branch differs beyond the window (the `sessions > 0` filter in `findStepBuckets` is one) keeps that difference as a post-query step on `q.bucket === "none"` — the filter is data handling, not a branch of the query.
- [ ] **Step 3:** Golden unchanged, existing tests unmodified and green; `check-dupes.sh` shows the bucket groups gone (stale-row notice expected).
- [ ] **Step 4: Commit** `refactor(stats): one bucket window per reader`.

### Task F3: Remaining statistics repository helpers

**Files:**
- Modify: `app/src/repositories/statistics.repository.ts`
- Test: `statistics.repository.test.ts`, F1 golden

**Interfaces (all unexported):**
- `findX01CheckoutDarts` selects `X01_FOLD_COLUMNS` (move the constant above it).
- `selectHeatmapCells(db: Db, cellMm: number, where: SQL | undefined): Promise<HeatmapCellRow[]>` — the `ix`/`iy` exprs, `count(*)::integer`, `groupBy(sql\`1\`, sql\`2\`)`, row mapping; used by `findHeatmapCells` and `findHomeHeatmapCells`.
- `gameWindowConditions(q: { playerId: string; gameTypeKey: GameTypeKey; from: string; to: string; statuses: string[] }): SQL[]` — player, game type, `gte`/`lt` on `completedAt`, status `inArray`; spread first by `gameSessionConditions` and `findBucketedSessionAggregates` (each keeps its own tail in the current order).
- `stepScopeConditions(q: StepScope): SQL[]` — the six `vStatsRoutineStepFacts` predicates; used by `findStepBuckets`, `findStepSessionPage`, `findStepFoldRows` (and `findStepScopeDartCount` if it repeats them).
- `mapSessionTimings(row: { startedAt: string | null; completedAt: string | null; durationSeconds: number | null; turnCount: number | null; dartCount: number | null }): { startedAt: string; completedAt: string; durationSeconds: number; turnCount: number; dartCount: number }` — `nonNull` each; spread by `mapReplaySessionJoinRow`, `mapReplayStepFactsRow`, `findGameSessionsPage`'s and `findStepSessionPage`'s mappers (they read `turnCount` from it for `neverStarted`).
- `newestFirst(t: { completedAt: Column; sessionId: Column }): SQL[]` — `[desc(completedAt), desc(sessionId)]` for the two page readers, if the page clone survives `mapSessionTimings`.

- [ ] **Step 1:** Per helper: migrate, run golden + repository test. `mapSessionTimings` changes which column name a thrown `nonNull` error names only when several columns are null at once (a view-invariant breach); record that as the one accepted difference in the task report.
- [ ] **Step 2:** `check-dupes.sh`: the `statistics.repository.ts` row is gone. Any group left is named with its reason.
- [ ] **Step 3: Commit** per helper family (`refactor(stats): …`).

### Task F4: Statistics service range and API schema shapes

**Files:**
- Modify: `app/src/services/statistics.service.ts`, `app/src/pages/api/statistics/types.ts`
- Test: `app/tests/services/statistics.service.test.ts`, `app/tests/pages/api/statistics/types.test.ts` (new; no schema test exists for this file)

**Interfaces:**
- `resolveGameSectionRequest` keeps its bucket check first, then target, then calls `resolveSectionRange(db, meta, q)` for status + floored `from` and returns `{ from, statuses, target }`.
- `pages/api/statistics/types.ts`: unexported `const SESSION_TIMING_FIELDS = { startedAt, completedAt, durationSeconds, turnCount, dartCount }` (the existing Zod types), spread in `ReplayHeaderSchema`, `GameSessionListItem`, `StepSessionListItem` at the position those keys sit.

- [ ] **Step 1: Pin test** (green before and after) in `statistics.service.test.ts`: a game section request with `bucket: "week"` on a non-bucketable section and an invalid `target` returns `{ error: "this section does not support bucket" }`.
- [ ] **Step 2:** Re-point; add a schema test that parses one valid replay header and both list items and asserts `Object.keys` order is unchanged.
- [ ] **Step 3:** Run both test files + `npx vitest run tests/pages/api/statistics`; commit `refactor(stats): shared section range and timing schema`.

### Task F5: Close-out and PR F

- [ ] **Step 1:** `check-dupes.sh --update` (expect 32 → 29 rows); decision block (next id) recording `bucketWindow`, the accepted `nonNull` order difference, and any skipped group; File Inventory row updates for `statistics.repository.ts`/`statistics.service.ts` (grep neighbours, never read whole); `00-Context-Map-History.md` entry; `check-context-budget.sh`.
- [ ] **Step 2:** Full gates, final whole-branch review (opus), push, PR (template; `Closes #1172` only if its rows are all gone), subscribe, check-in, stop.

---

## PR G — Phase 3c: CRUD write path, routes, validators

Rows: routine/schedule route pairs (3 groups), `interfaces.ts`/`session.service.ts`, `routine.repository.ts`/`training-session.repository.ts`, `schedule.repository.ts`, `session.repository.ts`, `routine.service.ts`, `score-training`/`tuod` validators, `121`/`three-dart` validators. Issues #1181, #1184.

### Task G1: Route factories for routines and schedules

**Files:**
- Create: `app/src/lib/server/resource-routes.ts`
- Modify: `app/src/pages/api/routines/index.ts`, `routines/[routineId].ts`, `schedules/index.ts`, `schedules/[scheduleId]/index.ts`; types in `app/src/lib/server/types.ts`
- Test: `app/tests/lib/server/resource-routes.test.ts`; existing `tests/pages/api/routines/routines.test.ts`, `schedules/schedules.test.ts` unmodified

**Interfaces:**
- `collectionRoutes<C>(spec: { list: (playerId: string) => Promise<ServiceResult<unknown>>; create: (playerId: string, body: C) => Promise<ServiceResult<unknown>>; createSchema: ZodType<C> }): { GET: APIRoute; POST: APIRoute }` — `POST` answers `201`.
- `itemRoutes<U>(spec: { param: string; get: (playerId: string, id: string) => Promise<ServiceResult<unknown>>; replace: (playerId: string, id: string, body: U) => Promise<ServiceResult<unknown>>; remove: (playerId: string, id: string) => Promise<ServiceResult<unknown>>; updateSchema: ZodType<U> }): { GET: APIRoute; PUT: APIRoute; DELETE: APIRoute }` — `DELETE` answers `204`, no body, `X-Request-Id` header (doc comment moves here).
- Routes become `export const { GET, POST } = collectionRoutes({...})` / `export const { GET, PUT, DELETE } = itemRoutes({ param: "routineId", ... })`.

- [ ] **Step 1: Failing test** `resource-routes.test.ts`: fake services; `GET` ok → 200 envelope; service `{ ok: false, code: "NOT_FOUND" }` → `fail` envelope; `POST` invalid body → parse error response, valid → 201; `DELETE` ok → 204, `null` body, header set; `param` reads `params[param]`.
- [ ] **Step 2:** Run; FAIL (module missing). Implement; re-point the four route files.
- [ ] **Step 3:** Run the new test + both route suites unmodified; `npx astro check` clean (Astro accepts destructured `export const`). Commit `refactor(api): routine and schedule route factories`.

### Task G2: Repository and service helpers

**Files:**
- Modify: `schedule.repository.ts`, `session.repository.ts`, `routine.repository.ts`, `training-session.repository.ts`, `row-helpers.ts`, `routine.service.ts`, `session.service.ts`, `repositories/interfaces.ts`
- Test: the matching existing tests under `tests/repositories/` and `tests/services/`, plus `tests/repositories/row-helpers.test.ts`

**Interfaces:**
- `schedule.repository.ts` (unexported): `ownedSchedule(scheduleId: string, playerId: string): SQL` — `and(eq(id), eq(playerId))`; used by `updateScheduleRecord`, `setActiveSchedule` (both), `clearActiveSchedule`, `deleteScheduleRecord`.
- `session.repository.ts` (unexported): `findActiveSessionWhere(db: Db, playerId: string, ...conditions: SQL[]): Promise<ActiveSessionSummary | undefined>`; the two `findActiveSessionFor*` call it with their own predicates in the current order.
- `row-helpers.ts`: `mapRoutineStepRow(row: { sequenceNumber; exerciseTypeKey; exerciseRulesetVersionKey; gameTypeKey; gameRulesetVersionKey; durationTypeKey; durationValue; defaultConfiguration; stepConfiguration })` returning the nine mapped keys; spread by both repositories at the same position. Row/return types in `repositories/interfaces.ts` beside the existing step types.
- `routine.service.ts` (unexported): `prepareRoutineWrite(db: Db, input: RoutineWriteInput): Promise<{ durationTypeId: string } | ServiceResult<never>>` — `writeIssues` then `findDurationTypeId` with the `"reference data missing"` `INTERNAL_ERROR`; `createRoutine` and `replaceRoutine` call it at the same point (replace keeps `ownWritable` first).
- `repositories/interfaces.ts`: `SessionParticipantRecord` (the four participant fields); `insertSessionWithActiveGuard`'s param becomes `Pick<Required<CreateSessionRecordsInput>, "sessionId" | "participants" | "playerId" | "gameTypeId" | "rulesetVersionId" | "captureModeId" | "inputModeId" | "activeStatusId" | "exerciseTypeId"> & { configuration: Record<string, unknown> }`.

- [ ] **Step 1:** Per file: add one test pinning the helper's contract through its public caller (e.g. `setActiveSchedule` on a foreign id writes nothing; `createRoutine` with missing duration type returns `INTERNAL_ERROR` `"reference data missing"`), confirm green before, migrate, re-run.
- [ ] **Step 2: Commit** per file (`refactor(<area>): …`).

### Task G3: Mode-gated config validation

**Files:**
- Create: `app/src/services/rulesets/mode-gated-config.ts`
- Modify: `score-training/score-training.validator.ts`, `tuod/tuod.validator.ts`, `one-twenty-one/one-twenty-one.validator.ts`, `three-dart.validator.ts`, `five-oh-one/five-oh-one.validator.ts` (if its block matches), `rulesets/types.ts`, `rulesets/interfaces.ts`
- Test: `app/tests/services/rulesets/mode-gated-config.test.ts`; each validator's existing tests unmodified

**Interfaces:**
- `validateModeGatedConfig(schema: ZodTypeAny, config: unknown, modeSupported: boolean, unsupportedIssue: string): ConfigValidationResult` — `{ valid: false, issues: [unsupportedIssue] }` when unsupported, else `safeParse` → `{ valid: false, issues: error.issues }` or `{ valid: true, config: data }`.
- `rulesets/types.ts`: `BatchValidationInput` (the interface's `validateBatch` param, modes optional) and `ModedBatchValidationInput` (modes required); `RulesetValidator.validateBatch` takes `BatchValidationInput`; validators drop their inline param literal for one of the two.

- [ ] **Step 1: Failing test** `mode-gated-config.test.ts`: unsupported → exact issue string; invalid config → Zod issues; valid → parsed data with defaults applied.
- [ ] **Step 2:** Run; FAIL. Implement; migrate each validator keeping its exact issue string; run `npx vitest run tests/services/rulesets`.
- [ ] **Step 3: Commit** `refactor(rulesets): mode-gated config validation`.

### Task G4: Close-out and PR G

- [ ] **Step 1:** `check-dupes.sh --update` (expect 29 → 20 rows); decision block; File Inventory row for `resource-routes.ts` and `mode-gated-config.ts`; `app/src/pages/api/CLAUDE.md` gains no rule (the factory is optional, not mandated); History entry; `check-context-budget.sh`.
- [ ] **Step 2:** Full gates, final whole-branch review, push, PR (`Closes` #1181/#1184 only if their rows are gone), subscribe, check-in, stop.

---

## Not in this plan (next, from the then-remaining baseline)

Client side: `game-stats.store.ts` (6 groups, #1176), `lib/client/api/statistics.ts` (2), `sessions.ts`/`training-sessions.ts` (#1179), `lib/game/rulesets/types.ts` (3, #1182). Engines: `bobs27`/`singles-training`, the four training exercise engines, `switching-chain`/`target-scoring`. Stats: `loose-darts`/`target-accuracy` (#1178). Phase 4: `global.css` (4, #1183), the six `.astro` pairs, test helpers (`replay-games`/`replay-step-games`, the itest pair). Also open: a `respond(result, requestId)` envelope helper for the other ~20 route files (not a baseline row; owner call).
