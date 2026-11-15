# 501 Statistics Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the heatmap-only 501 statistics layout with averages, tiles, five headline-and-overlay aim cards and an aim-filtered heatmap, all read from existing sections.

**Architecture:** Pure derivation modules under `app/src/lib/stats/x01/` turn additive section metrics into display values; thin Alpine factories under `lib/stats/sections/` fetch through `loadGameSection` and expose getters; Astro components render them with the homepage and statistics components (`ScoreAverageCard`, `GrowingCard`). No server change.

**Tech Stack:** Astro, TypeScript, Alpine.js, Vitest. All paths below are under `app/` unless stated.

**Spec:** `docs/superpowers/specs/2026-11-14-x01-statistics-page-design.md`

## Global Constraints

- No new endpoint, section, migration or metric; the page reads existing sections only.
- Completion is not shown on 501. The heatmap and session list stay.
- `variation` (from `$data.variation`, via `variationParam("501", …)`) goes on every request, best leg included.
- Period is the page-level `rangeKey` (`30d | 90d | 1y | all`); best leg ignores it.
- Preceding-period values come from one bucketed request over `trendWindow(rangeKey, now, tz)` split at its `boundary`; `boundary === null` (All Time) means no previous period: no delta, empty hint.
- Lower is better for darts per leg and bust %; a fall renders green.
- Card headline shows "—" under `MIN_TARGET_SAMPLE` (30, already in `lib/stats/constants.ts`); an overlay row under `MIN_ROW_SAMPLE` (10, new, same file) shows its count and no rate.
- Empty data shows "—", never zero; a failed section shows an `ErrorAlert` and leaves the other sections rendering.
- Board frame: y grows downward, so negative `dx` is left, positive `dy` is low (`board-geometry.module.ts:54`).
- Ratchet `mi_average` floor 91.05 (#1327): small modules, one per card; no god files.
- Run from `app/`: single file `npx vitest run <path>`; full `npm test`.

## Review Focus

1. **All Time period:** no previous period; hints blank, no `NaN`/`Infinity` in any delta (Task 1, Task 2).
2. **No sessions at the chosen variation** (e.g. 301 with none): every value "—", best leg "—", no zeros (Tasks 1, 2, 4–7).
3. **Aim bucket holding only `AMBIGUOUS`/`STATE` rows:** headline "—", overlay shows the ambiguous count, no divide-by-zero (Tasks 4–7).
4. **Rapid Period/variation changes:** a stale response never overwrites a newer one (Task 2, Task 4, Task 8).
5. **One section failing:** the others still render and the failed value shows "—" with the error line (Task 2).

---

### Task 1: Pure period and summary modules

**Files:**
- Create: `src/lib/stats/x01/periods.ts`, `src/lib/stats/x01/summaries.ts`, `src/lib/stats/x01/format.ts`
- Test: `tests/lib/stats/x01/periods.test.ts`, `tests/lib/stats/x01/summaries.test.ts`, `tests/lib/stats/x01/format.test.ts`

**Interfaces:**
- Consumes: `SeriesBucket<M>` (`@lib/types`), `CheckoutRateMetrics`, `BustRateMetrics`, `LegStatsMetrics`, `BestLeg` (`@modules/types`), `averageDeltaPercent` (`score-trend-window.ts`).
- Produces:
  - `splitByBoundary<M>(buckets: readonly SeriesBucket<M>[], boundary: string | null): { previous: SeriesBucket<M>[]; current: SeriesBucket<M>[] }` — same rule as `splitPeriods` (previous: `end <= boundary`).
  - `type Rate = { numerator: number; denominator: number; rate: number | null }`
  - `checkoutRate(buckets): Rate` (`finished / chances`, summed over every remaining key and bucket); `bustRate(buckets): Rate` (`busts / visits`); `dartsPerLeg(buckets): number | null` (`sum(darts × legs) / sum(legs)` over the `legs` histogram); `bestLegOf(buckets): BestLeg | null` (fewest darts, first wins a tie); `pointDelta(current: Rate, previous: Rate | null): number | null` (percentage points; `null` when either rate is `null`).
  - `formatRate(rate: number | null): string` (`"30.0%"`, `"—"`); `formatPointDelta(pp: number | null): string` (`"+5.0 pp"`, `"-1.2 pp"`, `""` for `null`); `formatDelta(percent: number | null): string` (`"+2.5%"`, `""`).

- [ ] **Step 1: Write failing tests** with these assertions:
  - `splitByBoundary`: buckets ending at/before the boundary are previous, the rest current; `null` boundary → `previous: []`, all current.
  - `checkoutRate` over `{"40":{chances:4,finished:1},"32":{chances:6,finished:2}}` → `{numerator:3, denominator:10, rate:0.3}`; no buckets → `rate: null`.
  - `bustRate` over `{"60":{visits:20,busts:3}}` → `rate: 0.15`.
  - `dartsPerLeg` over `legs: {"15":2,"18":1}` → `16`; empty histogram → `null`.
  - `bestLegOf` across two buckets (`{darts:21,sessionId:"a"}`, `{darts:15,sessionId:"b"}`) → `{darts:15,sessionId:"b"}`; all `null` → `null`.
  - `pointDelta({rate:0.30…}, {rate:0.25…})` → `5` (±1e-9); previous `null` → `null`.
  - format helpers as listed above.
- [ ] **Step 2:** Run `npx vitest run tests/lib/stats/x01` → FAIL (modules missing).
- [ ] **Step 3:** Implement the three modules per the signatures. `periods.ts` is generic; do not touch `splitPeriods`.
- [ ] **Step 4:** Run `npx vitest run tests/lib/stats/x01` → PASS.
- [ ] **Step 5:** Commit `feat(stats): 501 page period and summary helpers`.

### Task 2: `x01Overview` factory

**Files:**
- Create: `src/lib/stats/sections/x01-overview.data.ts`
- Modify: `src/lib/client/alpine/register-route-data.ts` (register `x01Overview`)
- Test: `tests/lib/stats/sections/x01-overview.data.test.ts` (copy the `section()` scope helper and `loadGameSection` mock from `score-trend.data.test.ts`, adding `variation` and `game` to the page scope)

**Interfaces:**
- Consumes: Task 1; `trendWindow`, `personalBestWindow`, `foldAverages`, `averageDeltaPercent` (`score-trend-window.ts`); `loadGameSection`; `variationParam`.
- Produces `x01Overview()` with state `loading`, `error: string | null`, `bestLegLoading`, and getters read by Task 3:
  `threeDart`, `threeDartDelta`, `firstNine`, `firstNineDelta`, `legAverage`, `legAverageDelta` (numbers or `null`; deltas are percent), `checkoutValue`, `checkoutHint`, `bustValue`, `bustHint`, `bestLegValue` (strings), `bestLegSessionId: string | null`, `isEmpty`.
  Methods: `load(now?)` (four bucketed requests: `scoring-trend`, `checkout-rate`, `bust-rate`, `leg-stats`, each `{from,to,bucket,tz}` of one `trendWindow`, plus `variation`), `loadBestLeg(now?)` (one `leg-stats` request over `personalBestWindow`, `bucket:"none"`, plus `variation`).
  Watchers: `rangeKey` → `load`; `variation` and `game` → `load` and `loadBestLeg`. Separate tickets per method. The four requests settle independently (`Promise.allSettled`); `error` becomes `"Could not load: <section ids>"` and a failed section's values are "—".

- [ ] **Step 1: Write failing tests:**
  - 30d: four `loadGameSection` calls with `"501"` and the sections above; each call carries `variation: 501` and the window `from` = now − 60 days.
  - Buckets split at the boundary: current 3-dart average 60 over previous 50 → `threeDartDelta` = `20`.
  - `rangeKey = "all"` → deltas `null`, hints `""` (Review Focus 1).
  - `checkoutHint` for current 30 % vs previous 25 % = `"+5.0 pp"`; `bustHint` and `legAverageDelta` likewise.
  - A `rejected` `bust-rate` → `error` contains `bust-rate`, `bustValue` is `"—"`, `checkoutValue` still formatted (Review Focus 5).
  - Empty responses → all values "—", `isEmpty` true (Review Focus 2).
  - Best leg: call uses `bucket:"none"`, `bestLegValue` `"15"`, `bestLegSessionId` set; no best leg → `"—"`/`null`.
  - A stale `load` resolved after a newer one does not overwrite state (Review Focus 4); changing `variation` re-sends both loads with the new value.
- [ ] **Step 2:** Run the test file → FAIL.
- [ ] **Step 3:** Implement `x01Overview()`; register it. Hints show `""` while `loading`.
- [ ] **Step 4:** Test file → PASS; also `npx vitest run tests/lib/client/alpine` (registration lists) and fix any expected-list test by adding only `x01Overview`.
- [ ] **Step 5:** Commit `feat(stats): x01Overview section factory`.

### Task 3: Layout switch, averages row and tiles (slice 1)

**Files:**
- Create: `src/components/layout/games/statistics/X01StatsOverview.astro`, `X01AveragesRow.astro`, `X01TilesRow.astro`, `BestLegTile.astro` (same directory)
- Modify: `src/components/layout/games/statistics/ScoreAverageCard.astro` (prop `invertDelta?: boolean`; with it, `deltaClass` is `text-success` when the delta is `<= 0`), `src/lib/stats/constants.ts` (remove `"501_V1"`, `"501_V2"` from `HEATMAP_ONLY_LAYOUTS`; add `export const X01_LAYOUTS: ReadonlySet<string> = new Set(["501_V1","501_V2"])` and `export const MIN_ROW_SAMPLE = 10`), `src/pages/statistics/index.astro` (render `X01StatsOverview` for `x01Rulesets`; keep `GameVariationSelect` above it), `tests/lib/stats/constants.test.ts`
- Test: `tests/lib/stats/constants.test.ts`

**Interfaces:**
- Consumes: Task 2 getters via `x-data="x01Overview()"` on `X01StatsOverview`.
- Produces: `X01StatsOverview.astro` = vertical stack: data-quality slot (Task 4), averages row (3 `ScoreAverageCard`: "3-dart average", "First nine", "Darts per leg" with `invertDelta`), tiles row (`CareerTiles` markup: mono key / `font-display text-lg` value / `text-caption text-muted` hint, 3 tiles "CHECKOUT", "BUST", "BEST LEG"), aim-card slot (Tasks 4–7), `GameHeatmapSection`, `GameSessionList`. `BestLegTile` is a `GrowingCard` (pattern of `ReplayCard.astro`) whose `@expand` is `$store.replay.open(bestLegSessionId)`, face = the tile, hint "Tap to replay", disabled (no `@expand`) when `bestLegSessionId` is `null`. An `ErrorAlert` bound to `error` sits above the rows.

- [ ] **Step 1:** Update `constants.test.ts`: `HEATMAP_ONLY_LAYOUTS` expected list loses the two 501 keys; add `X01_LAYOUTS` equals `["501_V1","501_V2"]` and `MIN_ROW_SAMPLE` is a positive integer below `MIN_TARGET_SAMPLE`. Run → FAIL.
- [ ] **Step 2:** Implement constants, `ScoreAverageCard` flag, the four components, `index.astro`. Completion must not appear in the 501 layout.
- [ ] **Step 3:** `npx vitest run tests/lib/stats/constants.test.ts` → PASS. Run `npm run check` (astro check) → no new errors.
- [ ] **Step 4:** Commit `feat(stats): 501 averages row and tiles`.

### Task 4: Aim infrastructure and treble accuracy card (slice 2a)

**Files:**
- Create: `src/stores/x01-quality.store.ts`, `src/lib/stats/x01/aim-rows.ts`, `src/lib/stats/x01/aim-label.ts`, `src/lib/stats/x01/treble-card.ts`, `src/lib/stats/sections/aim-section.ts`, `src/lib/stats/sections/treble-card.data.ts`, `src/components/layout/games/statistics/AimCard.astro`, `X01DataQualityLine.astro`, `TrebleOverlay.astro`
- Modify: `src/lib/stats/sections/period-section.ts` (keep `skippedSessions: number` from the series, `0` when absent, reset on load), `src/lib/client/alpine/register-stores.ts`, `register-route-data.ts`, `X01StatsOverview.astro`; update `tests/lib/client/alpine/register-stores.test.ts` and `tests/lib/stats/sections/period-section.test.ts` (add the new field to any enumerated shape; add one test that `skippedSessions` carries over and resets)
- Test: `tests/lib/stats/x01/aim-rows.test.ts`, `aim-label.test.ts`, `treble-card.test.ts`, `tests/lib/stats/sections/aim-section.test.ts`, `tests/stores/x01-quality.store.test.ts`

**Interfaces:**
- Produces:
  - `type AimRows = Record<string, Record<string, number>>`; `sumAimRows(buckets: readonly SeriesBucket<AimCountMetrics>[]): AimRows` (field-wise sum across buckets); `rateOf(numerator: number, denominator: number): number | null` (`null` when the denominator is `0`); `ambiguousDarts(rows: AimRows): number` (`rows.AMBIGUOUS?.darts ?? 0`).
  - `aimLabel(key: string): string` — `TREBLE:20`→`T20`, `DOUBLE:16`→`D16`, `SINGLE:5`→`S5`, `INNER_BULL:25`→`Bull`, `OUTER_BULL:25`→`25`, `WIRE:20-1`→`20/1 wire`.
  - Store `x01Quality`: `report(id: string, skipped: number): void`, getter `skipped: number` = max over reported ids; `clear(): void`.
  - `aimSection(sectionId)` = `periodSection<AimCountMetrics>(sectionId)` plus getter `rows: AimRows` and an overridden `load` that, after the base load, calls `this.$store.x01Quality.report(sectionId, this.error === null ? this.skippedSessions : 0)`.
  - `trebleCard(rows: AimRows): TrebleCard` where `TrebleCard = { headline: number | null; darts: number; rows: { aim: "TREBLE:20" | "TREBLE:19" | "TREBLE:18"; darts: number; treble: number|null; single: number|null; left: number|null; right: number|null; other: number|null }[]; ambiguous: number }`. Row keys are `<aim>|<resolution>`; sum both resolutions per aim. `headline` = T20 `trebles/darts`, `null` under `MIN_TARGET_SAMPLE` T20 darts; a row's rates are `null` under `MIN_ROW_SAMPLE`. `left`/`right` = `neighbourLeft`/`neighbourRight`; `single` = `singles`.
  - `AimCard.astro` props: `title`, `titleId`, `headlineExpr`, `captionExpr`, `loadingExpr`, `errorExpr`; default slot = overlay body. Built on `GrowingCard`: closed face shows title, headline (mono, accent) and caption; open shows title, a close button and the slot. `X01DataQualityLine.astro`: muted line `"N sessions could not be analysed"`, `x-show="$store.x01Quality.skipped > 0"`.

- [ ] **Step 1: Write failing tests:** the `aimLabel` table above; `sumAimRows` sums fields across two buckets; `rateOf(1,0)` → `null`; `trebleCard` over `{"TREBLE:20|SOLE":{darts:30,trebles:6,singles:12,neighbourLeft:4,neighbourRight:3,other:5},"TREBLE:20|NEAREST":{darts:10,trebles:2,singles:4,neighbourLeft:1,neighbourRight:1,other:2},"AMBIGUOUS":{darts:3}}` → T20 darts 40, `headline` `0.2`, `ambiguous` 3; the same rows with 12 darts → `headline: null`; a bucket of only `AMBIGUOUS` → headline `null`, ambiguous count kept, no throw (Review Focus 3); a T18 row with 4 darts has `null` rates. `aimSection`: `rows` merges buckets; `load` reports the series `skippedSessions` to `x01Quality`; an errored load reports `0`; `x01Quality.skipped` is the max of reports; a stale load does not report (Review Focus 4).
- [ ] **Step 2:** Run the listed test files → FAIL.
- [ ] **Step 3:** Implement the modules; add `treble-card.data.ts`: `trebleCardSection()` = `{ ...aimSection("large-target-accuracy"), get card(): TrebleCard { return trebleCard(this.rows) } }`; register it. `TrebleOverlay.astro`: table, one row per aim with the five shares as percents, then the ambiguous count and the sample size. Mount the card in `X01StatsOverview` under the tiles; headline `—` handled by the component.
- [ ] **Step 4:** Run the listed tests, `tests/lib/stats`, `tests/lib/client/alpine` → PASS; `npm run check`.
- [ ] **Step 5:** Commit `feat(stats): 501 treble accuracy card and aim infrastructure`.

### Task 5: Aim drift card (slice 2b)

**Files:**
- Create: `src/lib/stats/x01/drift-card.ts`, `src/lib/stats/sections/drift-card.data.ts`, `src/components/layout/games/statistics/DriftOverlay.astro`
- Modify: `register-route-data.ts`, `X01StatsOverview.astro`
- Test: `tests/lib/stats/x01/drift-card.test.ts`

**Interfaces:**
- Consumes: Task 4 (`aimSection`, `AimRows`, `rateOf`).
- Produces `driftCard(rows: AimRows): DriftCard`, `DriftCard = { headline: string | null; n: number; byDart: DriftRow[]; byBasis: (DriftRow & { basis: string })[]; ambiguous: number }`, `DriftRow = { dart: 1 | 2 | 3; n: number; meanDx: number | null; meanDy: number | null; spread: number | null }`. Row keys are `<basis>|<aim>|<dartNumber>|<resolution>` with `{ n, sumDx, sumDy, sumDxDx, sumDyDy, sumDxDy }`. Pool over basis, aim and resolution per dart number. `meanDx = sumDx/n`; `spread = sqrt(varX + varY)` with `var = sumXX/n − mean²` clamped at 0. `headline` = dart 1 via `describeDrift(meanDx, meanDy)`, e.g. `"4 mm left, 2 mm low"` (`Math.round`; `right`/`high` for the opposite sign; a zero axis is omitted; both zero → `"on target"`), `null` under `MIN_TARGET_SAMPLE` dart-1 samples. `byBasis` groups by basis × dart; rows under `MIN_ROW_SAMPLE` carry `null` stats.

- [ ] **Step 1: Write failing tests:** dart-1 rows `{"FINISH|DOUBLE:16|1|SOLE":{n:40,sumDx:-160,sumDy:80,sumDxDx:1000,sumDyDy:400,sumDxDy:0}}` → headline `"4 mm left, 2 mm low"`; flipped signs → `"4 mm right, 2 mm high"`; `n:10` → headline `null`; `describeDrift(0.2, -0.3)` → `"on target"`; `spread` for known sums equals the hand-computed value (e.g. sumDxDx 1000/40 − 16 = 9, sumDyDy 400/40 − 4 = 6 → `sqrt(15)`); darts 2 and 3 pool separately; only-`AMBIGUOUS` rows → headline `null` (Review Focus 3).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement `drift-card.ts`, `driftCardSection()` over `aimSection("aim-drift")`, `DriftOverlay.astro` (three dart rows, then per-basis rows, then ambiguous count and sample), register and mount. **Step 4:** Run `npx vitest run tests/lib/stats` + `npm run check` → PASS. **Step 5:** Commit `feat(stats): 501 aim drift card`.

### Task 6: Doubles card (slice 3a)

**Files:**
- Create: `src/lib/stats/x01/doubles-card.ts`, `src/lib/stats/sections/doubles-card.data.ts`, `src/components/layout/games/statistics/DoublesOverlay.astro`
- Modify: `register-route-data.ts`, `X01StatsOverview.astro`
- Test: `tests/lib/stats/x01/doubles-card.test.ts`

**Interfaces:**
- Produces `doublesCard(rows: AimRows): DoublesCard`, `DoublesCard = { headline: number | null; caption: string | null; darts: number; rows: DoubleRow[]; ambiguous: number }`, `DoubleRow = { aim: string; label: string; darts: number; hits: number; rate: number | null; inside: number; within: number; outside: number; sectors: number[] /* length 8 */ }`. Row keys: `<aim>|<resolution>|HIT` and `<aim>|<resolution>|MISS|<INSIDE|WITHIN|OUTSIDE>|<sector 0-7>` with `{ darts }`; aims `DOUBLE:n` and `INNER_BULL:25`. `headline` = total hits / total darts over all rows, `null` under `MIN_TARGET_SAMPLE`. `caption` = `"Best D16 · worst D3"` (`aimLabel`) among rows with at least `MIN_ROW_SAMPLE` darts, best = highest rate, worst = lowest, ties: more darts wins; `null` unless two rows qualify. `rows` sorted by number, bull last; a row under `MIN_ROW_SAMPLE` has `rate: null`.

- [ ] **Step 1: Write failing tests:** D16 20 darts/10 hits, D3 12 darts/3 hits, D8 5 darts/5 hits → `headline` `18/37`, `caption` `"Best D16 · worst D3"` (D8 excluded, under the sample); a tie in rate resolves to the row with more darts; misses split by band and sector (a `MISS|OUTSIDE|3` row increments `outside` and `sectors[3]`); only-`AMBIGUOUS` → headline `null`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement module, `doublesCardSection()` over `aimSection("double-accuracy")`, `DoublesOverlay.astro` (rows with hit %, band counts, sector counts, then ambiguous and sample), register, mount. **Step 4:** `npx vitest run tests/lib/stats` + `npm run check`. **Step 5:** Commit `feat(stats): 501 doubles card`.

### Task 7: Double preference and setup cards (slice 3b)

**Files:**
- Create: `src/lib/stats/x01/preference-card.ts`, `src/lib/stats/x01/setup-card.ts`, `src/lib/stats/sections/preference-card.data.ts`, `src/lib/stats/sections/setup-card.data.ts`, `src/components/layout/games/statistics/PreferenceOverlay.astro`, `SetupOverlay.astro`
- Modify: `register-route-data.ts`, `X01StatsOverview.astro`
- Test: `tests/lib/stats/x01/preference-card.test.ts`, `setup-card.test.ts`

**Interfaces:**
- Produces `preferenceCard(rows: AimRows): PreferenceCard`, `PreferenceCard = { headline: string | null; rows: { finish: string; label: string; left: number; splitAway: number; splitRate: number | null; attempts: number; hits: number }[]; ambiguous: number }`. `<finish>|STATE` → `{ left, splitAway }`; `<finish>|<resolution>` (`SOLE|NEAREST`) → `{ attempts, hits }`, summed. `headline` = `"D16 left most · split away 31%"` for the finish with the highest `left` (`splitAway/left`, whole percent), `null` when total `left` is under `MIN_TARGET_SAMPLE`.
- Produces `setupCard(rows: AimRows): SetupCard`, `SetupCard = { headline: number | null; goodLeave: number | null; groups: { basis: string; kind: string; attempts: number; hits: number; rate: number | null }[]; ambiguous: number }`. Keys `<basis>|<kind>|<resolution>` with `{ attempts, hits }` (bases `ROUTE|SETUP|SPLIT`); `VISITS` → `{ visits, goodLeaves }`. `headline` = hits/attempts over all groups, `null` under `MIN_TARGET_SAMPLE` attempts; `goodLeave` = `goodLeaves/visits`, `null` at zero visits; groups sum resolutions; a group under `MIN_ROW_SAMPLE` has `rate: null`.

- [ ] **Step 1: Write failing tests:** preference — D16 `STATE {left:40, splitAway:12}` and D8 `{left:10, splitAway:1}` → headline `"D16 left most · split away 30%"`; `left` total 25 → `null`; attempts/hits sum across resolutions. Setup — `ROUTE|TREBLE|SOLE {attempts:30,hits:15}` + `SETUP|DOUBLE|SOLE {attempts:10,hits:2}` → headline `17/40`; `VISITS {visits:20,goodLeaves:15}` → `goodLeave` `0.75`; no `VISITS` row → `null`; only-`AMBIGUOUS` → both cards headline `null`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement modules, the two `aimSection` wrappers (`double-preference`, `setup-success`), both overlays (ambiguous count and sample at the end), register, mount; card order on the page: treble, drift, doubles, preference, setup. **Step 4:** `npx vitest run tests/lib/stats` + `npm run check`. **Step 5:** Commit `feat(stats): 501 double preference and setup cards`.

### Task 8: Heatmap aim picker (slice 4)

**Files:**
- Create: `src/lib/stats/x01/aim-options.ts`
- Modify: `src/lib/stats/sections/game-heatmap.data.ts`, `src/components/layout/games/statistics/GameHeatmapSection.astro` (picker already bound to `targetOptions`; only its label changes to "Heatmap aim" for 501 if the component needs it)
- Test: `tests/lib/stats/x01/aim-options.test.ts`, `tests/lib/stats/sections/game-heatmap.data.test.ts`

**Interfaces:**
- Produces `aimOptionsFromDrift(rows: AimRows): HeatmapTargetOption[]` — `{ value: null, label: "All aims" }`, then the distinct `<aim>` parts (second segment) of the `aim-drift` row keys, labelled by `aimLabel`, ordered `TREBLE` → `SINGLE` → `DOUBLE` → bulls → wires, then by number. The `value` is the aim key string sent as `target` (the server accepts inferred aim keys on 501, D555; `value` type widens to `string` for this option list).
- `gameHeatmapSection` on a 501 game: also loads `aim-drift` (same period and variation, `bucket:"none"`) with its own ticket, builds `targetOptions` from it, and resets `target` to `null` when the chosen aim is not in the new options. Other games keep `heatmapTargetOptions`.

- [ ] **Step 1: Write failing tests:** `aimOptionsFromDrift` over keys `FINISH|DOUBLE:16|1|SOLE`, `LARGE_TARGET|TREBLE:20|1|SOLE`, `SETUP|WIRE:20-1|2|NEAREST` → `["All aims","T20","D16","20/1 wire"]` in that order, deduplicated; empty rows → only "All aims". Factory: 501 sends `target: "TREBLE:20"` to `heatmap` after the pick; changing `variation` re-loads options and clears a no-longer-present pick (Review Focus 4); a non-501 game makes no `aim-drift` call.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** `npx vitest run tests/lib/stats` + `npm run check` → PASS. **Step 5:** Commit `feat(stats): 501 heatmap aim picker`.

### Task 9: Docs, decision, gates, PR

**Files (edit with minimal diffs):**
- `docs/architecture/10-Statistics/00-Overview.md`, `01-Section-Catalog.md` (§2 501 layout: completion no longer on the page; `HEATMAP_ONLY_LAYOUTS` text; replace the stale "switch count off T20" with the metric fields; the page now uses the five aim sections), `docs/architecture/00-File-Inventory.md` (rows for every new file), `docs/architecture/00-Context-Map-History.md` if it logs doc changes (follow the previous entry), `decisions/api.md` (append the next free D-number: layout, minimum samples 30/10, max-skipped line, drift signs), version bumps per each doc's own header convention.

- [ ] **Step 1:** Make the doc edits above.
- [ ] **Step 2:** Run the `context-maintenance` skill and the `run-all-gates` skill (`validate:app` sequence); fix failures at the cause.
- [ ] **Step 3:** Capture anything noticed but not in scope as `discovered-work` issues (do not fix it here).
- [ ] **Step 4:** Ask the owner whether to run the design sync before the PR (D524); sync is currently unavailable, so note the open ids in the PR if skipped.
- [ ] **Step 5:** Push the branch, open the PR via `finishing-a-dart-branch`, then `subscribe_pr_activity` and fix CI until green; unsubscribe after.

---

## Self-review

- **Spec coverage:** controls (existing select + `GameVariationSelect`), averages and tiles (Tasks 1–3), data-quality line (Task 4), five aim cards with headline rules (Tasks 4–7), heatmap picker (Task 8), best leg all-time and variation-aware (Task 2), docs and decision (Task 9). Completion removal: Task 3. Spec corrections made while planning: best-leg hint has no date (metric carries none); treble overlay has no switch count (not in the metrics).
- **Type consistency:** `AimRows`, `rateOf`, `ambiguousDarts`, `aimSection`, `aimLabel`, `MIN_ROW_SAMPLE` defined in Tasks 3–4 and reused in 5–8 with the same names.
- **Proportion:** logic lives in pure modules; components are described by props and structure only.
