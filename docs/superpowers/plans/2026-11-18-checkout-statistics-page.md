# Checkout Statistics Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A dedicated `/statistics` layout for 121 (V1, V2) and Ten Up One Down. It shows four period-comparison tiles and three cards (finish rate by target range, double hit rate, common routes) over existing server sections.

**Architecture:**
- Pure derivations in `lib/stats/checkout/`.
- Two Alpine section factories in `lib/stats/sections/`, using the Ace pattern (`latestCardLoad`, `precedingWindow`, un-bucketed reads).
- A new `CheckoutStatsOverview.astro` behind a `CHECKOUT_LAYOUTS` set.
- The store's private ladder and route helpers move to `lib/stats/checkout/` so they are not copied.

**Tech Stack:** Astro, Alpine.js, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-18-checkout-statistics-page-design.md`

## Global Constraints

- Rulesets: `121_V1`, `121_V2`, `TUOD_V1`. Game types: `ONE_TWENTY_ONE` (start 121) and `TUOD` (start 41).
- Thresholds:
  - A tile's change needs `MIN_TARGET_SAMPLE` (30) in both periods' denominators.
  - A range row's rate needs `MIN_ROW_SAMPLE` (10) goes.
- Bands are 20 wide, aligned to the start score, and the top band ends at 170. TUOD targets below 41 form one band, "2–40", shown first. Empty bands are omitted.
- Tile copy:
  - Change: "+x pp vs previous period" (`formatPointDelta`). Highest target: "+12 vs previous period", a signed integer, with "±0" for no change.
  - "No comparison yet" below the floor; "No earlier period" for All Time; "No goes yet" when the current period is empty.
- Only owner darts count (the server already scopes this).
- No inline comments in `app/src/**` function bodies. JSDoc above declarations only.
- One test per changed runtime `.ts`. Tests go under `app/tests/`, mirroring `src/`.
- Gates: `npm test`, `npx astro check` 0/0/0, `npm run format:check`, `scripts/check-*.sh` per the `run-all-gates` skill, quality ratchet `mi_average` ≥ 91.0.

## Review Focus

1. **TUOD after a run of misses:** targets below 41 (down to 2) must land in the "2–40" band, not vanish or produce a band starting at 1. Pinned in Task 1.
2. **121 at the cap:** target 170 lands in "161–170", and no band ends above 170. Pinned in Task 1.
3. **All Time:** no preceding read is made, and every tile says "No earlier period". Pinned in Task 4.
4. **Period with goes but no after-miss go** (every go finished): Recovery shows "–" with "No misses yet" rather than NaN. Pinned in Task 2.
5. **Route picker with no data, or the selected target missing after a period change:** the picker resets to the highest available target, or to `null` with an empty table and no error. Pinned in Task 4.

---

### Task 1: Move shared helpers out of the store and the Ace tiles

**Files:**
- Create: `app/src/lib/stats/checkout/ladder-totals.ts`
- Create: `app/src/lib/stats/checkout/checkout-routes.ts`
- Create: `app/src/lib/stats/sections/comparison-tile.ts`
- Modify: `app/src/stores/game-stats.store.ts`. Delete `sumLadderTargets`, `combineMaxTarget`, `bandLadderTargets` and `LADDER_BAND_SIZE`. `ladderSummary`, `checkoutPathRemainings` and `pathsFor` now delegate to the new modules.
- Modify: `app/src/lib/stats/ace/ace-comparison-lines.ts`. Use `ratioTile` and delete its private `changeDetail` and `measureTile`.
- Test: `app/tests/lib/stats/checkout/ladder-totals.test.ts`, `app/tests/lib/stats/checkout/checkout-routes.test.ts`, `app/tests/lib/stats/sections/comparison-tile.test.ts`. The existing `tests/stores/game-stats.store.test.ts` and `tests/lib/stats/ace/*` must stay green unchanged.

**Interfaces:**
- Produces:
  - `type LadderTotal = { attempts: number; successes: number }`
  - `sumLadderTargets(buckets: readonly SeriesBucket<LadderProgressMetrics>[]): { totals: Map<string, LadderTotal>; maxTarget: number | null; afterMiss: number; recovered: number }`. Moved as is.
  - `type LadderBand = { start: number; end: number; attempts: number; successes: number; rate: number | null }`
  - `ladderBands(totals: ReadonlyMap<string, LadderTotal>, opts: { origin: number; size: number; cap: number; minSample: number }): LadderBand[]`, ascending by `start`:
    - A target `t ≥ origin` goes to the band starting at `origin + floor((t − origin) / size) * size`, which ends at `min(start + size − 1, cap)`.
    - A target `t < origin` goes to one band, `{ start: 2, end: origin − 1 }`.
    - `rate` is `successes / attempts` when `attempts ≥ minSample`, else `null`.
    - The store calls it with `{ origin: 1, size: 10, cap: 170, minSample: MIN_TARGET_SAMPLE }`, which reproduces today's bands.
  - `pathRemainings(metrics: CheckoutPathMetrics): number[]`: highest first.
  - `routesFor(metrics: CheckoutPathMetrics, remaining: number): { route: string; visits: number; finished: number; finishRate: number }[]`: most visits first. Same as `pathsFor` today.
  - `ratioTile(title: string, measure: AceMeasure, empty: string, prefix?: string): TrackTile`: the moved `measureTile`, with its `changeDetail`.

- [ ] **Step 1: Write failing tests**
  - `ladderBands` with `{ origin: 41, size: 20, cap: 170, minSample: 10 }` over totals `{ "2": 3/1, "40": 2/0, "41": 8/4, "60": 4/2, "165": 10/5 }` (attempts/successes) gives `[{2,40,5,1,null}, {41,60,12,6,0.5}, {161,170,10,5,0.5}]`.
  - `ladderBands` with origin 121 over `{ "170": 1/0 }` gives `[{161,170,1,0,null}]`.
  - `ladderBands` with the store's options over `{ "45": 30/15 }` gives `[{41,50,30,15,0.5}]`.
  - `routesFor` sorts by visits. `pathRemainings` sorts highest first, and gives `[]` for `{}`.
  - `ratioTile` covers three cases:
    - empty current: value "–" and the `empty` text
    - previous null: "No earlier period"
    - both whole ≥ 30, 0.5 vs 0.4: "+10.0 pp vs previous period"
- [ ] **Step 2: Run** `cd app && npx vitest run tests/lib/stats/checkout tests/lib/stats/sections/comparison-tile.test.ts`. Expect FAIL (modules missing).
- [ ] **Step 3: Implement** the three modules, then repoint the store and `ace-comparison-lines.ts` to them.
- [ ] **Step 4: Run** `cd app && npx vitest run tests/lib/stats tests/stores/game-stats.store.test.ts`. Expect PASS, with the store and Ace tests unchanged.
- [ ] **Step 5: Commit** `refactor(stats): share ladder bands, checkout routes and ratio tile`

### Task 2: Checkout comparison model and tiles

**Files:**
- Create: `app/src/lib/stats/checkout/types.ts`. Re-export it from `app/src/lib/stats/types.ts`, as `ace/types.ts` is.
- Create: `app/src/lib/stats/checkout/checkout-comparison.ts`
- Create: `app/src/lib/stats/checkout/checkout-comparison-lines.ts`
- Test: `app/tests/lib/stats/checkout/checkout-comparison.test.ts` and `checkout-comparison-lines.test.ts`

**Interfaces:**
- Consumes: `sumLadderTargets` and `ratioTile` (Task 1); `AceMeasure` and `Ratio` (`ace/types.ts`).
- Produces:
  - `type CheckoutInput = { ladder: SeriesBucket<LadderProgressMetrics>[]; busts: SeriesBucket<BustRateMetrics>[] }`
  - `type PeakMeasure = { current: number | null; previous: number | null; currentGoes: number; previousGoes: number | null }`
  - `type CheckoutComparison = { finish: AceMeasure; peak: PeakMeasure; recovery: AceMeasure; bust: AceMeasure }`
  - `checkoutComparison(current: CheckoutInput, previous: CheckoutInput | null): CheckoutComparison`. The four fields:
    - `finish`: successes over attempts, summed over every target.
    - `peak`: `maxTarget`, with the goes counted as attempts.
    - `recovery`: `recovered` over `afterMiss`.
    - `bust`: busts over visits, summed over every remaining key.
    - With `previous === null`, every `previous` is `null`.
  - `checkoutComparisonTiles(c: CheckoutComparison): TrackTile[]`: four tiles titled "Finish rate", "Highest target", "Recovery rate" and "Bust rate".
    - The three rate tiles use `ratioTile`. Empty texts:
      - Finish rate: "No goes yet"
      - Recovery rate: "No goes yet" when the current goes are 0, else "No misses yet"
      - Bust rate: "No goes yet"
    - The Highest target tile:
      - value: `String(current)`, or "–" when null
      - detail: "No earlier period" when `previousGoes === null`
      - detail: "No comparison yet" when either period's goes are below 30
      - otherwise: `${signed(current − previous)} vs previous period`

- [ ] **Step 1: Write failing tests**
  - `checkoutComparison` with one ladder bucket `{targets:{"41":{attempts:20,successes:8},"51":{attempts:10,successes:2}}, maxTarget:51, afterMiss:18, recovered:6}` and busts `{"2-40":{visits:12,busts:3}}`. Expect:
    - `finish {10/30}`
    - `peak.current 51`
    - `recovery {6/18}`
    - `bust {3/12}`
    - `previous` null throughout
  - Tiles for 30 goes now, 31 before (rate 0.5 vs 0.4, peak 61 vs 51): "Finish rate" "50.0%" "+10.0 pp vs previous period", and "Highest target" "61" "+10 vs previous period".
  - Equal peaks give "±0 vs previous period".
  - Previous goes of 20 give "No comparison yet".
  - Review Focus 4: goes 5, afterMiss 0 gives a Recovery value of "–" and "No misses yet".
- [ ] **Step 2: Run** `cd app && npx vitest run tests/lib/stats/checkout`. Expect FAIL.
- [ ] **Step 3: Implement** both modules and the types.
- [ ] **Step 4: Run** the same command. Expect PASS.
- [ ] **Step 5: Commit** `feat(stats): checkout period comparison tiles`

### Task 3: Checkout cards model

**Files:**
- Create: `app/src/lib/stats/checkout/checkout-cards.ts`
- Test: `app/tests/lib/stats/checkout/checkout-cards.test.ts`

**Interfaces:**
- Consumes: `sumLadderTargets`, `ladderBands`, `pathRemainings`, `routesFor` (Task 1); `hitRateRows` (`modules/stats/sections/hit-rate-rows.module.ts`); `targetLabel` (`lib/stats/target-key.ts`); `formatRate`; `AimTableRow` (`lib/stats/x01/types.ts`).
- Produces:
  - `const CHECKOUT_START: Record<"ONE_TWENTY_ONE" | "TUOD", number> = { ONE_TWENTY_ONE: 121, TUOD: 41 }`
  - `rangeRows(ladder: SeriesBucket<LadderProgressMetrics>[], origin: number): AimTableRow[]`
    - Uses `ladderBands` with `{ origin, size: 20, cap: 170, minSample: MIN_ROW_SAMPLE }`.
    - Row: `{ label: "41–60", count: attempts, cells: [String(successes), formatRate(rate)] }`.
  - `doubleRows(doubles: SeriesBucket<DoublePerformanceMetrics>[]): AimTableRow[]`
    - From `hitRateRows({ buckets })`, sorted by attempts descending, then label.
    - Row: `{ label: targetLabel(key), count: attempts, cells: [formatRate(attempts ≥ MIN_ROW_SAMPLE ? rate : null)] }`.
  - `routeRows(paths: CheckoutPathMetrics, remaining: number | null): AimTableRow[]`
    - `[]` for `null`.
    - Row: `{ label: route, count: visits, cells: [String(finished), formatRate(finishRate)] }`.

- [ ] **Step 1: Write failing tests**
  - `rangeRows` for origin 41 over targets 2, 45 and 165 gives three rows labelled "2–40", "41–60" and "161–170". A 9-goes band shows "–".
  - `doubleRows` labels `DOUBLE:20` as "D20" and puts more attempts first.
  - `routeRows` gives `[]` for `null`, and for 40 lists the "D20" route before "S20 D10" when it has more visits.
- [ ] **Step 2: Run** `cd app && npx vitest run tests/lib/stats/checkout/checkout-cards.test.ts`. Expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expect PASS.
- [ ] **Step 5: Commit** `feat(stats): checkout range, double and route rows`

### Task 4: Section factories

**Files:**
- Create: `app/src/lib/stats/sections/checkout-comparison.data.ts`
- Create: `app/src/lib/stats/sections/checkout-cards.data.ts`
- Modify: `app/src/lib/client/alpine/register-route-data.ts`. Register both factories next to `aceComparisonSection`.
- Test: `app/tests/lib/stats/sections/checkout-comparison.data.test.ts`, `checkout-cards.data.test.ts`, `app/tests/lib/client/alpine/register-route-data.test.ts`

**Interfaces:**
- Consumes: Tasks 2 and 3; `loadGameSection`, `latestCardLoad`, `reloadOnPageFilters`, `heatmapWindow`, `precedingWindow`, `GAME_TYPE_BY_RULESET`.
- Produces:
  - `checkoutComparisonSection()`: scope `{ loading, error, card: CheckoutComparison, init, load, get tiles(): TrackTile[] }`.
    - `loadCheckoutInputOver(gameTypeKey, span)` reads `ladder-progress` and `bust-rate` with `bucket: "none"`. It is called for `heatmapWindow`, and again for `precedingWindow` when that is not null. That is four reads, or two for All Time.
    - On error: the empty comparison plus the message.
  - `checkoutCardsSection()`: scope `{ loading, error, card: { ranges: AimTableRow[]; doubles: AimTableRow[]; paths: CheckoutPathMetrics; origin: number }, remaining: number | null, init, load, get targets(): { value: number; label: string }[], get routes(): AimTableRow[] }`.
    - Three un-bucketed reads over `heatmapWindow`: `ladder-progress`, `double-performance` and `checkout-path`.
    - After each load, `remaining` stays if it is still in `pathRemainings(card.paths)`. Otherwise it becomes the first entry, or `null` when there is none.
    - An unknown ruleset gives the empty card and makes no reads.

- [ ] **Step 1: Write failing tests**, mocking `@lib/stats/load-game-section` as `ace-comparison.data.test.ts` does.
  - Comparison: 30d makes 4 reads, all with game `TUOD` and `bucket: "none"`, covering both spans.
  - Comparison, Review Focus 3: "all" makes 2 reads, and every tile detail is "No earlier period".
  - Comparison: a rejected `bust-rate` read sets `error` and leaves the tiles empty.
  - Cards: `121_V2` reads `ONE_TWENTY_ONE`, and `card.origin` is 121.
  - Cards, Review Focus 5: `remaining` resets to the highest target when the old value is gone, and is `null` with `routes` `[]` when paths are empty.
  - Registration: `register-route-data` registers `checkoutComparisonSection` and `checkoutCardsSection`.
- [ ] **Step 2: Run** `cd app && npx vitest run tests/lib/stats/sections/checkout-* tests/lib/client/alpine/register-route-data.test.ts`. Expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expect PASS.
- [ ] **Step 5: Commit** `feat(stats): checkout section factories`

### Task 5: Layout and routing

**Files:**
- Create: `app/src/components/layout/games/statistics/CheckoutStatsOverview.astro`
- Create: `app/src/components/layout/games/statistics/CheckoutCards.astro`
- Modify: `app/src/lib/stats/constants.ts`. Add `CHECKOUT_LAYOUTS = new Set(["121_V1", "121_V2", "TUOD_V1"])` with its JSDoc, and remove `121_V1` and `TUOD_V1` from `HEATMAP_ONLY_LAYOUTS`.
- Modify: `app/src/pages/statistics/index.astro`. Add a Checkout branch, and add `CHECKOUT_LAYOUTS` to the fallback exclusion.
- Test: `app/tests/lib/stats/constants.test.ts`

**Interfaces:**
- Consumes: Task 4 scopes; `StatTileRow`, `AimTable`, `ErrorAlert`, `Select` (with `optionsExpr="targets"` and `model="remaining"`), `GameCompletionSection`, `GameHeatmapSection`, `GameSessionList`.
- Layout order:
  1. Completion tile (`grid grid-cols-2`, as on Ace).
  2. `x-data="checkoutComparisonSection()"` containing ErrorAlert and StatTileRow. `StatTileRow` uses `sm:grid-cols-3`, so four tiles wrap. The builder may use a 2×2 grid via its own wrapper; do not change `StatTileRow`.
  3. `CheckoutCards`: one `x-data="checkoutCardsSection()"` with ErrorAlert and three glass cards, each with an eyebrow title and `AimTable`:
     - "TARGET RANGES": headers `["Range", "Finished", "Rate"]`, `table` = `card.ranges`.
     - "DOUBLES": headers `["Double", "Hit rate"]`, `table` = `card.doubles`.
     - "ROUTES": the Select above the table, headers `["Route", "Finished", "Rate"]`, `table` = `routes`.
     - `AimTable` reads `table` from scope. Wrap each table in a nested `x-data="{ get table() { return <expr> } }"`, or give the factory three getters (`rangeTable`, `doubleTable`, `routeTable`) and pass each via a child scope. Builder's call; no change to `AimTable`.
  4. `GameHeatmapSection`, then `GameSessionList`.

- [ ] **Step 1: Write failing test.** In `constants.test.ts`: `CHECKOUT_LAYOUTS` holds exactly the three rulesets and is disjoint from `HEATMAP_ONLY_LAYOUTS`.
- [ ] **Step 2: Run** `cd app && npx vitest run tests/lib/stats/constants.test.ts`. Expect FAIL.
- [ ] **Step 3: Implement** the constants, both components and the page branch.
- [ ] **Step 4: Run** `cd app && npx vitest run tests/lib/stats/constants.test.ts && npx astro check`. Expect PASS and 0/0/0.
- [ ] **Step 5: Screenshot.** Run `cd app && node scripts/screenshot-page.mjs /statistics <scratchpad>/checkout.png --click "121"`. Use whatever click picks the game; check the Select options. Then Read the PNG and confirm the order and that no tile shows NaN.
- [ ] **Step 6: Commit** `feat(stats): checkout statistics layout`

### Task 6: Docs, decision, gates

**Files:**
- Create: `decisions/api/pending-checkout-statistics-page.md` from `decisions/TEMPLATE.md` (`id: pending`; cite it as `[pending:checkout-statistics-page]`; run `bash scripts/check-decision-ids.sh`). Content:
  - The rulesets.
  - The four tiles and their denominators.
  - The 30 floor.
  - Bands of 20 from the start score, with the 2–40 band.
  - Doubles and routes over the current window.
  - The store helpers moved to `lib/stats/checkout/`.
- Modify: `docs/architecture/10-Statistics/01-Section-Catalog.md`. Bump the minor version, add a Checkout layout paragraph, and add rows for 121 and TUOD.
- Modify: `docs/architecture/00-File-Inventory.md`, adding rows for every new `.ts` and `.astro`.
- Modify: `docs/architecture/07-Frontend/08-Component-Inventory.md`, adding `CheckoutStatsOverview` and `CheckoutCards`.
- Modify: `docs/architecture/00-Context-Map-History.md`, adding a new entry. Re-measure the UI-polish pack claim in `00-Context-Map.md` if the context-budget gate flags it.

- [ ] **Step 1:** Make the doc edits. Use targeted edits; never regenerate a doc.
- [ ] **Step 2:** `cd app && npm run format && npm run format:check`. Expect clean.
- [ ] **Step 3:** Run the gates per the `run-all-gates` skill: `npm test`, `npx astro check`, `scripts/check-test-coverage.sh`, `check-type-barrels.sh`, `check-dupes.sh`, `check-doc-sync.sh`, `check-context-budget.sh`, `check-quality-benchmarks.sh`. Expect every one to print OK or pass.
- [ ] **Step 4: Commit** `docs(stats): checkout statistics page`
- [ ] **Step 5:** Ask the owner about the design sync (D524). Then open a PR via `finishing-a-dart-branch` and `subscribe_pr_activity`.
