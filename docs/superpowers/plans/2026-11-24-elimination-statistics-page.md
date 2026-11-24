# Elimination Statistics Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/statistics` layout for Killer, Follow the Leader and Prisoner, built on a new server section `elimination`. It shows win rate plus three game-specific tiles against the previous period, and one card per game (none for Killer).

**Architecture:**
- The Marks replay plumbing becomes game-neutral: `findReplayFoldRows` and `ownerSessions`. Marks is re-pointed to them.
- A pure fold module replays each session through the game's own fold (`foldKillerState`, `foldFollowTheLeaderState`, `foldPrisonerState`) and emits `EliminationMetrics` per bucket.
- One Alpine scope (two un-bucketed reads) feeds `EliminationStatsOverview.astro`; tiles and card rows are chosen by game.
- No migration.

**Tech Stack:** Astro, Alpine.js, TypeScript, Drizzle (repository reads), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-24-elimination-statistics-page-design.md`

## Global Constraints

- Rulesets: `KILLER_V1`, `FOLLOW_THE_LEADER_V1`, `PRISONER_V1`. Game types: `KILLER`, `FOLLOW_THE_LEADER`, `PRISONER`.
- **Units.** Every `EliminationMetrics` field is a count of the unit named in its doc comment.
  - Sessions: `games`, `finished`, `wins`, `killerGames`.
  - Darts: `darts`, `dartsToKiller`, `matchDarts`, and each Prisoner result count.
  - Lives: `livesLost`, `livesTaken`.
  - Visits: `matchVisits`, `matched`, and `byBed[*].visits` and `.matched`.
  - Numbers: `reached`.
- **Owner:** the session's one `PLAYER` seat. A win is a `COMPLETE` fold whose `winningSideKey` equals the owner seat's `sideKey`.
- **Lives lost:** the snapshot's starting `lives` minus the owner seat's final `lives`, for Killer and Follow the Leader. Prisoner always reports 0.
- **Follow the Leader match visit:** an owner turn, not `kept`, that starts with a standing target (`shared.target !== null`) whose `leaderRef` is not the owner. It is matched when any dart satisfies `sameBed(bedOf(dart), target)`. `matchDarts` counts darts up to and including the first match.
- **Bed rows:** `SINGLE`, `DOUBLE`, `TREBLE`, and `BULL` (`OUTER_BULL` or `INNER_BULL`).
- **Prisoner results:** from `prisonerDartResults(stateBefore, ownerRef, turn.darts)`. `reached` is `min(target, 21) − 1` from the final owner seat.
- **Floors:**
  - A tile's change needs `MIN_TARGET_SAMPLE` (30) in both periods' denominators.
  - A bed row's rate needs `MIN_ROW_SAMPLE` (10) visits.
  - All Time shows "No earlier period".
- **Reuse, never copy:** the engines' folds, `bedOf`, `sameBed`, `prisonerDartResults`, `ratioTile`, `meanTile`, `comparisonSection`, `periodComparison`, `formatRate`.
- No inline comments in `app/src/**` function bodies. Tests go under `app/tests/` mirroring `src/`, one per changed runtime `.ts`.
- Gates: `npm test`, `npx astro check` 0/0/0, `npm run format:check`, `run-all-gates` scripts, quality ratchet, `check-dupes`.

## Review Focus

1. **A keep turn and a leader re-throw are not match visits.** A `kept` turn, and a turn by the leader owed a re-throw (`retryRef`), must not count in `matchVisits`. Pinned in Task 2.
2. **A spare-dart reset after a match** still counts the visit as matched, and `matchDarts` stops at the first match. Pinned in Task 2.
3. **A Killer who loses status and re-earns it** keeps the first `dartsToKiller`, as the engine records it. Pinned in Task 2.
4. **Sessions that cannot replay** (an undecodable snapshot, no single `PLAYER` seat, an engine throw) are skipped and counted, never thrown. Pinned in Tasks 1 and 2.
5. **An empty period for one game** shows "No finished games yet" and the like, never `NaN`. With no lives taken, Darts per life taken shows "No lives taken". Pinned in Task 4.

---

### Task 1: Game-neutral replay plumbing

**Files:**
- Modify: `app/src/repositories/statistics.repository.ts`. Rename `findMarksFoldRows` to `findReplayFoldRows`. The body is unchanged.
- Modify: `app/src/modules/stats/types.ts`.
  - Rename `MarksFoldRow` to `ReplayFoldRow`.
  - Add `OwnerSession<G extends string>`.
  - Make `MarksSession` an alias, `OwnerSession<MarksGameKey>`.
- Modify: `app/src/modules/stats/replay.module.ts`. Add `ownerSessions`, moved out of `marks.module.ts`'s `marksSessions`, `marksSessionOf` and `seatsOf`.
- Modify: `app/src/modules/stats/sections/marks.module.ts`. Remove the moved code. `marksSessions(rows)` becomes `ownerSessions(rows, MARKS_GAMES)`, or callers call it directly.
- Modify: `app/src/services/statistics.service.ts`: the renamed imports.
- Test:
  - Move the session-grouping cases from `app/tests/modules/stats/sections/marks.module.test.ts` to `app/tests/modules/stats/replay.module.test.ts`.
  - Update the repository and service tests for the rename.
  - Update the golden SQL snapshot name if it is keyed by function name.

**Interfaces:**
- Produces:
  - `type OwnerSession<G extends string> = { sessionId: string; gameTypeKey: G; bucketStart: string; bucketEnd: string; seats: readonly SeatFact[]; ownerRef: string; config: Record<string, unknown> & { seats: readonly SeatFact[] }; facts: EngineFacts }`. `config` is `snapshotOf`'s result, with `seats` replaced by the resolved seats.
  - `ownerSessions<G extends string>(rows: readonly ReplayFoldRow[], games: readonly G[]): { sessions: OwnerSession<G>[]; skippedSessions: number }`. Same skip rules as today's `marksSessions`, plus a session whose `gameTypeKey` is not in `games` is skipped.
  - `findReplayFoldRows(db, q: SessionScope & { bucket: Bucket; tz: string | undefined }): Promise<ReplayFoldRow[]>`.

- [ ] **Step 1: Write failing tests** in `replay.module.test.ts`:
  - `ownerSessions` carries `config` with the decoded snapshot fields (a `KILLER_V1` configuration with `seatNumbers` and `lives` round-trips).
  - A game not in `games` is skipped and counted.
  - The existing Marks grouping cases (seatless solo, no single `PLAYER`, undecodable snapshot) pass against `ownerSessions`.
- [ ] **Step 2: Run** `cd app && npx vitest run tests/modules/stats`. Expect FAIL (`ownerSessions` missing).
- [ ] **Step 3: Implement** the move and the renames. `git grep -n "MarksFoldRow\|findMarksFoldRows\|marksSessions"` must return only docs.
- [ ] **Step 4: Run** `cd app && npx vitest run tests/modules/stats tests/services tests/repositories && npx astro check`. Expect PASS and 0/0/0.
- [ ] **Step 5: Commit** `refactor(stats): game-neutral replay fold rows and owner sessions`

### Task 2: `elimination` fold module

**Files:**
- Create: `app/src/modules/stats/sections/elimination.module.ts`
- Modify: `app/src/modules/stats/types.ts` (`EliminationGameKey`, `EliminationMetrics`, `EliminationFoldedSession`), plus the barrels.
- Test: `app/tests/modules/stats/sections/elimination.module.test.ts`

**Interfaces:**
- Consumes: `OwnerSession`, `ownerSessions` (Task 1). Also `foldKillerState`, `foldFollowTheLeaderState`, `foldPrisonerState`, `bedOf`, `sameBed`, `prisonerDartResults`, and `closeBuckets`.
- Produces:
  - `type EliminationGameKey = "KILLER" | "FOLLOW_THE_LEADER" | "PRISONER"`, and `ELIMINATION_GAMES: readonly EliminationGameKey[]`.
  - `type BedKey = "SINGLE" | "DOUBLE" | "TREBLE" | "BULL"`.
  - `type EliminationMetrics = { games; finished; wins; darts; livesLost; killer: { killerGames; dartsToKiller; livesTaken }; followTheLeader: { matchVisits; matched; matchDarts; byBed: Record<BedKey, { visits; matched }> }; prisoner: { advance; advanceAndCapture; capture; prison; miss; reached } }`. All fields are `number`, and each carries a doc comment naming its unit.
  - `emptyEliminationMetrics(): EliminationMetrics`
  - `eliminationSessionMetrics(session: OwnerSession<EliminationGameKey>): EliminationMetrics`. It dispatches by `gameTypeKey`. It throws when the owner holds no seat or a fold throws.
  - `addEliminationMetrics(a, b): EliminationMetrics`: a field-wise sum.
  - `foldEliminationSessions(sessions): { sessions: EliminationFoldedSession[]; skippedSessions: number }`. Mirrors `foldMarksSessions`.
  - `eliminationBuckets(sessions: readonly EliminationFoldedSession[], ctx: { to: string; now: Date }): SeriesBucket<EliminationMetrics>[]`. Mirrors `marksBuckets`.
  - The per-visit state before an owner turn is the game's fold over `{ stages, turns: turns.slice(0, i) }`.

- [ ] **Step 1: Write failing tests.** Build facts as `tests/modules/game/{killer,follow-the-leader,prisoner}.engine.module.test.ts` do.
  - **Killer:**
    - The owner hits their own double on dart 4, then takes 3 lives.
    - Expect `killerGames` 1, `dartsToKiller` 4, `livesTaken` 3, `wins` 1 and `finished` 1. `livesLost` is 0.
    - Review Focus 3: losing status and re-earning it keeps `dartsToKiller` at the first value.
  - **Follow the Leader:**
    - The opponent opens on T20. The owner matches on dart 2, so `matchVisits` 1, `matched` 1, `matchDarts` 2 and `byBed.TREBLE` `{1,1}`.
    - A failed match on D5 counts `byBed.DOUBLE` `{1,0}` and `livesLost` 1.
    - Review Focus 1: a `kept` owner turn, and an owner setting turn, add no match visit.
    - Review Focus 2: a match on dart 1, then a spare dart on S1 that sets a new target, gives `matched` 1 and `matchDarts` 1.
  - **Prisoner:**
    - Owner darts: outer 1 (Advance), inner 2 (Prison), miss.
    - Expect `advance` 1, `prison` 1, `miss` 1, `darts` 3 and `reached` 1.
  - **Review Focus 4:**
    - An unseated turn is skipped and counted, and `eliminationBuckets` emits nothing for it.
    - `addEliminationMetrics` sums nested fields.
- [ ] **Step 2: Run** `cd app && npx vitest run tests/modules/stats/sections/elimination.module.test.ts`. Expect FAIL.
- [ ] **Step 3: Implement.** Do not copy `foldMarksSessions` or `marksBuckets`. If their bodies would be the third copy of a fold-skip or bucket-sum shape, extract a generic helper into `series.module.ts` or `replay.module.ts` and re-point Marks to it (D513).
- [ ] **Step 4: Run** the same command. Expect PASS.
- [ ] **Step 5: Commit** `feat(stats): elimination section fold`

### Task 3: Register, load and serve `elimination`

**Files:**
- Modify: `app/src/lib/stats/types.ts`. Add `"elimination"` to `SectionId` and the server metrics map.
- Modify: `app/src/lib/stats/section-registry.ts`. Add `elimination: { id: "elimination", version: 1, requires: ["board"], games: ["KILLER", "FOLLOW_THE_LEADER", "PRISONER"], computeSite: "server", bucketable: true, includesAbandoned: false, configSensitive: [], params: [] }`.
- Modify: `app/src/lib/stats/merge-metrics.ts`. Add `elimination: addEliminationMetrics`.
- Modify: `app/src/pages/api/statistics/types.ts`. Add the zod `EliminationSeriesResponse`, following `MarksSeriesResponse`.
- Modify: `app/src/services/statistics.service.ts`. Add `eliminationLoad`, shaped like `marksLoad` (`findReplayFoldRows`, then `ownerSessions(rows, ELIMINATION_GAMES)`, then `foldEliminationSessions`). Add `HANDLERS.elimination = { server: { load: eliminationLoad, shape: eliminationBuckets } }`.
- Test:
  - `section-registry.test.ts`: `elimination` is listed for exactly the three games.
  - `merge-metrics.test.ts`: elimination metrics sum.
  - `statistics.service.test.ts`: with the repository mocked, the `skippedSessions` sum and a served bucket.
  - The response schema test, if Marks has one.
  - `statistics-sql.itest.ts`: run only where a database is available. Note in the PR if not run.

- [ ] **Step 1: Write failing tests** (above).
- [ ] **Step 2: Run** `cd app && npx vitest run tests/lib/stats tests/services/statistics.service.test.ts tests/pages`. Expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command plus `npx astro check`. Expect PASS and 0/0/0.
- [ ] **Step 5: Commit** `feat(stats): serve the elimination section`

### Task 4: Client derivations

**Files:**
- Create: `app/src/lib/stats/elimination/types.ts`, raised through `lib/stats/types.ts`.
- Create: `app/src/lib/stats/elimination/elimination-comparison.ts`
- Create: `app/src/lib/stats/elimination/elimination-comparison-lines.ts`
- Create: `app/src/lib/stats/elimination/elimination-cards.ts`
- Test: `app/tests/lib/stats/elimination/*.test.ts`

**Interfaces:**
- Consumes: `EliminationMetrics` and `addEliminationMetrics` (Task 2). Also `ratioTile`, `meanTile`, `AceMeasure`, `Ratio`, `TrackTile`, `AimTableRow`, `formatRate`, `MIN_ROW_SAMPLE`.
- Produces:
  - `sumElimination(buckets: readonly SeriesBucket<EliminationMetrics>[]): EliminationMetrics`
  - `type EliminationComparison = Record<"wins" | "dartsToKiller" | "dartsPerLife" | "livesLost" | "matchRate" | "matchDarts" | "advance" | "prison" | "reached", AceMeasure>`
    - `wins`: wins ÷ finished.
    - `dartsToKiller`: dartsToKiller ÷ killerGames.
    - `dartsPerLife`: darts ÷ livesTaken.
    - `livesLost`: livesLost ÷ finished.
    - `matchRate`: matched ÷ matchVisits.
    - `matchDarts`: matchDarts ÷ matched.
    - `advance`: (advance + advanceAndCapture) ÷ darts.
    - `prison`: prison ÷ darts.
    - `reached`: reached ÷ finished.
  - `eliminationComparison(current, previous: EliminationMetrics | null): EliminationComparison`
  - `eliminationTiles(game: EliminationGameKey, c: EliminationComparison): TrackTile[]`. Four tiles, Win rate first:
    - `ratioTile("Win rate", wins, "No finished games yet")`.
    - Killer:
      - `meanTile("Darts to Killer", …, "Not a Killer yet", 1)`
      - `meanTile("Darts per life taken", …, "No lives taken", 1)`
      - `meanTile("Lives lost per game", …, "No finished games yet", 1)`
    - Follow the Leader:
      - `ratioTile("Match rate", …, "No match visits yet")`
      - `meanTile("Darts per match", …, "No matches yet", 1)`
      - Lives lost per game, as for Killer.
    - Prisoner:
      - `ratioTile("Advance rate", …, "No darts yet")`
      - `ratioTile("Prison rate", …, "No darts yet")`
      - `meanTile("Numbers completed per game", …, "No finished games yet", 1)`
  - `bedRows(m: EliminationMetrics): AimTableRow[]`. Rows Single, Double, Treble and Bull. `count` is visits, cells `[formatRate(rate)]`, and the rate shows from `MIN_ROW_SAMPLE` visits, `formatRate(null)` below.
  - `prisonerResultRows(m: EliminationMetrics): AimTableRow[]`. Rows Advance, Advance and capture, Capture, Prison and Miss. `count` is darts, cells `[formatRate(share of darts)]`, `formatRate(null)` with no darts.
  - `type EliminationCard = { comparison: EliminationComparison; tiles: TrackTile[]; rows: AimTableRow[]; rowHeaders: [string, string] | null; rowTitle: string | null }`. Killer has `rows: []` and both headers `null`.
  - `eliminationCard(game, current, previous): EliminationCard`

- [ ] **Step 1: Write failing tests:**
  - Each game's tile titles in order.
  - Review Focus 5: an all-zero current period gives no `NaN`, "No finished games yet" and "No lives taken".
  - The floor: 29 match visits in either period gives "No comparison yet".
  - A bed row with 9 visits withholds its rate.
  - Prisoner result shares sum to 100%.
- [ ] **Step 2: Run** `cd app && npx vitest run tests/lib/stats/elimination`. Expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command. Expect PASS.
- [ ] **Step 5: Commit** `feat(stats): elimination comparison and card rows`

### Task 5: Section factory and layout

**Files:**
- Create: `app/src/lib/stats/sections/elimination-section.data.ts` (`eliminationSection()`)
- Create: `app/src/components/layout/games/statistics/EliminationStatsOverview.astro`
- Modify: `app/src/lib/client/alpine/register-route-data.ts`
- Modify: `app/src/lib/stats/constants.ts`. Add `ELIMINATION_LAYOUTS` with the three rulesets, and remove them from `HEATMAP_ONLY_LAYOUTS`.
- Modify: `app/src/pages/statistics/index.astro`. Add the branch and the fall-through exclusion.
- Test:
  - `app/tests/lib/stats/sections/elimination-section.data.test.ts`
  - `app/tests/lib/client/alpine/register-route-data.test.ts`
  - `app/tests/lib/stats/constants.test.ts`

**Interfaces:**
- Consumes: `comparisonSection`, `periodComparison`, `loadGameSection`, and Task 4.
- Produces: `eliminationSection()`, built as `comparisonSection(periodComparison(readElimination, build, EMPTY_CARD), EMPTY_CARD, (card) => card.tiles)`.
  - `build` receives the game type, the same way `readMarks` receives it. If `periodComparison`'s build callback lacks the game, pass it through `periodComparison` rather than reading page state twice.
  - Layout, mirroring `MarksStatsOverview.astro`:
    1. Completion grid.
    2. `x-data="eliminationSection()"` holding ErrorAlert and StatTileRow.
    3. One glass card, `x-show="card.rows.length"` and `x-cloak`. Its eyebrow is `card.rowTitle`, either "MATCH RATE BY BED" or "DART RESULTS". It holds a nested `x-data="{ get table() { return card.rows } }"` over `AimTable`, whose headers come from `card.rowHeaders`. If `AimTable` takes only static headers, render two cards, one per game, each with `x-show` on the game.
    4. `GameHeatmapSection`, then `GameSessionList`.

- [ ] **Step 1: Write failing tests.**
  - 30d makes 2 `elimination` reads, both `bucket: "none"`, for game `KILLER`.
  - All Time makes 1 read.
  - A failed read sets `error`.
  - Registration lists `eliminationSection`.
  - `ELIMINATION_LAYOUTS` holds exactly the three rulesets and is disjoint from every other layout set, and `HEATMAP_ONLY_LAYOUTS` loses them.
- [ ] **Step 2: Run** `cd app && npx vitest run tests/lib/stats tests/lib/client/alpine/register-route-data.test.ts`. Expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command plus `npx astro check`. Expect PASS and 0/0/0.
- [ ] **Step 5: Screenshot.** Run `cd app && node scripts/screenshot-page.mjs /statistics <scratchpad>/elimination.png --click "501" --click "Killer"`. Read the PNG and confirm the order and that no tile shows NaN. Repeat for Prisoner.
- [ ] **Step 6: Commit** `feat(stats): elimination statistics layout`

### Task 6: Docs, decision, gates

**Files:**
- Create: `decisions/api/pending-elimination-statistics-page.md` from `decisions/TEMPLATE.md`. It records the section, the shared replay plumbing, the Global Constraints definitions and the layout.
- Modify: `docs/architecture/10-Statistics/01-Section-Catalog.md`. Bump the minor version, add an `elimination` section row, add it to the three game rows, and add a layout paragraph. Rename `findMarksFoldRows` wherever it is cited.
- Modify: `docs/architecture/10-Statistics/00-Overview.md`, only where it lists server sections or what reads `v_game_replay`.
- Modify: the File Inventory rows (new files, and the renamed and moved code), the component inventory, and a context-map history entry.

- [ ] **Step 1:** Make the targeted doc edits.
- [ ] **Step 2:** `cd app && npm run format && npm run format:check`. Expect clean.
- [ ] **Step 3:** Run the gates per `run-all-gates`: `npm test`, `npx astro check`, `check-test-coverage`, `check-type-barrels`, `check-dupes`, `check-doc-sync`, `check-context-budget`, `check-quality-benchmarks`, `check-decision-pending`. Expect each to pass.
- [ ] **Step 4: Commit** `docs(stats): elimination statistics page`
- [ ] **Step 5:** Run a fresh whole-branch review. Ask the owner about the design sync, then open the PR (`finishing-a-dart-branch`) and subscribe to it.
