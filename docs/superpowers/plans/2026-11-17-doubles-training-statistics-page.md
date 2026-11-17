# Doubles Training Statistics Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `DOUBLES_TRAINING_V1` gets a dedicated `/statistics` layout: a Doubles accuracy card (per double: hit rate, left/right/high/low misses, inside/within/outside, near/loose) with a favourite-double headline, over the page Period, above the existing heatmap and session list.

**Architecture:** A pure derivation module joins three existing sections (`target-accuracy`, `miss-direction`, `loose-darts`) by target key. One Alpine factory fetches the three un-bucketed over the page Period and exposes `headline`, `caption`, `table`, so the existing `AimCardSection` renders it. A new overview component and a layout set switch the page. No migration, endpoint or section id.

**Tech Stack:** Astro, TypeScript, Alpine.js, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-17-doubles-training-statistics-page-design.md`

## Global Constraints

- Floors: `MIN_ROW_SAMPLE` 10 (row rate hidden below), `MIN_TARGET_SAMPLE` 30 (favourite needs it); both from `@lib/stats/constants`.
- Sectors (`missSector`, 0 = up, clockwise): left 5, 6, 7; right 1, 2, 3; high 0; low 4. Radial bands `INSIDE`, `WITHIN`, `OUTSIDE`.
- Rows are the 20 `DOUBLE:n` keys plus `INNER_BULL:25`, labelled by `targetLabel` (`D16`, `BULL`); only rows with darts appear, sorted by number, bull last.
- Near miss threshold shown in the footer from `NEAR_MISS_MM`.
- Favourite tie-break: more darts, then lower number.
- Gates: test per changed runtime `.ts` (tests mirror `app/src/` under `app/tests/`); no inline comments in function bodies; type declarations only in `types.ts` barrels (type-barrel gate); astro check 0/0/0; `npm run format` then `format:check`; `bash scripts/check-dupes.sh`; `bash scripts/check-context-budget.sh`; quality ratchet `mi_average` floor 91.05 (one new `lib/stats/` module file besides types is the budget; do not add more).
- Commit trailers: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01UTDrHPdGdopff61XchEUTp`.

## Review Focus

- No darts in the Period: no rows, headline "—", caption "Not enough darts yet", no NaN.
- A double present in `target-accuracy` but absent from `miss-direction` or `loose-darts`: zeros, not a crash.
- Several buckets: sums are field-wise across buckets.
- Favourite tie, and a high-rate row under 30 darts never wins.
- Any one of the three fetches failing: `error` set, no partial card.
- A response that arrives after a Period change is dropped.

---

### Task 1: Derivation module

**Files:**
- Create: `app/src/lib/stats/doubles/doubles-training-card.ts`, `app/src/lib/stats/doubles/types.ts`
- Modify: `app/src/lib/stats/types.ts` (raise `./doubles/types`)
- Test: `app/tests/lib/stats/doubles/doubles-training-card.test.ts`

**Interfaces:**
- Produces, in `doubles/types.ts`:
  - `DoublesTrainingRow = { aim: string; label: string; darts: number; hits: number; rate: number | null; left: number; right: number; high: number; low: number; inside: number; within: number; outside: number; nearMiss: number; loose: number }`
  - `DoublesTrainingInput = { accuracy: readonly SeriesBucket<TargetAccuracyMetrics>[]; misses: readonly SeriesBucket<MissDirectionMetrics>[]; loose: readonly SeriesBucket<LooseDartsMetrics>[] }`
  - `DoublesTrainingCard = { favourite: DoublesTrainingRow | null; darts: number; rows: DoublesTrainingRow[] }`
- Produces: `doublesTrainingCard(input: DoublesTrainingInput): DoublesTrainingCard`.

- [ ] **Step 1: Write the failing tests**, one per behaviour, with these assertions:
  - `DOUBLE:16` accuracy `{attempts: 40, hits: 20}`, misses `[{sector: 7, radial: "INSIDE", darts: 6}, {sector: 3, radial: "OUTSIDE", darts: 4}, {sector: 0, radial: "WITHIN", darts: 5}, {sector: 4, radial: "WITHIN", darts: 5}]`, loose `{onTarget: 20, nearMiss: 12, loose: 6}` gives one row `{aim: "DOUBLE:16", label: "D16", darts: 40, hits: 20, rate: 0.5, left: 6, right: 4, high: 5, low: 5, inside: 6, within: 10, outside: 4, nearMiss: 12, loose: 6}`; `favourite` is that row; `darts` is 40.
  - a row with 9 darts has `rate: null`; 10 darts has a rate.
  - `favourite` ignores a 100% row with 29 darts in favour of a 60% row with 30; a tie on rate picks the row with more darts, then the lower number.
  - empty input: `{favourite: null, darts: 0, rows: []}`.
  - a key in `accuracy` only: miss and loose fields are 0.
  - two buckets of the same key: counts add.
  - keys other than `DOUBLE:n` and `INNER_BULL:25` are ignored; rows sort D1 to D20, bull last.
- [ ] **Step 2: Run** `cd app && npx vitest run tests/lib/stats/doubles` — expect FAIL (module missing).
- [ ] **Step 3: Implement** `doublesTrainingCard` and the types; barrel raise. Sum buckets by key into a per-aim row, then derive rate and favourite. Label with `targetLabel` from `@lib/stats/target-key`; rate via `rateOf` from `@lib/stats/x01/aim-rows`.
- [ ] **Step 4: Run** the same command — expect PASS; run `npm run check` and `bash ../scripts/check-type-barrels.sh` — 0 errors.
- [ ] **Step 5: Commit** `feat(stats): Doubles Training card derivation`.

### Task 2: Alpine factory

**Files:**
- Create: `app/src/lib/stats/sections/doubles-training-card.data.ts`
- Modify: `app/src/lib/client/alpine/register-route-data.ts` (import and `Alpine.data("doublesTrainingCardSection", doublesTrainingCardSection)`)
- Test: `app/tests/lib/stats/sections/doubles-training-card.data.test.ts`

**Interfaces:**
- Consumes: `doublesTrainingCard` and `DoublesTrainingCard` (Task 1); `loadGameSection`, `heatmapWindow`, `variationParam`, `reloadOnPageFilters`, `GAME_TYPE_BY_RULESET` as `periodSection` uses them (`lib/stats/sections/period-section.ts`); `formatRate` (`@lib/stats/x01/format`); `AimTableRow` (`@lib/types`).
- Produces: `doublesTrainingCardSection()` returning an Alpine scope with `loading: boolean`, `error: string | null`, `card: DoublesTrainingCard`, `init()`, `load(now?: Date): Promise<void>`, and getters `headline: string`, `caption: string`, `table: AimTableRow[]`.

- [ ] **Step 1: Write the failing tests** (mock `@lib/stats/load-game-section` by `sectionId` argument; scope `$data: { rangeKey: "30d", game: "DOUBLES_TRAINING_V1", variation: 0 }`, `$watch: () => {}`; follow `tests/lib/stats/sections/doubles-card.data.test.ts`):
  - loads `target-accuracy`, `miss-direction` and `loose-darts` with `bucket: "none"` over `heatmapWindow("30d", now)`; the Task 1 example gives `headline` "50.0%", `caption` "Favourite D16, 40 darts", `table[0]` `{label: "D16", count: 40, cells: ["50.0%", "6/4", "5/5", "6/10/4", "12/6"]}`.
  - no darts: `headline` "—" (the `formatRate(null)` output), `caption` "Not enough darts yet", `table` `[]`.
  - one section rejecting: `error` is its message, `card.rows` is `[]`.
  - two loads where the first resolves last: the first result is dropped.
  - an unknown `game` leaves `loading` false and `card.rows` empty.
- [ ] **Step 2: Run** `npx vitest run tests/lib/stats/sections/doubles-training-card.data.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** with `Promise.all` over the three fetches and a ticket for stale responses, `reloadOnPageFilters` in `init`. Overlay cells in the column order of Task 3's headers.
- [ ] **Step 4: Run** the test — expect PASS; `npm test -- tests/lib/client` for the registration if a registration test exists.
- [ ] **Step 5: Commit** `feat(stats): Doubles Training card Alpine scope`.

### Task 3: Overview and layout switch

**Files:**
- Create: `app/src/components/layout/games/statistics/DoublesTrainingStatsOverview.astro`
- Modify: `app/src/lib/stats/constants.ts` (new `DOUBLES_TRAINING_LAYOUTS: ReadonlySet<string>` = `{"DOUBLES_TRAINING_V1"}`; remove it from `HEATMAP_ONLY_LAYOUTS`), `app/src/pages/statistics/index.astro` (third layout branch, and the fallback `x-if` excludes it)
- Test: `app/tests/lib/stats/constants.test.ts`

**Interfaces:**
- Consumes: `AimCardSection` props `factory: "doublesTrainingCardSection"`, `title: "DOUBLES"`, `titleId: "doubles-training-card-title"`, `headers: ["Double", "Hit", "Left/Right", "High/Low", "In/Within/Out", "Near/Loose"]`, `footerExpr`: `` `${card.darts} double darts · near miss within ${NEAR_MISS_MM} mm` `` (interpolate the constant in frontmatter); `GameCompletionSection`, `GameHeatmapSection`, `GameSessionList`.
- Layout: completion tile row as in `HeatmapStatsOverview.astro` (left cell), then the card, then heatmap, then session list.

- [ ] **Step 1: Write the failing tests** in `constants.test.ts`: `DOUBLES_TRAINING_LAYOUTS` holds `DOUBLES_TRAINING_V1`; `HEATMAP_ONLY_LAYOUTS` does not; the two sets, `X01_LAYOUTS` and `DEDICATED_STATS_LAYOUTS` do not overlap.
- [ ] **Step 2: Run** `npx vitest run tests/lib/stats/constants.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** the constant, the component and the page branch.
- [ ] **Step 4: Run** the test, then `npm run check` (0 errors, warnings, hints) and `node scripts/screenshot-page.mjs /statistics /tmp/doubles.png` from `app/`; read the PNG and confirm the page renders without error.
- [ ] **Step 5: Commit** `feat(stats): Doubles Training layout`.

### Task 4: Docs

**Files:**
- Modify: `docs/architecture/10-Statistics/01-Section-Catalog.md` (Doubles Training layout paragraph: dedicated layout, card, Period), `docs/architecture/00-File-Inventory.md` (rows for the three new files), `docs/architecture/07-Frontend/08-Component-Inventory.md` (the overview), `docs/architecture/00-Context-Map-History.md` (next version line)
- Create: one decision block in the domain file `DECISIONS.md` routes statistics decisions to, id from `bash scripts/next-decision-id.sh`; it records the page, the Period rule for all statistics pages, the sector mapping for left/right, and the bull row. Existing blocks are not edited.

- [ ] **Step 1:** Apply the targeted edits above.
- [ ] **Step 2: Run** `bash scripts/check-context-budget.sh --update` only if its gate fails, then the docs gates the `run-all-gates` skill lists for `docs/` changes — expect all pass.
- [ ] **Step 3: Commit** `docs(stats): Doubles Training statistics page`.

### Task 5: Verify and finish

- [ ] **Step 1:** `cd app && npm run format` then `npm run format:check` — clean; commit any diff.
- [ ] **Step 2:** From `app/`: `bash ../scripts/fallow-gate.sh`, `npm test`, `npm run check`, `bash scripts/check-quality-benchmarks.sh`, `bash ../scripts/check-dupes.sh` — all pass (`validate:app` stops at `db:status` without `DATABASE_URL`; report that the `db:*` steps were not run).
- [ ] **Step 3:** Ask the owner whether to run the design sync (D524); then push and open the PR with `finishing-a-dart-branch`, subscribe to it, and unsubscribe once CI is green on the head.
