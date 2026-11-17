# Track Games Statistics Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `SINGLES_V1`, `SHANGHAI_V1`, `AROUND_THE_CLOCK_V1` and `BOBS27_V1` share one `/statistics` layout: Best, Most failed and Weakest three tiles, a per-target table with a sort toggle, then the existing heatmap and session list.

**Architecture:** The Doubles derivation (`lib/stats/doubles/`) is generalised from a doubles-only key pattern to a per-game key set; the Doubles page behaves as before. A Track card module adds the tiles and sort on top of the same rows. One Alpine factory resolves the page game to its game type, fetches the three sections un-bucketed over the page Period and exposes `tiles`, `table`, `sort`. A new overview component and a layout set switch the page. No migration, endpoint or section id.

**Tech Stack:** Astro, TypeScript, Alpine.js, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-17-track-games-statistics-page-design.md`

## Global Constraints

- Floors from `@lib/stats/constants`: `MIN_ROW_SAMPLE` 10 (row rate hidden below), `MIN_TARGET_SAMPLE` 30 (tiles need it).
- Rows per game are the picker keys of `heatmapTargetOptions(gameTypeKey)` without "All targets": Singles and Around the Clock `NUMBER:1..20` plus `BULL:25`; Shanghai `NUMBER:1..20`; Bob's 27 the doubles path (`DOUBLES_PATH_KEYS`). Only rows with darts appear, in number order, bull last.
- Sectors (0 = up, clockwise): left 5, 6, 7; right 1, 2, 3; high 0; low 4. Bands `INSIDE`, `WITHIN`, `OUTSIDE`. Unchanged from the Doubles card.
- Tiles consider rows with at least 30 darts. Ties on rate: more darts, then lower number, for best and weakest alike.
- Sort: "Target" (number order, bull last) and "Hit rate" (lowest first, rows under 10 darts last, ties by number). The sort changes the table only.
- Table columns, in order: Target, Hit, Left/Right, High/Low, In/Within/Out, Near/Loose. Footer: `${darts} darts · near miss within ${NEAR_MISS_MM} mm`.
- Gates: test per changed runtime `.ts` (tests mirror `app/src/` under `app/tests/`); no inline comments in function bodies; types only in `types.ts` barrels; astro check 0/0/0; `cd app && npm run format` then `format:check`; `bash scripts/check-dupes.sh`; `bash scripts/check-context-budget.sh`; `scripts/check-quality-benchmarks.sh` (`mi_average` floor 91.0: extend the Doubles modules, add at most the two TS modules named below and the factory).
- Commit trailers: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01UTDrHPdGdopff61XchEUTp`.

## Review Focus

- No darts in the Period: no rows, all tiles "Not enough darts yet", empty table, no NaN.
- Fewer than three targets qualify: Weakest three lists what qualifies; one qualifying row is best and most failed at once.
- A high-rate row under 30 darts never wins a tile; a low-rate row under 30 darts never lands in Weakest three.
- A key outside the game's row set (for example `TREBLE:20`, or `DOUBLE:5` on a Shanghai page) is ignored.
- Around the Clock V2 aims at `OUTER_SINGLE:n` (`TARGET_AIM_ZONES`): its `target-accuracy` keys must still land in `NUMBER:n` rows, or the page shows no rows for it.
- Any one of the three fetches failing: `error` set, no partial card. A response after a Period or game change is dropped.
- Sort toggle with equal rates: stable, by number.

---

### Task 1: Generalise the Doubles derivation

**Files:**
- Modify: `app/src/lib/stats/doubles/doubles-training-rows.ts`, `app/src/lib/stats/doubles/doubles-training-card.ts`, `app/src/lib/stats/doubles/doubles-training-fetch.ts`, `app/src/lib/stats/heatmap-targets.ts`
- Test: `app/tests/lib/stats/doubles/doubles-training-rows.test.ts`, `app/tests/lib/stats/doubles/doubles-training-fetch.test.ts`, `app/tests/lib/stats/heatmap-targets.test.ts`

**Interfaces:**
- Produces, in `heatmap-targets.ts`: `trackRowKeys(gameTypeKey: GameTypeKey | undefined): ReadonlySet<string>`, the keys of `heatmapTargetOptions(gameTypeKey)` with a non-null `value`; empty for a game without a picker.
- Produces: `tallyDoublesTraining(input: DoublesTrainingInput, keys?: ReadonlySet<string>): DoublesTrainingRow[]`; `keys` defaults to the current doubles set (`DOUBLES_PATH_KEYS`), replacing the `DOUBLE_KEY` regex. Row order, rates and fields are unchanged.
- Produces: `loadTargetInputs(gameTypeKey: GameTypeKey, rangeKey: TrendRangeKey, now: Date): Promise<DoublesTrainingInput>` (the three un-bucketed fetches, rejecting on any failure), in `doubles-training-fetch.ts`; `loadDoublesTrainingCard` calls it and keeps its signature and result.

- [ ] **Step 1: Write the failing tests.**
  - `heatmap-targets.test.ts`: `trackRowKeys("SHANGHAI")` has 20 keys `NUMBER:1..20` and no `BULL:25`; `trackRowKeys("SINGLES_TRAINING")` has 21 with `BULL:25`; `trackRowKeys("BOBS27")` equals `DOUBLES_PATH_KEYS`; `trackRowKeys("501")` and `trackRowKeys(undefined)` are empty.
  - `doubles-training-rows.test.ts`: with `keys = new Set(["NUMBER:3","BULL:25"])` an accuracy key `NUMBER:3` makes a row labelled "3", `NUMBER:4` and `DOUBLE:3` are ignored, `BULL:25` sorts last; with no `keys` argument the existing tests pass untouched.
  - `doubles-training-fetch.test.ts`: `loadTargetInputs("SHANGHAI", "30d", now)` calls `loadGameSection` three times with `"SHANGHAI"` and the section ids `target-accuracy`, `miss-direction`, `loose-darts`, each with `bucket: "none"` over `heatmapWindow("30d", now)`, and returns `{accuracy, misses, loose}` buckets; one rejection rejects the call.
- [ ] **Step 2: Run** `cd app && npx vitest run tests/lib/stats/doubles tests/lib/stats/heatmap-targets.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** the three changes. Check that the default key set equals the old regex set (D1 to D20 as `DOUBLE:n`, bull as `INNER_BULL:25`); if `DOUBLES_PATH_KEYS` spells the bull differently, pass the regex's set as the default instead.
- [ ] **Step 4: Run** the same command plus `npx vitest run tests/lib/stats` — all pass, Doubles tests untouched. `npm run check` 0/0/0.
- [ ] **Step 5: Commit** `refactor(stats): key-set rows and shared target inputs for the Doubles card`.

### Task 2: Track card derivation

**Files:**
- Create: `app/src/lib/stats/track/track-games-card.ts`, `app/src/lib/stats/track/track-games-lines.ts`, `app/src/lib/stats/track/types.ts`
- Modify: `app/src/lib/stats/types.ts` (`export * from "./track/types"`)
- Test: `app/tests/lib/stats/track/track-games-card.test.ts`, `app/tests/lib/stats/track/track-games-lines.test.ts`

**Interfaces:**
- Consumes: `tallyDoublesTraining`, `DoublesTrainingRow`, `DoublesTrainingInput` (Task 1); `formatRate` (`@lib/stats/x01/format`); `AimTableRow` (`@lib/types`).
- Produces, in `track/types.ts`:
  - `TrackSort = "target" | "rate"`
  - `TrackGamesCard = { best: DoublesTrainingRow | null; worst: DoublesTrainingRow | null; weakest: DoublesTrainingRow[]; darts: number; rows: DoublesTrainingRow[] }`
  - `TrackTile = { title: string; value: string; detail: string }`
- Produces: `trackGamesCard(input: DoublesTrainingInput, keys: ReadonlySet<string>): TrackGamesCard` (`best`: highest rate; `worst`: lowest rate; `weakest`: up to three lowest, all among rows of at least 30 darts; `rows` in number order).
- Produces: `trackTiles(card: TrackGamesCard): TrackTile[]` (three tiles: "Best target", "Most failed", "Weakest three"); `trackTable(card: TrackGamesCard, sort: TrackSort): AimTableRow[]`.

- [ ] **Step 1: Write the failing tests** (accuracy-only inputs unless noted; keys `new Set(["NUMBER:14","NUMBER:15","NUMBER:16","NUMBER:17"])`):
  - 14 at 32/41 hits, 15 at 20/30, 16 at 14/24, 17 at 18/43: `best.aim` "NUMBER:14", `worst.aim` "NUMBER:17", `weakest.map(aim)` `["NUMBER:17","NUMBER:15","NUMBER:14"]`, `darts` 138; 16 (24 darts) is in `rows` but in no tile.
  - one qualifying row: `best` and `worst` are it, `weakest` has one entry.
  - no row at 30 darts: `best`, `worst` null, `weakest` `[]`; `trackTiles` gives three tiles each with value "—" and detail "Not enough darts yet".
  - tie on rate: more darts wins `best` and `worst` alike; equal darts go to the lower number.
  - `trackTiles` for the first case: "Best target" value "14", detail "78.0% · 41 darts"; "Most failed" value "17", detail "41.9% · 43 darts"; "Weakest three" value "17 · 15 · 14", detail "41.9% · 66.7% · 78.0%".
  - `trackTable(card, "target")` rows in number order with `{label: "14", count: 41, cells: ["78.0%", ...]}`; `trackTable(card, "rate")` lowest rate first, rows under 10 darts last, equal rates by number.
  - keys outside the set (`DOUBLE:5`, `NUMBER:2` against the set above) are ignored.
- [ ] **Step 2: Run** `npx vitest run tests/lib/stats/track` — expect FAIL.
- [ ] **Step 3: Implement.** One shared comparator over `hits * darts` cross products for best and worst, as `favouriteOf` does; cells as in `doublesTrainingTable` (reuse its row-to-cells mapping by exporting it rather than copying it).
- [ ] **Step 4: Run** the command and `bash scripts/check-type-barrels.sh` — pass.
- [ ] **Step 5: Commit** `feat(stats): Track games card derivation`.

### Task 3: Alpine factory

**Files:**
- Create: `app/src/lib/stats/sections/track-games-card.data.ts`
- Modify: `app/src/lib/client/alpine/register-route-data.ts` (import; `Alpine.data("trackGamesCardSection", trackGamesCardSection)`)
- Test: `app/tests/lib/stats/sections/track-games-card.data.test.ts`, `app/tests/lib/client/alpine/register-route-data.test.ts`

**Interfaces:**
- Consumes: `loadTargetInputs`, `trackRowKeys` (Task 1); `trackGamesCard`, `trackTiles`, `trackTable` (Task 2); `reloadOnPageFilters`, `GAME_TYPE_BY_RULESET` as `periodSection` uses them.
- Produces: `trackGamesCardSection()` returning an Alpine scope with `loading`, `error: string | null`, `card: TrackGamesCard`, `sort: TrackSort` (default `"target"`), `init()`, `load(now?: Date): Promise<void>`, `setSort(sort: TrackSort): void`, getters `tiles: TrackTile[]`, `table: AimTableRow[]`, `footer: string`.

- [ ] **Step 1: Write the failing tests** (mock `@lib/stats/load-game-section` by section id; scope `$data: { rangeKey: "30d", game: "SHANGHAI_V1", variation: 0 }`, `$watch: () => {}`; follow `doubles-training-card.data.test.ts`):
  - loads the three sections for `"SHANGHAI"`; with the Task 2 example `tiles[0]` is the Best target tile, `table[0].label` "14", `footer` "138 darts · near miss within 20 mm".
  - `setSort("rate")` makes `table[0].label` "17"; `tiles` are unchanged.
  - no darts: `table` `[]`, tiles "Not enough darts yet", `footer` "0 darts · near miss within 20 mm".
  - one section rejecting: `error` is its message, `card.rows` `[]`.
  - two loads, the first resolving last: the first result is dropped.
  - `game: "501_V1"` leaves `loading` false and `card.rows` empty, with no fetch.
  - `register-route-data.test.ts`: `trackGamesCardSection` is registered under that name (follow the existing registration cases).
- [ ] **Step 2: Run** `npx vitest run tests/lib/stats/sections/track-games-card.data.test.ts tests/lib/client/alpine/register-route-data.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** with a ticket for stale responses, `reloadOnPageFilters` in `init`, the key set from `trackRowKeys(gameTypeKey)` at each load. Keep the factory function under 60 lines (extract helpers) for `large_functions_src`.
- [ ] **Step 4: Run** the command — pass.
- [ ] **Step 5: Commit** `feat(stats): Track games card Alpine scope`.

### Task 4: Overview and layout switch

**Files:**
- Create: `app/src/components/layout/games/statistics/TrackGamesStatsOverview.astro`
- Modify: `app/src/components/layout/games/statistics/AimCardSection.astro` (an optional `before` slot rendered above `AimCard` inside the scope), `app/src/lib/stats/constants.ts` (`TRACK_LAYOUTS: ReadonlySet<string>` = `SINGLES_V1`, `SHANGHAI_V1`, `AROUND_THE_CLOCK_V1`, `BOBS27_V1`; remove them from `HEATMAP_ONLY_LAYOUTS`), `app/src/pages/statistics/index.astro` (branch for `TRACK_LAYOUTS`; the fallback `x-if` excludes it)
- Test: `app/tests/lib/stats/constants.test.ts`

**Interfaces:**
- Consumes: `AimCardSection` props `factory: "trackGamesCardSection"`, `title: "TARGETS"`, `titleId: "track-games-card-title"`, `headers: ["Target","Hit","Left/Right","High/Low","In/Within/Out","Near/Loose"]`, `footerExpr: "footer"`; `GameCompletionSection`, `GameHeatmapSection`, `GameSessionList`.
- Layout: completion tile, then (in the `before` slot) the three tiles via `x-for` over `tiles` and a two-button sort toggle ("Target", "Hit rate") calling `setSort`, then the table card, heatmap, session list. Tiles stack to one column at phone width.

- [ ] **Step 1: Write the failing tests** in `constants.test.ts`: `TRACK_LAYOUTS` holds exactly the four versions; `HEATMAP_ONLY_LAYOUTS` holds none of them and still holds `BASEBALL_V1`; `TRACK_LAYOUTS`, `X01_LAYOUTS`, `DOUBLES_TRAINING_LAYOUTS`, `HEATMAP_ONLY_LAYOUTS` and `DEDICATED_STATS_LAYOUTS` do not overlap.
- [ ] **Step 2: Run** `npx vitest run tests/lib/stats/constants.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** the constant, the slot, the component and the page branch.
- [ ] **Step 4: Run** the test, `npm run check` (0/0/0) and `node scripts/screenshot-page.mjs /statistics /tmp/track.png` from `app/`; read the PNG. The stubbed API shows only the layout and empty states; say so in the report.
- [ ] **Step 5: Commit** `feat(stats): Track games layout`.

### Task 5: Verify the key shape and the Around the Clock V2 case

**Files:**
- Test: `app/tests/lib/stats/track/track-games-keys.test.ts`

- [ ] **Step 1:** Find what `target-accuracy` returns for each derived game: read its derived-intent fold (`intent-derived` family, Section Catalog §1) and the Around the Clock V2 engine (`TARGET_AIM_ZONES`, `NUMBER` and `OUTER_SINGLE`).
- [ ] **Step 2: Write the test** that pins the finding: for each of Singles, Shanghai, Around the Clock V1 and V2, a fold fixture (existing fixtures under `app/tests/` where one exists) yields attempt keys that all fall inside `trackRowKeys(gameTypeKey)`.
- [ ] **Step 3:** If any key falls outside (for example `OUTER_SINGLE:n` for V2), widen the row keys in `heatmap-targets.ts` (or fold the aim zone into its `NUMBER:n` row in `tallyDoublesTraining`) so the row exists; record the case in the decision block. Run the test — pass.
- [ ] **Step 4: Commit** `test(stats): Track games target keys`.

### Task 6: Docs

**Files:**
- Modify: `docs/architecture/10-Statistics/01-Section-Catalog.md` (Track games dedicated-layout paragraph; the four games' rows), `docs/architecture/00-File-Inventory.md` (new files and tests), `docs/architecture/07-Frontend/08-Component-Inventory.md` (the overview, the `AimCardSection` slot), `docs/architecture/00-Context-Map-History.md` (next version line)
- Create: one decision block in `decisions/api.md` (id from `bash scripts/next-decision-id.sh`) recording the shared layout per kernel family, the tile rules, Baseball left out and the key-set generalisation. Existing blocks are not edited.

- [ ] **Step 1:** Apply the targeted edits.
- [ ] **Step 2: Run** `bash scripts/check-context-budget.sh` (and `--update` only if its gate fails after estimates are corrected by hand), then the docs gates the `run-all-gates` skill lists — pass.
- [ ] **Step 3: Commit** `docs(stats): Track games statistics page`.

### Task 7: Verify and finish

- [ ] **Step 1:** `cd app && npm run format`, then `npm run format:check` — clean; commit any diff.
- [ ] **Step 2:** From `app/`: `bash ../scripts/fallow-gate.sh`, `npm test`, `npm run check`, `bash ../scripts/check-quality-benchmarks.sh`, `bash ../scripts/check-dupes.sh` — all pass (`validate:app` stops at `db:status` without `DATABASE_URL`; report that the `db:*` steps were not run).
- [ ] **Step 3:** Ask the owner whether to run the design sync (D524); then push and open the PR with `finishing-a-dart-branch`, subscribe to it, and unsubscribe once CI is green on the head.
