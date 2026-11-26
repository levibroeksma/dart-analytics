# Fives Statistics Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/statistics` layout for Fives (`FIVES_V1`), built on a new server section `fives`. It shows four tiles compared with the previous period (win rate, scoring visit rate, points per visit, visits per win) and a visit outcomes card.

**Architecture:**
- A pure fold module replays each owner session once through `foldFivesState`, reads the owner seat off the final state, and emits `FivesMetrics` per bucket. It reuses the replay plumbing Elimination introduced (`findReplayFoldRows`, `ownerSessions`, `foldOwnerSessions`, `foldedBuckets`).
- `addDeep` moves out of `elimination.module.ts` into a shared helper, so both sections sum metrics through the same code.
- One Alpine scope, making two un-bucketed reads, feeds `FivesStatsOverview.astro`.
- No migration.

**Tech Stack:** Astro, Alpine.js, TypeScript, Drizzle (repository reads), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-26-fives-statistics-page-design.md`

## Global Constraints

- Ruleset `FIVES_V1`, game type `FIVES`. Bull 500 is untouched and stays in `HEATMAP_ONLY_LAYOUTS`.
- **Units.** Each `FivesMetrics` field is a count of the unit named in its doc comment:
  - Sessions: `games`, `finished`, `wins`.
  - Visits: `visits`, `scoringVisits`, `voids`, `busts`, `winVisits`.
  - Fives points: `points`.
- **Owner:** the session's one `PLAYER` seat. A win is a `COMPLETE` fold whose `winningSideKey` equals the owner seat's `sideKey`.
- **Seat fields:** `visits`, `scoringVisits`, `voids`, `busts` and `points` are copied from the owner seat of `foldFivesState(facts, config)` (`seat.visits`, `seat.scoringVisits`, `seat.voids`, `seat.busts`, `seat.total`). Nothing is recomputed.
- **No five** = `visits − scoringVisits − voids − busts`. It is never stored.
- **Floor:** a tile's change needs `MIN_TARGET_SAMPLE` (30) in both periods' denominators. All Time shows "No earlier period".
- **Reuse, never copy:** `foldFivesState`, `ownerSessions`, `foldOwnerSessions`, `foldedBuckets`, `ratioTile`, `meanTile`, `comparisonSection`, `periodComparison`, `formatRate`, `AimTable.astro`, `StatTileRow.astro`.
- No inline comments in `app/src/**` function bodies. Tests go under `app/tests/`, mirroring `src/`, one per changed runtime `.ts`.
- Gates: `npm test`, `npx astro check` 0/0/0, `npm run format:check`, the `run-all-gates` scripts, the quality ratchet, `check-dupes`.

## Review Focus

1. **The winner's last visit is not dropped, and an unfinished session's open visit is not counted.** A won session's `winVisits` equals the owner seat's `visits`, including the closing visit. A session left mid-visit counts only closed visits. Pinned in Task 2.
2. **A loss adds nothing to `winVisits`,** and an opponent win gives `finished` 1 and `wins` 0. Pinned in Task 2.
3. **The four outcomes always sum to visits:** a void that would also pass 51 is a void, not a bust (the kernel tests the void first). Pinned in Tasks 2 and 3.
4. **Sessions that cannot replay** (an unseated turn, no single `PLAYER` seat, an undecodable snapshot) are skipped and counted, never thrown. Pinned in Task 2.
5. **An empty period** shows "No finished games yet", "No visits yet" and "No wins", and its outcome rows show `formatRate(null)`, never `NaN`. Pinned in Task 3.

---

### Task 1: Shared metrics sum

**Files:**
- Modify: `app/src/modules/stats/sections/series.module.ts`. Add the exported `addCounts`, moved from `elimination.module.ts`'s private `addDeep`.
- Modify: `app/src/modules/stats/sections/elimination.module.ts`. Delete `addDeep`. `addEliminationMetrics` returns `addCounts(a, b)`.
- Test: `app/tests/modules/stats/sections/series.module.test.ts`

**Interfaces:**
- Produces: `addCounts<T>(a: T, b: T): T`, which sums every numeric leaf of two values of the same shape and leaves its inputs unchanged.

- [ ] **Step 1: Write the failing test.** `addCounts({ a: 1, n: { b: 2 } }, { a: 3, n: { b: 4 } })` equals `{ a: 4, n: { b: 6 } }`, and the first argument is unchanged.
- [ ] **Step 2: Run** `cd app && npx vitest run tests/modules/stats/sections/series.module.test.ts`. Expect FAIL (`addCounts` is not exported).
- [ ] **Step 3: Implement** the move.
- [ ] **Step 4: Run** `cd app && npx vitest run tests/modules/stats/sections`. Expect PASS, Elimination's `addEliminationMetrics` test included.
- [ ] **Step 5: Commit** `refactor(stats): shared addCounts metrics sum`

### Task 2: `fives` fold module

**Files:**
- Create: `app/src/modules/stats/sections/fives.module.ts`
- Modify: `app/src/modules/stats/types.ts` (`FivesMetrics`, `FivesFoldedSession`), plus the barrels.
- Test: `app/tests/modules/stats/sections/fives.module.test.ts`

**Interfaces:**
- Consumes: `OwnerSession`, `foldOwnerSessions`, `foldedBuckets` and `addCounts` (Task 1). Also `foldFivesState`, `seatOf`, and `FivesSnapshot`/`Seated` from `@lib/types`.
- Produces:
  - `FIVES_GAMES: readonly ["FIVES"]`, typed as `readonly "FIVES"[]`.
  - `type FivesMetrics = { games; finished; wins; visits; scoringVisits; voids; busts; points; winVisits }`. Every field is a `number` whose doc comment names its unit.
  - `emptyFivesMetrics(): FivesMetrics`
  - `addFivesMetrics(a, b): FivesMetrics`, which is `addCounts`.
  - `fivesSessionMetrics(session: OwnerSession<"FIVES">): FivesMetrics`. It first checks every turn with `seatOf`, as Elimination does. It throws when the owner holds no seat.
  - `type FivesFoldedSession`, the `foldOwnerSessions` result shape for `FivesMetrics`, named as the Elimination counterpart is.
  - `foldFivesSessions(sessions): { sessions: FivesFoldedSession[]; skippedSessions: number }`
  - `fivesBuckets(sessions, ctx: { to: string; now: Date }): SeriesBucket<FivesMetrics>[]`

- [ ] **Step 1: Write failing tests.** Build facts with `FivesEngine` and two seats, OWNER (`PLAYER`) and RIVAL (`GUEST`), as `elimination.module.test.ts` does. Darts use `zoneCentroid` coordinates where the engine needs them.
  - **Mixed visits:**
    - The owner throws S5 S5 S5, a visit of 15 that scores 3.
    - The rival throws three misses, a void.
    - The owner throws S1 S1 S1, a total of 3 that is not a five.
    - Expect `visits` 2, `scoringVisits` 1, `voids` 0, `busts` 0, `points` 3, `finished` 0 and `winVisits` 0.
  - **Owner win (Review Focus 1):** the owner throws T20 T20 T20 (180 → 36), the rival throws three misses, then the owner throws T20 S10 S5 (75 → 15), which reaches exactly 51. Expect `visits` 2, `finished` 1, `wins` 1, `points` 51 and `winVisits` 2, so the closing visit is included.
  - **Bust and void:** the owner reaches 48 with T20 T20 T20 (36) and S20 S20 S20 (12). The rival misses between each owner visit.
    - Next, S15 S15 S15 (45 → 9) would make 57, so it busts: `busts` 1 and `points` 48.
    - Next, a single miss dart in an otherwise scoring visit voids it: `voids` 1.
    - Review Focus 3: from 48, T20 T20 miss (it would score 24 and pass 51) is a void only: `voids` +1 and `busts` unchanged.
  - **Opponent win (Review Focus 2):** the rival reaches 51 first. Expect `finished` 1, `wins` 0, `winVisits` 0.
  - **Open visit (Review Focus 1):** a session ended after two owner darts in a visit. That visit is not counted.
  - **Review Focus 4:**
    - An unseated turn is skipped and counted.
    - An owner with no seat is skipped and counted.
    - `fivesBuckets([])` is `[]`.
  - **Buckets:** two sessions sum into one bucket with `sampleSize` 2.
- [ ] **Step 2: Run** `cd app && npx vitest run tests/modules/stats/sections/fives.module.test.ts`. Expect FAIL.
- [ ] **Step 3: Implement.** Follow `elimination.module.ts`'s `common()` for games, finished and wins. Read the four seat counters and `total` off `ownerIn(final.seats, ownerRef)`. `winVisits` is `wins ? seat.visits : 0`. If an owner-seat finder would be a second copy of Elimination's `ownerIn`, move it to `replay.module.ts` and export it (check-dupes).
- [ ] **Step 4: Run** the same command. Expect PASS.
- [ ] **Step 5: Commit** `feat(stats): fives section fold`

### Task 3: Register, serve, and client derivations

**Files:**
- Modify: `app/src/lib/stats/types.ts`. Add `"fives"` to both section-id unions, `fives: FivesMetrics` to the server metrics map, and `export * from "./fives/types"`.
- Modify: `app/src/lib/stats/section-registry.ts`. Add `fives: { id: "fives", version: 1, requires: ["board"], games: ["FIVES"], computeSite: "server", bucketable: true, includesAbandoned: false, configSensitive: [], params: [] }`.
- Modify: `app/src/lib/stats/merge-metrics.ts`. Add `fives: addFivesMetrics`.
- Modify: `app/src/pages/api/statistics/types.ts`. Add `FivesSeriesResponse`, following `EliminationSeriesResponse`, with every field a non-negative integer.
- Modify: `app/src/services/statistics.service.ts`. Add `fivesLoad`, shaped like `eliminationLoad` but using `FIVES_GAMES` and `foldFivesSessions`, and add `HANDLERS.fives`.
- Create: `app/src/lib/stats/fives/types.ts`, `app/src/lib/stats/fives/fives-comparison.ts` and `app/src/lib/stats/fives/fives-cards.ts`.
- Test:
  - `section-registry.test.ts`
  - `merge-metrics.test.ts`
  - `statistics.service.test.ts`
  - `pages/api/statistics/types.test.ts`
  - `app/tests/lib/stats/fives/*.test.ts`

**Interfaces:**
- Consumes: Task 2. Also `ratioTile`, `meanTile`, `AceMeasure`, `Ratio`, `TrackTile`, `AimTableRow` and `formatRate`.
- Produces:
  - `sumFives(buckets: readonly SeriesBucket<FivesMetrics>[]): FivesMetrics`
  - `type FivesComparison = Record<"wins" | "scoringRate" | "pointsPerVisit" | "visitsPerWin", AceMeasure>`:
    - `wins`: wins ÷ finished.
    - `scoringRate`: scoringVisits ÷ visits.
    - `pointsPerVisit`: points ÷ visits.
    - `visitsPerWin`: winVisits ÷ wins.
  - `fivesComparison(current, previous: FivesMetrics | null): FivesComparison`
  - `fivesTiles(c: FivesComparison): TrackTile[]`, in this order:
    - `ratioTile("Win rate", c.wins, "No finished games yet")`
    - `ratioTile("Scoring visit rate", c.scoringRate, "No visits yet")`
    - `meanTile("Points per visit", c.pointsPerVisit, "No visits yet", 1)`
    - `meanTile("Visits per win", c.visitsPerWin, "No wins", 1)`. Use the lower-is-better delta direction if `meanTile` takes one, as Darts to Killer does.
  - `visitOutcomeRows(m: FivesMetrics): AimTableRow[]`. Rows Scored, No five, Void and Bust. `count` is visits, cells are `[formatRate(count ÷ visits)]`, and every cell is `formatRate(null)` with no visits.
  - `type FivesCard = { comparison: FivesComparison; outcomes: AimTableRow[] }`
  - `fivesCard(current, previous): FivesCard`

- [ ] **Step 1: Write failing tests:**
  - The registry lists `fives` for exactly `FIVES`.
  - `addFivesMetrics` sums every field in the merge.
  - The service, with the repository mocked, sums `skippedSessions` and serves a bucket.
  - The response schema accepts a bucket and rejects a negative count.
  - The tile titles come in order.
  - Review Focus 5: all-zero metrics give no `NaN`, plus "No finished games yet", "No visits yet" and "No wins".
  - 29 visits in either period gives "No comparison yet" on the scoring visit rate.
  - Review Focus 3: the outcome counts sum to `visits`, and the shares sum to 100%.
- [ ] **Step 2: Run** `cd app && npx vitest run tests/lib/stats tests/services/statistics.service.test.ts tests/pages`. Expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command, plus `npx astro check`. Expect PASS and 0/0/0.
- [ ] **Step 5: Commit** `feat(stats): serve the fives section with comparison and outcome rows`

### Task 4: Section factory and layout

**Files:**
- Create: `app/src/lib/stats/sections/fives-section.data.ts` (`fivesSection()`)
- Create: `app/src/components/layout/games/statistics/FivesStatsOverview.astro`
- Modify: `app/src/lib/client/alpine/register-route-data.ts`
- Modify: `app/src/lib/stats/constants.ts`. Add `FIVES_LAYOUTS` holding `FIVES_V1`, and remove `FIVES_V1` from `HEATMAP_ONLY_LAYOUTS`.
- Modify: `app/src/pages/statistics/index.astro`. Add the branch and the fall-through exclusion, mirroring `eliminationRulesets`.
- Test:
  - `app/tests/lib/stats/sections/fives-section.data.test.ts`
  - `register-route-data.test.ts`
  - `constants.test.ts`

**Interfaces:**
- Consumes: Task 3, `comparisonSection`, `periodComparison` and `loadGameSection`.
- Produces:
  - `fivesSection()` = `comparisonSection(periodComparison(readFives, (c, p) => fivesCard(c, p), EMPTY_CARD), EMPTY_CARD, (card) => fivesTiles(card.comparison))`.
  - The layout mirrors `EliminationStatsOverview.astro`:
    1. The completion grid.
    2. `x-data="fivesSection()"` holding `ErrorAlert` and `StatTileRow`.
    3. One glass card, shown on `!loading && card.outcomes.length`, with the eyebrow "VISIT OUTCOMES" and `AimTable headers={["Outcome", "Share"]}` over `card.outcomes`.
    4. `GameHeatmapSection`, then `GameSessionList`.

- [ ] **Step 1: Write failing tests:**
  - 30d makes 2 `fives` reads, both `bucket: "none"`.
  - All Time makes 1 read.
  - A failed read sets `error`.
  - The registration lists `fivesSection`.
  - `FIVES_LAYOUTS` is exactly `{FIVES_V1}` and is disjoint from every other layout set.
  - `HEATMAP_ONLY_LAYOUTS` keeps `BASEBALL_V1` and `BULL_500_V1`.
- [ ] **Step 2: Run** `cd app && npx vitest run tests/lib/stats tests/lib/client/alpine/register-route-data.test.ts`. Expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command, plus `npx astro check`. Expect PASS and 0/0/0.
- [ ] **Step 5: Screenshot.**
  - Write a `fives` series fixture JSON with one bucket (scratchpad).
  - Run `cd app && node scripts/screenshot-page.mjs /statistics <scratchpad>/fives.png --click "501" --click "Fives" --fixture "<substring>=<fixture>.json"`. The substring is one that only the `fives` section request URL contains; read it off `loadGameSection`'s URL builder. The fixture syntax is in `app/CLAUDE.md`.
  - Read the PNG. Confirm the order (completion, four tiles, outcomes card, heatmap) and that no tile shows `NaN`.
- [ ] **Step 6: Commit** `feat(stats): fives statistics layout`

### Task 5: Docs, decision, gates

**Files:**
- Create: `decisions/api/pending-fives-statistics-page.md` from `decisions/TEMPLATE.md`. Record the section, the Global Constraints definitions, the layout, `addCounts`, and Bull 500 deferred until it is playable.
- Modify: `docs/architecture/10-Statistics/01-Section-Catalog.md`. Bump the minor version, add a `fives` section row, add it to the Fives game row, and add a Fives layout paragraph.
- Modify: `docs/architecture/10-Statistics/00-Overview.md`, only where it lists server sections or the readers of `v_game_replay`.
- Modify: the File Inventory rows for the new files, the component inventory, and a context-map history entry.

- [ ] **Step 1:** Make the targeted doc edits.
- [ ] **Step 2:** Run `cd app && npm run format && npm run format:check`. Expect clean.
- [ ] **Step 3:** Run the gates per `run-all-gates`: `npm test`, `npx astro check`, `check-test-coverage`, `check-type-barrels`, `check-dupes`, `check-doc-sync`, `check-context-budget`, `check-quality-benchmarks`, `check-decision-pending`, `fallow-gate`. Expect each to pass.
- [ ] **Step 4: Commit** `docs(stats): fives statistics page`
- [ ] **Step 5:**
  - Run a fresh whole-branch review.
  - Ask the owner about the design sync.
  - Open the PR (`finishing-a-dart-branch`) with the `ready-to-merge` label for the pending decision, and subscribe to it.
