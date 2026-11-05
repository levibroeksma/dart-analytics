# Duplication Backlog Phase 4a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the client-side and schema clones left after Phase 3c (PR H): the stats store, the client API modules, the ruleset config schemas and the two intent-cell stats folds, without changing behaviour or output.

**Architecture:** Same method as Phases 0–3c: extract typed helpers next to the code, migrate every copy, let the existing tests plus a pin test per helper prove nothing moved, then lower `scripts/dupes-baseline.txt`. Store getters keep their names and return shapes; helpers live in `modules/` (pure) so the Alpine store stays a thin consumer.

**Tech Stack:** TypeScript, Zod, Alpine.js stores, Vitest, fallow.

**Spec:** `docs/superpowers/specs/2026-10-31-duplication-backlog-design.md` (Phase 4, client side). Baseline at start: 22 rows, from `main` at `cb7773d`. Issues: #1176 (store), #1179 (client API), #1182 (ruleset types), #1178 (stats modules).

## Global Constraints

- No behaviour change. Every store getter returns the same values in the same order; every client API function throws the same error class with the same `code`/`message` (and `requestId`/`details` where it had them); every ruleset schema accepts and rejects the same inputs and parses to the same object with the same key order.
- Existing test assertions are never weakened or re-pointed. Tests may gain additions, imports, or construction changes only.
- No per-caller boolean flags. Variation goes through parameters that carry data (a schema, a field list, an accessor). A group that needs a flag is skipped and named, with the reason, in the task report.
- Object key order is preserved (spread shared fields at the position the keys sat).
- Exported types go in the area's `types.ts` (stores and modules: `@modules/types`, `@lib/types`, `@client/types`); no `//` comments inside function bodies in `app/src`.
- Incidental findings become `discovered-work` issues, never fixes.
- No visual change: no `.astro`, CSS or token edit, so the D524 design-system rules do not apply. State that in the PR body; the pre-PR design-sync question is still asked by `finishing-a-dart-branch`.
- Gates per task: `cd app && npx vitest run <area>`. At PR end: `npm test`, `npx astro check --minimumFailingSeverity hint`, `bash ../scripts/fallow-gate.sh`, `npm run format:check`, `bash ../scripts/check-dupes.sh`, `bash scripts/check-refinement-coverage.sh`. `validate:app` skips fallow without `DATABASE_URL`; run it locally.
- Never `prettier --write` docs. Decision id from `bash scripts/next-decision-id.sh` at write time (D525 expected). History version re-checked at write time (1.204.0 latest; 1.205.0 expected unless main moved).
- Owner reviews and merges the PR; work stops after it opens. Branch `claude/duplication-phase-4a` from `origin/main`.

## Review Focus

- `favoriteTarget`/`weakestTarget`/`favoriteDouble`/`weakestDouble` still return `null` when no row has `MIN_TARGET_SAMPLE` attempts, and on a rate tie keep the first row (`reduce` with strict `>` / `<`).
- `accuracyRows`/`doubleRows` with no loaded series still return `[]`, and an unloaded `checkout-rate`/`bust-rate` series still yields every `REMAINING_BANDS` entry with zero totals and `rate: null`.
- A client API call that fails still throws the same class: `SessionApiError` from `sessions.ts`/`training-sessions.ts` (with `requestId` and `details`), `StatisticsApiError` from `statistics.ts` (code and message only).
- `import { SessionApiError } from "./sessions"` still resolves for every existing importer; `instanceof` across modules still holds (one class, not two).
- `ScoreTrainingConfig` and `TuodConfig` still reject `duration_value` 0 and 101 for ROUNDS and 2 and 31 for MINUTES with the same message; every touched schema keeps its `Object.keys(shape)` order and `.strict()` rejection of unknown keys.
- `loose-darts` and `target-accuracy` buckets still sum `sampleSize` per row's `darts` and key by `intendedKey(row)`.

---

## Task H1: Client API error handling

**Files:**
- Create: `app/src/lib/client/api/session-api-error.ts`
- Modify: `app/src/lib/client/api/sessions.ts`, `app/src/lib/client/api/training-sessions.ts`, `app/src/lib/client/api/unwrap.ts`, `app/src/lib/client/api/statistics.ts`
- Test: `app/tests/lib/client/api/sessions.test.ts`, `training-sessions.test.ts`, `statistics.test.ts`, `unwrap.test.ts` (additions only)

**Interfaces:**
- `session-api-error.ts`: `export class SessionApiError extends Error` — the class moved unchanged (constructor `(code, message, requestId?, details?)`, `name = "SessionApiError"`). `sessions.ts` re-exports it (`export { SessionApiError } from "./session-api-error"`) so no importer changes. `unwrap.ts` imports from the new file, which removes the `sessions.ts` ↔ `unwrap.ts` cycle its header comment describes; update that comment.
- `sessions.ts` and `training-sessions.ts`: every inline `if (!result.ok) throw new SessionApiError(…)` block becomes `return unwrapOrThrow(result)`.
- `statistics.ts` (unexported): `unwrapStatistics<T>(result: ApiResult<T>): T` throwing `StatisticsApiError(code, message)`; and `appendPage(params: URLSearchParams, q: { limit?: number; cursor?: string }): URLSearchParams` setting `limit`/`cursor` when defined. Used by `fetchGameSessions`, `fetchSessionReplay`, the routine step sessions fetch and every other `fetch*` in the file.

- [ ] **Step 1: Pin tests.** Per module add one test through a public caller that a failing envelope throws the right class with the right fields: `createSession` → `SessionApiError` with `requestId` and `details`; `resumeTraining` → same; `fetchGameSection` → `StatisticsApiError` with `code` and `message`; plus `error instanceof SessionApiError` when imported from `./sessions` and from `./session-api-error` (same class). In `unwrap.test.ts` add the same instanceof check. Run them against the current code; all green.
- [ ] **Step 2:** Move the class, re-export, switch `unwrap.ts`; run `npx vitest run tests/lib/client/api`.
- [ ] **Step 3:** Migrate `sessions.ts` and `training-sessions.ts` to `unwrapOrThrow`; run the same suite.
- [ ] **Step 4:** Add `unwrapStatistics` and `appendPage` to `statistics.ts`; migrate every call; run the suite.
- [ ] **Step 5: Commit** per file (`refactor(client-api): …`).

## Task H2: Stats store helpers

**Files:**
- Create: `app/src/modules/stats/sections/hit-rate-rows.module.ts`
- Modify: `app/src/stores/game-stats.store.ts`, `app/src/modules/types.ts`
- Test: `app/tests/modules/stats/sections/hit-rate-rows.module.test.ts` (new); `app/tests/stores/game-stats.store.test.ts` unmodified

**Interfaces** (`hit-rate-rows.module.ts`; the types `HitRateRow` and `HitRateTotals` go in `@modules/types`):
- `HitRateRow = { targetKey: string; attempts: number; hits: number; rate: number }`.
- `hitRateRows(series: CachedSeries<Record<string, { attempts: number; hits: number }>> | undefined): HitRateRow[]` — sums attempts and hits per target across buckets, `rate` is `0` at zero attempts, sorted ascending by rate (stable); `[]` for `undefined`. Replaces the bodies of `accuracyRows` and `doubleRows`.
- `bestRate(rows: readonly HitRateRow[], minAttempts: number): HitRateRow | null` and `worstRate(…)` — rows with at least `minAttempts`; `null` when none; ties keep the first. Replace the four favorite/weakest getter bodies (the getters stay, passing `MIN_TARGET_SAMPLE`).
- `sumInBand<M>(series: CachedSeries<Record<string, M>> | undefined, band: { low: number; high: number }, pick: (m: M) => readonly number[]): number[]` — sums each picked field over every metric whose key, as a number, falls within `[low, high]`; used by `checkoutRateBands` and `bustRateBands`. Zeros for an undefined series.
- `seriesKeys(series: CachedSeries<Record<string, unknown>> | undefined): string[]` — sorted union of the metric keys across buckets; used by `atcConfigGroups` and `bobs27ConfigGroups`.

- [ ] **Step 1: Failing tests** `hit-rate-rows.module.test.ts`: `hitRateRows` over two buckets merges a target, gives `rate` 0 at zero attempts, sorts ascending, returns `[]` for `undefined`; `bestRate`/`worstRate` return `null` below `minAttempts` and keep the first of a tie; `sumInBand` includes both band edges and returns zeros for `undefined`; `seriesKeys` unions and sorts. Run; FAIL.
- [ ] **Step 2:** Implement the four helpers and the types; run the module test; PASS.
- [ ] **Step 3:** Migrate the store getters one group at a time (accuracy/double rows, favorite/weakest ×4, bands ×2, config groups ×2), running `npx vitest run tests/stores/game-stats.store.test.ts tests/modules/stats` after each. `groupingRows` keeps its own fold (different accumulator) — leave it unless the residual group still trips the baseline, then report.
- [ ] **Step 4: Commit** `refactor(stats): shared hit-rate rows and band sums for the game stats store`.

## Task H3: Ruleset config schema fragments

**Files:**
- Modify: `app/src/lib/game/rulesets/types.ts`
- Test: `app/tests/lib/game/rulesets/` — the existing `refinement-contract` and ruleset schema suites (unmodified) plus one new `schema-shape.test.ts`

**Interfaces** (all unexported, declared above their first use in `types.ts`):
- `durationValueRefinement(val: { duration_type: "ROUNDS" | "MINUTES"; duration_value: number }, ctx: z.RefinementCtx): void` — the `[1, 100]`/`[3, 30]` bound and the exact message `duration_value must be between ${min} and ${max} for ${val.duration_type}`; `ScoreTrainingConfig` and `TuodConfig` call `.superRefine(durationValueRefinement)`.
- Shared field consts spread at their current positions: `maxDartsPerTurnField` (`z.number().int().min(1).max(3)`), `maxVisitScoreField` (`z.number().int().default(180)`), and the Singles V2/V3 common field block (`order_mode`, `target_order`, `difficulty`) as one object spread. The 501 V1/V2 shared block (`starting_score`, `check_in`, `check_out`, `max_darts_per_turn`, `max_visit_score`) as one spread, keeping each schema's own `legs_to_win`/`legs`/`sets` where they sit now.

- [ ] **Step 1: Pin test** `schema-shape.test.ts`: for `ScoreTrainingConfig`, `TuodConfig`, `SinglesV2Config`, `SinglesV3Config`, `FiveOhOneConfig`, `FiveOhOneV2Config` assert the key order of a parsed minimal valid config, rejection of an unknown key, and the duration bound messages for the two duration schemas. Run against the current code; green.
- [ ] **Step 2:** Add the refinement and migrate the two schemas; run `npx vitest run tests/lib/game/rulesets tests/services/rulesets` and `bash ../scripts/check-refinement-coverage.sh`.
- [ ] **Step 3:** Add the field fragments and migrate; re-run both.
- [ ] **Step 4: Commit** `refactor(rulesets): shared duration refinement and config field fragments`.

## Task H4: Intent-cell stats fold

**Files:**
- Modify: `app/src/modules/stats/sections/intent-cells.module.ts`, `target-accuracy.module.ts`, `loose-darts.module.ts`
- Test: `app/tests/modules/stats/sections/intent-cells.module.test.ts` (addition); the two sections' existing tests unmodified

**Interfaces:**
- `intentCellBuckets<M>(rows: readonly IntentCellRow[], ctx: { to: string; now: Date }, empty: () => M, add: (entry: M, row: IntentCellRow) => void): SeriesBucket<Record<string, M>>[]` in `intent-cells.module.ts` — the loop both modules share: `bucketFor` per row, `sampleSize += row.darts`, entry at `intendedKey(row)` from `empty()` (get-or-create), `add`, then `closeBuckets`. `targetAccuracyBuckets` passes `{ attempts: 0, hits: 0 }` and the `isHit` increment; `looseDartsBuckets` passes `{ onTarget: 0, nearMiss: 0, loose: 0 }` and its `classifyLanding` increment. Both stay exported with their signatures.

- [ ] **Step 1: Failing test** for `intentCellBuckets` with a custom `empty`/`add`: two rows on one target and bucket share one entry, `sampleSize` sums `darts`, buckets close per `ctx`. Run; FAIL.
- [ ] **Step 2:** Implement; migrate both modules; run `npx vitest run tests/modules/stats`.
- [ ] **Step 3: Commit** `refactor(stats): shared intent-cell fold for target-accuracy and loose-darts`.

## Task H5: Close-out (PR H)

**Files:**
- Modify: `scripts/dupes-baseline.txt`, a decision block in `decisions/frontend/architecture.md` or the domain file `DECISIONS.md` routes stats-client work to, `docs/architecture/00-File-Inventory.md`, `docs/architecture/00-Context-Map-History.md`

- [ ] **Step 1:** `bash scripts/check-dupes.sh --update`; confirm only the five target rows dropped (22 → about 17); note any residual store row.
- [ ] **Step 2:** Decision block (id from `bash scripts/next-decision-id.sh`, D525 expected; extends D513/D521/D522): the helpers added, `SessionApiError` moved to `session-api-error.ts` with a re-export, skipped on purpose (`score-training.validator.ts | tuod.validator.ts`: Score Training checks its rounds limit on both capture modes, TUOD only on quick score, so sharing the batch gate needs a per-mode flag; #1184 stays open), baseline numbers.
- [ ] **Step 3:** File Inventory rows for `session-api-error.ts` and `hit-rate-rows.module.ts`; History entry (re-check the version at write time).
- [ ] **Step 4:** `bash scripts/check-context-budget.sh`, then the full gates from Global Constraints.
- [ ] **Step 5:** Final whole-branch review (opus), push, open the PR from `.github/pull_request_template.md` (`Closes` #1176, #1179, #1182, #1178 only where their rows are gone), subscribe, arm the check-in, stop.

---

## Not in this plan (next, from the remaining baseline)

`score-training`/`tuod` `validateBatch` (#1184, needs a flag as above). Engines: `bobs27`/`singles-training`, the four training exercise engines, `switching-chain`/`target-scoring`. Phase 4b: `global.css` (4, #1183), the six `.astro` pairs (design-system rules apply, D524), test helpers (`replay-games`/`replay-step-games`, the itest pair). Also open: a `respond(result, requestId)` envelope helper for the other ~20 route files (not a baseline row; owner call).
