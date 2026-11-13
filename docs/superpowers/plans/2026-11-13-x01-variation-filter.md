# 501 Variation Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Variations" dropdown on the 501 statistics page selects one starting score (default 501); every 501 section, the heatmap and the session list read only that variation.

**Architecture:** A `variation` query parameter (the integer `starting_score`) joins the Common Query Contract for the `501` game only. The repository adds one predicate on `COALESCE(configuration->>'starting_score', 501)` to its shared scope builders; dart-fact reads (which lack the snapshot) filter through a `session_id IN (…)` sub-select, the pattern `routineStepCondition` already uses. A new read lists the owner's variations. The client carries `variation` through the cache key, the fetch helpers and the page scope.

**Tech Stack:** Astro, TypeScript, Alpine.js, Drizzle (read-only), Zod, Vitest. No migration.

**Spec:** `docs/superpowers/specs/2026-11-13-x01-variation-filter-design.md`

## Global Constraints

- Variation key = integer `starting_score`; absent snapshot or absent `starting_score` counts as `501`.
- `variation` is accepted on game type `501` only; any other game, and every routine route, rejects it with `VALIDATION_FAILED`. Valid range is an integer 2–999 (the setup form's bounds); non-numeric, empty or out-of-range is `VALIDATION_FAILED`.
- Absent `variation` on a `501` game request (non-routine) means `501`. With `routineStep` set, no variation filter applies.
- A valid variation with no sessions returns the normal empty result, never an error.
- The variations list covers completed `VISUAL_BOARD` sessions of the `501` game for the owner; `501` is always listed; order is `501` first, then ascending. Entry label: the score, with the session count.
- `dataVersion` is unchanged (game-wide).
- Reads go through `v_*` views; Controller → Service → Repository. No migration. No comments inside function bodies in `app/src/**/*.ts`.
- `variation` joins `paramsKey` so each variation caches separately.
- Selection is remembered per viewer via `$persist` in a store (never in a component); a remembered score absent from the list falls back to 501.
- `mi_average` ratchet margin is about 0.0002 (#1327): do not add below-average code; keep new modules small.
- Gates after each task that touches `app/`: `cd app && npm run validate:app`, then `npm run format`.

## Review Focus

1. A 501 session with no config snapshot or no `starting_score` counts as 501 in sections and in the list. Test in Task 2 (predicate) and Task 3 (list).
2. A custom score typed as 501 merges with the preset: two sessions stored as 501 give one entry with count 2. Test in Task 3.
3. Rapid switching 501 → 301 → 501 never shows a stale response or a wrong cached series. Tests in Task 4 (cache key) and Task 5 (ticket).
4. `variation=` empty, `abc`, `1`, `1000` all return `VALIDATION_FAILED`; `variation=301` on `121` returns `VALIDATION_FAILED`. Tests in Task 3.
5. A remembered variation that no longer has sessions falls back to 501 and the dropdown lists what exists. Test in Task 5.

---

### Task 1: Docs and decision (docs-first)

**Files:**
- Modify: `docs/architecture/10-Statistics/00-Overview.md` (§5 parameter table: add a `variation` row; §6 route table: add `GET games/501/variations`)
- Modify: `docs/architecture/10-Statistics/01-Section-Catalog.md` (one paragraph near §2.1: the filter applies to every 501 section)
- Modify: `docs/architecture/06-API/04-Endpoint-Contracts.md` (Statistics Games: `variation` parameter on sections and sessions; new variations endpoint; bump the contract version)
- Modify: `decisions/api.md` (append the next free `D5xx`: 501 variation is a derived read-time filter on `starting_score`; no stored column; `501` default; 501-only)
- Modify: `docs/architecture/00-File-Inventory.md`, `docs/architecture/00-Context-Map-History.md` (rows and history entry for files added in later tasks; add rows as each file lands, and finish them in this task's final commit only if the file list is final — otherwise in Task 5)

**Interfaces:**
- Produces: the parameter name `variation`, response shape `{ variations: { startingScore: number; sessions: number }[] }`, route `GET /api/statistics/games/501/variations`. Later tasks implement exactly these.

- [ ] **Step 1:** Edit the three docs and the ledger so each states the Global Constraints above verbatim where they apply (parameter row, rejection rules, default, list ordering and population, routine routes exempt).
- [ ] **Step 2:** Run `bash scripts/check-context-budget.sh` and the docs gates `run-all-gates` selects for `docs/`; expected: pass.
- [ ] **Step 3: Commit** `docs: 501 variation filter contract`.

### Task 2: Repository predicate and variations read

**Files:**
- Modify: `app/src/modules/stats/types.ts` (add `variation?: number` to `DartScope` and `SessionScope`)
- Modify: `app/src/repositories/statistics.repository.ts`
- Test: `app/tests/repositories/statistics.repository.test.ts`

**Interfaces:**
- Produces:
  - `DartScope.variation?: number`, `SessionScope.variation?: number`, `GameSessionsFilter.variation?: number`; the bucketed-aggregate query param gains `variation?: number`.
  - `findGameVariations(db: Db, playerId: string, gameTypeKey: GameTypeKey): Promise<{ startingScore: number; sessions: number }[]>` — completed `VISUAL_BOARD` sessions grouped by the COALESCEd score, ascending by score (the service adds 501 and orders).

- [ ] **Step 1: Write failing tests** (use the file's existing SQL-render helper):
  - `sessionScopeWhere adds the starting-score predicate when variation is set` — a scope with `variation: 301` renders `coalesce(` … `'starting_score'` … `501` and binds `301`; a scope without it renders neither.
  - `dartScopeWhere filters dart facts through a session sub-select` — with `variation: 301`, rendered SQL contains `session_id IN (SELECT` over `v_stats_session_facts` with the predicate, and binds the player id and `301`.
  - `gameSessionConditions and bucketed aggregates carry the predicate` — `countGameSessions`, `findGameSessionsPage` and `findBucketedSessionAggregates` each render the predicate when `variation` is set.
  - `findGameVariations groups by coalesced starting score` — rendered SQL groups by the expression, filters `status_key = 'COMPLETED'` and `input_mode_key = 'VISUAL_BOARD'`, orders ascending.
- [ ] **Step 2:** Run `cd app && npx vitest run tests/repositories/statistics.repository.test.ts`; expected: the four new tests FAIL.
- [ ] **Step 3: Implement** in `statistics.repository.ts`:
  - `variationExpr(): SQL` — the shared `coalesce((${vStatsSessionFacts.configuration} ->> 'starting_score')::int, 501)` expression.
  - `variationCondition(variation: number | undefined): SQL | undefined` — `variationExpr() = variation`, or `undefined`; appended to the condition lists of `sessionScopeWhere`, `gameSessionConditions`, and the inline conditions of `findBucketedSessionAggregates`.
  - `dartVariationCondition(playerId: string, variation: number | undefined): SQL | undefined` — `vStatsDartFacts.sessionId IN (SELECT session_id FROM v_stats_session_facts WHERE player_id = $p AND <expr> = $v)`; appended in `dartScopeWhere`.
  - `findGameVariations` per the Interfaces block.
- [ ] **Step 4:** Rerun the file; expected: PASS.
- [ ] **Step 5:** Fixture check — in `app/tests/integration/fixtures/stats-world.ts`'s existing pattern, add a test only if the file already runs SQL against a database in CI; otherwise the render tests stand. (Builder decides; say which in the report.)
- [ ] **Step 6: Commit** `feat(stats): variation predicate and variations read`.

### Task 3: Contract, service and routes

**Files:**
- Modify: `app/src/lib/game/five-oh-one-starting-score.ts` (export `FIVE_OH_ONE_STARTING_SCORE_MAX`; drop the stale fallow-ignore on MIN only if it now has a consumer)
- Modify: `app/src/pages/api/statistics/types.ts` (`StatisticsRangeQuery` gains `variation`; add `GameVariationsResponse` schema)
- Modify: `app/src/pages/api/statistics/games/[gameTypeKey]/sections/[sectionId].ts`, `.../sessions.ts` (add `"variation"` to `PICKED_KEYS`)
- Create: `app/src/pages/api/statistics/games/[gameTypeKey]/variations.ts`
- Modify: `app/src/services/statistics.service.ts`
- Test: `app/tests/pages/api/statistics/types.test.ts`, `app/tests/services/statistics.service.test.ts`, a route test beside the existing route tests for `variations.ts`

**Interfaces:**
- Consumes: Task 2's scope fields and `findGameVariations`.
- Produces:
  - `StatisticsRangeQuery` field `variation?: number` (`z.coerce.number().int().min(FIVE_OH_ONE_STARTING_SCORE_MIN).max(FIVE_OH_ONE_STARTING_SCORE_MAX)`, optional).
  - `resolveVariation(gameTypeKey: GameTypeKey, requested: number | undefined, routineStep: RoutineStepScope | undefined): { variation: number | undefined } | { error: string }` — non-501 or routine + requested → error; routine → `undefined`; 501 → `requested ?? 501`; otherwise `undefined`.
  - `SectionContext.variation?: number`, passed by `dartScope`, `sectionScope`, `loadBucketedSessions`; `listGameSessions` passes it into its filter.
  - `listGameVariations(playerId: string, gameTypeKey: GameTypeKey): Promise<ServiceResult<{ variations: { startingScore: number; sessions: number }[] }>>` — non-501 → `NOT_FOUND`; always contains 501 (count 0 if absent); 501 first, then ascending.

- [ ] **Step 1: Write failing tests:**
  - `types.test.ts`: `variation: "301"` parses to `301`; `""`, `"abc"`, `"1"`, `"1000"` each fail.
  - service: `resolveVariation` table — (501, undefined, no step) → 501; (501, 301, no step) → 301; (121, 301, no step) → error; (121, undefined) → undefined; (501, undefined, step) → undefined; (501, 301, step) → error.
  - service: `getGameSection on 501 reads only the requested variation` — the repository spy receives `variation: 301` in the section scope; without the param it receives `501`; on `121` it receives `undefined`. A rejected case returns `VALIDATION_FAILED`.
  - service: `listGameSessions passes the variation into the filter` for 501 (default 501) and not for other games.
  - service: `listGameVariations` — repository rows `[{701,2},{501,3},{301,1}]` → `[501,301,701]`; rows without 501 → 501 first with `sessions: 0`; a custom score stored as 501 contributes to the single 501 entry (rows are already grouped; the test pins the single entry).
  - route test: `variations` returns the envelope for 501; `NOT_FOUND` for `121`.
- [ ] **Step 2:** Run `cd app && npx vitest run tests/pages/api/statistics tests/services/statistics.service.test.ts`; expected: new tests FAIL.
- [ ] **Step 3: Implement** the Interfaces block. `resolveVariation` is called from `resolveGameSectionRequest` and `listGameSessions`; both turn an `error` into `VALIDATION_FAILED`. `variations.ts` follows `sessions.ts`'s `statisticsRoute` shape with a no-query schema.
- [ ] **Step 4:** Rerun; expected: PASS. Then `npm run validate:app`.
- [ ] **Step 5: Commit** `feat(stats): variation parameter and variations endpoint`.

### Task 4: Client API and cache key

**Files:**
- Modify: `app/src/lib/client/api/types.ts` (`GameStatsRangeParams.variation?: number`; `GameVariationsResponseData`)
- Modify: `app/src/lib/client/api/statistics.ts`
- Modify: `app/src/lib/client/stats-cache/types.ts`, `app/src/lib/client/stats-cache/keys.ts`
- Modify: `app/src/lib/stats/load-game-section.ts`, `app/src/lib/stats/types.ts` (`GameSectionRange` gains `variation?: number`)
- Test: `app/tests/lib/client/stats-cache/keys.test.ts`, `app/tests/lib/stats/load-game-section.test.ts`, the existing client-api statistics test

**Interfaces:**
- Produces:
  - `fetchGameVariations(gameTypeKey: string): Promise<GameVariationsResponseData>`.
  - `rangeSearchParams` sets `variation` when defined.
  - `StatsCacheParams.variation?: number`; `paramsKey` includes `variation` only when defined (existing keys for other games stay byte-identical).
  - `variationParam(gameTypeKey: GameTypeKey, selected: number): number | undefined` in `app/src/lib/stats/variation.ts` — returns `selected` only for `"501"`, else `undefined`. Every client call site uses it so other games never send the parameter.

- [ ] **Step 1: Write failing tests:**
  - `keys.test.ts`: `paramsKey differs between variation 301 and 501` and `paramsKey is unchanged when variation is undefined` (equals the pre-change string).
  - `load-game-section.test.ts`: `loadGameSection forwards variation to the fetch and the cache query`.
  - client-api test: `fetchGameSection puts variation=301 in the query string`; `fetchGameVariations calls /api/statistics/games/501/variations`.
  - `variation.test.ts`: `variationParam returns the score for 501 and undefined for 121`.
- [ ] **Step 2:** Run those files; expected: FAIL.
- [ ] **Step 3: Implement** per Interfaces.
- [ ] **Step 4:** Rerun; expected: PASS.
- [ ] **Step 5: Commit** `feat(stats): carry variation through client api and cache key`.

### Task 5: Page state, selector and section wiring

**Files:**
- Create: `app/src/stores/stats-variation.store.ts` (persisted selection, follows `board-input.store.ts` and its registration; one `$persist` field, fresh `persist()` per field)
- Create: `app/src/lib/stats/sections/game-variations.data.ts` — `gameVariations()` Alpine factory
- Create: `app/src/components/layout/games/statistics/GameVariationSelect.astro`
- Modify: `app/src/pages/statistics/index.astro` (page scope gains `variation: $store.statsVariation.value`; mount the selector under the two existing selects, shown only when the page game maps to `501`)
- Modify: `app/src/lib/stats/sections/period-section.ts`, `game-heatmap.data.ts`, `game-session-list.data.ts` (watch `variation`, pass `variationParam(...)`)
- Modify: `app/src/stores/game-stats.store.ts` (`variation` state; `load`, `fetchCheckoutPath`, `loadHeatmap`, `loadMoreSessions` pass it)
- Modify: `docs/architecture/00-File-Inventory.md`, `00-Context-Map-History.md`, `07-Frontend/08-Component-Inventory.md` if the component is listed there
- Test: `app/tests/stores/stats-variation.store.test.ts`, `app/tests/lib/stats/sections/game-variations.data.test.ts`, `period-section.test.ts`, `game-heatmap.data.test.ts`, `game-session-list.data.test.ts`, `app/tests/stores/game-stats.store.test.ts`

**Interfaces:**
- Consumes: `fetchGameVariations`, `variationParam`, `loadGameSection` with `variation`.
- Produces:
  - `statsVariation` store: `value: number` (default 501), `set(score: number): void`.
  - `gameVariations()`: `{ options: { value: number; label: string }[]; loading: boolean; init(): void; load(): Promise<void> }`; reads page-scope `game`; label `"<score> (<sessions>)"`; after load, if page-scope `variation` is not among the options it sets `variation = 501`; a `game` change resets `variation` to 501 and reloads.
  - Every section factory and the store refetch on a `variation` change with the existing ticket guard.

- [ ] **Step 1: Write failing tests:**
  - store: `statsVariation defaults to 501 and persists a set value`.
  - `game-variations.data.test.ts`: options come back ordered `501, 301, 701` with count labels; `falls back to 501 when the remembered score is absent`; `a game change resets the selection to 501`.
  - `period-section.test.ts` / heatmap / session list: `refetches with variation=301 after the page variation changes` and `drops a stale response after a quick 301 → 501 switch` (ticket); `does not send variation for a non-501 game`.
  - `game-stats.store.test.ts`: `load passes variation to every section read on 501 and omits it on 121`.
- [ ] **Step 2:** Run the files; expected: FAIL.
- [ ] **Step 3: Implement** per Interfaces. The selector uses `components/forms/Select.astro` (`optionsExpr="options"`, `model="variation"`, `ariaLabel="Variations"`) under a visible "Variations" label; check `08-Component-Inventory.md` first and follow `building-a-component`. Visual details follow the Design System artifact; ask the owner before the PR whether to run the design sync (D524).
- [ ] **Step 4:** Rerun; expected: PASS. Then `node scripts/screenshot-page.mjs /statistics` from `app/` and Read the PNG to confirm the control renders in both themes.
- [ ] **Step 5:** `npm run format`, `npm run validate:app`, `bash scripts/check-dupes.sh`, and the quality ratchet via `run-all-gates`; expected: all pass, `mi_average` not lower.
- [ ] **Step 6: Commit** `feat(stats): 501 variations dropdown`.

---

## Self-review

- **Spec coverage:** parameter and rejection rules (Task 3); default 501 and routine exemption (Task 3); every read carries the predicate (Task 2); list endpoint, ordering, 501 always present, merge of custom 501 (Task 3); cache separation (Task 4); dropdown, persistence, fallback, per-section refetch (Task 5); docs, decision (Task 1). Home page is out of scope, as the spec says.
- **Type consistency:** `variation?: number` everywhere; `startingScore` / `sessions` in both the repository row and the response; `resolveVariation` and `variationParam` are defined once and referenced by name.
- **Known builder checks:** Task 2 Step 5 (integration fixture) and Task 5's registration of the new store are the two places the builder must read an existing sibling before writing.
