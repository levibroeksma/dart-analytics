# Marks Statistics Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/statistics` layout for Cricket, Tactics and Mickey Mouse, built on a new server section `marks`. It shows:
- marks per round, darts to close out, wasted darts and win rate against the previous period
- marks by objective, ring mix and points per round

**Architecture:**
- A pure fold module replays each session through the game's own `foldMarks` rules and emits `MarksMetrics` per bucket.
- A repository read serves every participant's darts from `v_game_replay` for the sessions `v_stats_session_facts` selects.
- Client code: one Alpine scope (two un-bucketed reads, Ace/Checkout pattern) feeds the tiles and cards of `MarksStatsOverview.astro`.
- No migration.

**Tech Stack:** Astro, Alpine.js, TypeScript, Drizzle (repository reads), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-20-marks-statistics-page-design.md`

## Global Constraints

- Rulesets: `CRICKET_V1`, `CRICKET_V2`, `TACTICS_V1`, `TACTICS_V2`, `MICKEY_MOUSE_V1`. Game types: `CRICKET`, `TACTICS`, `MICKEY_MOUSE`.
- Marks per round = `effectiveMarks` ÷ `dartsThrown` × 3, summed over sessions. Use the `marks-close.module.ts` definitions; never re-derive marks from rings.
- Wasted dart: an owner dart after which the owner seat's `effectiveMarks` and `points` are both unchanged.
- Close-out: an owner seat with every objective at 3 marks. Its darts are `max(closedAtDart)`.
- Win: a completed two-seat session whose `winnerParticipantRef` is the owner's seat.
- Floors:
  - A tile's change needs `MIN_TARGET_SAMPLE` (30) in both periods' denominators: darts, close-outs, finished 1v1 games, or 1v1 darts.
  - A table row's rate needs `MIN_ROW_SAMPLE` (10).
  - All Time shows "No earlier period".
- Owner scoping: only sessions of the requesting `player_id`. Only owner darts count toward metrics; opponent darts feed the fold only.
- No inline comments in `app/src/**` function bodies.
- Tests go under `app/tests/` mirroring `src/`, one per changed runtime `.ts`.
- Gates: `npm test`, `npx astro check` 0/0/0, `npm run format:check`, `run-all-gates` scripts, quality ratchet.

## Review Focus

1. **1v1 points:** a dart's points depend on the opponent's marks at that moment. The fold must interleave both seats in play order, `(stageOrder, turnSequence, dartNumber)`. Pinned in Task 1 with a duel where the owner scores only after the opponent opened a number.
2. **Mickey Mouse double-dip:** one dart marks two objectives. Marks per round, objective marks and the "not wasted" result must all reflect both marks. Pinned in Task 1.
3. **Sessions that cannot replay:** an undecodable snapshot, a turn whose participant holds no seat, or an engine throw. The session is skipped and counted in `skippedSessions`, never thrown. Pinned in Task 1.
4. **Solo-only period:** Win rate shows "Solo games only", and Points per round is hidden, not shown as 0. Pinned in Tasks 3 and 4.
5. **Abandoned sessions:** never read (`includesAbandoned: false`). A close-out counts only from completed sessions. Pinned in Task 2's scope test.

---

### Task 1: `marks` fold module

**Files:**
- Create: `app/src/modules/stats/sections/marks.module.ts`
- Modify: `app/src/modules/stats/types.ts` (add `MarksMetrics` and `MarksSession`)
- Test: `app/tests/modules/stats/sections/marks.module.test.ts`

**Interfaces:**
- Produces:
  - `type MarksSession = { sessionId: string; gameTypeKey: "CRICKET" | "TACTICS" | "MICKEY_MOUSE"; bucketStart: string; bucketEnd: string; seats: readonly SeatFact[]; ownerRef: string; facts: EngineFacts }`
  - `type MarksMetrics = { darts: number; marks: number; wasted: number; rings: { single: number; double: number; treble: number }; objectives: Record<string, { marks: number; darts: number }>; closeOuts: { games: number; darts: number }; duel: { games: number; wins: number; darts: number; points: number } }`
  - Objective keys:
    - a number as `String(n)`
    - the bull as `"BULL"`
    - `"DOUBLES"` and `"TRIPLES"` as the engines name them
    - in the order of `CRICKET_OBJECTIVES`, `TACTICS_OBJECTIVES` or `MICKEY_MOUSE_OBJECTIVES`
  - `marksSessionMetrics(session: MarksSession): MarksMetrics`
    - Folds through `foldMarks(facts, seats, RULES_BY_GAME[gameTypeKey])` once per owner dart prefix to get the per-dart deltas. That is O(n²) per session, which is fine at well under 200 darts.
    - Ring of a marking dart (one that added at least one effective mark):
      - `INNER_SINGLE`, `OUTER_SINGLE` and `OUTER_BULL` count as single.
      - `DOUBLE` and `INNER_BULL` count as double.
      - `TREBLE` counts as treble.
    - Objectives: `marks` is the final seat's `marks[i]`, and `darts` its `objectiveHits[i]`.
    - Duel fields are filled only when `seats.length === 2`.
  - `marksBuckets(sessions: readonly MarksSession[], ctx: ShapeContext): SeriesBucket<MarksMetrics>[]`
    - One bucket per `(bucketStart, bucketEnd)`, summed. `sampleSize` is the number of sessions.
    - A session whose fold throws is skipped.
  - `RULES_BY_GAME` is exported with `CRICKET_RULES`, `TACTICS_RULES` and `MICKEY_MOUSE_RULES`. Export `TACTICS_RULES` and `MICKEY_MOUSE_RULES` from their engines if they are not already exported.

- [ ] **Step 1: Write failing tests.** Build facts with the existing test fact helpers (see `tests/modules/game/cricket.engine.module.test.ts`). Cover:
  - **Solo Cricket:** 3 visits of T20, T19, T18, then misses. Expect `marks` 9 over 9 darts (marks per round 3.00), `wasted` 6, `rings.treble` 3, and `objectives["20"]` `{ marks: 3, darts: 1 }`.
  - **Closed number:** a dart on an already-closed 20 in solo is wasted.
  - **Close-out:** a full solo close-out gives `closeOuts { games: 1, darts: <the closing dart's number> }`.
  - **Cricket V2 duel:** the owner's T20 after closing 20 scores 60 points while the opponent has 20 open. That dart is not wasted. Expect `duel.points` 60, and `duel.wins` 1 when the owner wins.
  - **Mickey Mouse:** one D20 marks 20 and DOUBLES. Marks rise by 2 and the dart is not wasted.
  - **Unreplayable session:** a turn whose participant holds no seat is skipped. `marksBuckets` emits no bucket for it and does not throw.
- [ ] **Step 2: Run** `cd app && npx vitest run tests/modules/stats/sections/marks.module.test.ts`. Expect FAIL (module missing).
- [ ] **Step 3: Implement.** Re-export `MarksMetrics` through the barrels as the type-barrels gate requires.
- [ ] **Step 4: Run** the same command. Expect PASS.
- [ ] **Step 5: Commit** `feat(stats): marks section fold`

### Task 2: Register, load and serve `marks`

**Files:**
- Modify: `app/src/lib/stats/types.ts`. Add `"marks"` to `SectionId` and the server metrics map.
- Modify: `app/src/lib/stats/section-registry.ts`. Add `marks: { id: "marks", version: 1, requires: ["board"], games: ["CRICKET", "TACTICS", "MICKEY_MOUSE"], computeSite: "server", bucketable: true, includesAbandoned: false, configSensitive: [], params: [] }`.
- Modify: `app/src/lib/stats/merge-metrics.ts`. Add `mergeMarks`, a field-wise sum of every count and every objective entry.
- Modify: `app/src/pages/api/statistics/types.ts`. Add the zod metrics schema for `marks`, following the `shanghai-count` entry.
- Modify: `app/src/repositories/statistics.repository.ts`. Add `findMarksFoldRows(db, q: SessionScope & { bucket: Bucket; tz: string | undefined }): Promise<MarksFoldRow[]>`.
  - It returns every `v_game_replay` dart row (all participants) of the sessions `sessionScopeWhere(q)` selects on `v_stats_session_facts`, joined by `session_id` and filtered by `v_game_replay.player_id = q.playerId`.
  - It carries the bucket window, `configuration`, `ruleset_version_key`, `stage_id`, `turn_sequence`, `participant_id`, `dart_number`, `hit_target_number`, `hit_zone_key` and `kept`.
  - It is ordered by session, stage, turn and dart.
- Modify: `app/src/services/statistics.service.ts`.
  - Add `marksLoad(db, ctx)`. It groups rows into `MarksSession`s: the seats come from the decoded snapshot (`seatedSnapshot` logic; reuse `replay-fold.ts` exports or export the needed helper), only kept turns are folded (as the replay does), and the owner ref is the seat whose participant is the requester's own.
  - Add `HANDLERS.marks = { server: { load: marksLoad, shape: marksBuckets } }`. Undecodable sessions add to `skippedSessions`.
- Test:
  - `app/tests/lib/stats/section-registry.test.ts`: `marks` is in `sectionsForGame("CRICKET" | "TACTICS" | "MICKEY_MOUSE")` and in no other game's set.
  - `app/tests/lib/stats/merge-metrics.test.ts`: two buckets sum.
  - `app/tests/services/statistics.service.test.ts`: the repository is mocked. Assert:
    - grouping into sessions with both seats
    - the owner ref
    - a non-kept turn is dropped
    - an unseated participant is skipped and counted
  - `app/tests/repositories/statistics.repository.test.ts`: the query shape, following the existing repository tests. It reads `v_game_replay`, is scoped by `player_id`, and selects completed sessions only.
  - `app/tests/integration/statistics-sql.itest.ts`: the sweep now resolves `marks`. Run it only where `DATABASE_URL` or `scripts/local-pg.sh` is available, and note it in the PR if not run.

- [ ] **Step 1: Write failing tests** (above).
- [ ] **Step 2: Run** `cd app && npx vitest run tests/lib/stats tests/services/statistics.service.test.ts tests/repositories`. Expect FAIL.
- [ ] **Step 3: Implement.** Find how the owner's participant is identified on a seat via `session-seats.service.ts` and the replay route. Do not guess the side key.
- [ ] **Step 4: Run** the same command plus `npx astro check`. Expect PASS and 0/0/0.
- [ ] **Step 5: Commit** `feat(stats): serve the marks section`

### Task 3: Client derivations

**Files:**
- Create: `app/src/lib/stats/marks/types.ts`. It is raised through `lib/stats/types.ts`.
- Create: `app/src/lib/stats/marks/marks-comparison.ts`
- Create: `app/src/lib/stats/marks/marks-comparison-lines.ts`
- Create: `app/src/lib/stats/marks/marks-cards.ts`
- Test: `app/tests/lib/stats/marks/*.test.ts`

**Interfaces:**
- Consumes: `MarksMetrics` (Task 1), `ratioTile`, `AceMeasure`, `Ratio`, `formatRate`, `MIN_TARGET_SAMPLE`, `MIN_ROW_SAMPLE`.
- Produces:
  - `type MeanMeasure = { current: Ratio; previous: Ratio | null }`. A ratio rendered as a mean (`part / whole`), not as a percent.
  - `type MarksComparison = { mpr: MeanMeasure; close: MeanMeasure; wasted: AceMeasure; wins: AceMeasure; ppr: MeanMeasure }`
    - `mpr`: marks × 3 over darts.
    - `close`: close-out darts over close-out games.
    - `wasted`: wasted over darts.
    - `wins`: wins over duel games.
    - `ppr`: points × 3 over duel darts.
  - `sumMarks(buckets: readonly SeriesBucket<MarksMetrics>[]): MarksMetrics`
  - `marksComparison(current: MarksMetrics, previous: MarksMetrics | null): MarksComparison`
  - `marksComparisonTiles(c: MarksComparison): TrackTile[]`. Four tiles:
    - "Marks per round": value `part/whole` to 2 decimals.
    - "Darts to close out": 1 decimal.
    - "Wasted darts": percent, via `ratioTile`.
    - "Win rate": percent. Value "—" and detail "Solo games only" when the current duel games are 0.
    - Mean tiles show their change with a sign and the tile's decimals (e.g. "+0.12 vs previous period", "±0.0 …"), under the same floor and earlier-period rules as `ratioTile`. Empty text: "No darts yet" or "No close-outs yet".
  - `pointsTiles(c: MarksComparison): TrackTile[]`. Empty when the current duel darts are 0. Otherwise one "Points per round" tile, 1 decimal, with its change.
  - `objectiveRows(m: MarksMetrics): AimTableRow[]`: one row per objective key in the metrics' insertion order. Label: the number, "Bull", "Doubles" or "Triples". `count` is darts, cells are `[String(marks)]`.
  - `ringRows(m: MarksMetrics): AimTableRow[]`: rows "Single", "Double" and "Treble". `count` is the ring count, cells are `[formatRate(share)]`, and the share shows from `MIN_ROW_SAMPLE` marking darts in total.

- [ ] **Step 1: Write failing tests.**
  - `mpr` 9 marks over 9 darts gives "3.00".
  - Floors: 29 darts gives "No comparison yet". A previous of 2.40 against 2.52 gives "+0.12 vs previous period".
  - Review Focus 4: zero duel games gives "Solo games only", and `pointsTiles` gives `[]`.
  - The objective row label for `BULL` is "Bull", and the order follows the keys.
  - Ring share is withheld below 10.
- [ ] **Step 2: Run** `cd app && npx vitest run tests/lib/stats/marks`. Expect FAIL.
- [ ] **Step 3: Implement.** Share the signed mean formatting through one helper; do not copy `ratioTile`'s floor logic. If needed, extract a `changeAllowed(current, previous)` helper into `comparison-tile.ts`.
- [ ] **Step 4: Run** the same command. Expect PASS.
- [ ] **Step 5: Commit** `feat(stats): marks comparison and card rows`

### Task 4: Section factory and layout

**Files:**
- Create: `app/src/lib/stats/sections/marks-section.data.ts` (`marksSection()`)
- Create: `app/src/components/layout/games/statistics/MarksStatsOverview.astro`
- Modify: `app/src/lib/client/alpine/register-route-data.ts`
- Modify: `app/src/lib/stats/constants.ts`. Add `MARKS_LAYOUTS` with the five rulesets, and remove them from `HEATMAP_ONLY_LAYOUTS`.
- Modify: `app/src/pages/statistics/index.astro`. Add the branch and the fallback exclusion.
- Test: `app/tests/lib/stats/sections/marks-section.data.test.ts`, `app/tests/lib/client/alpine/register-route-data.test.ts`, `app/tests/lib/stats/constants.test.ts`

**Interfaces:**
- Consumes: `comparisonSection`, `periodComparison` (`comparison-section.ts`), `loadGameSection`, and Task 3.
- Produces: `marksSection()`.
  - Built as `comparisonSection(periodComparison(readMarks, build, EMPTY), EMPTY, (card) => marksComparisonTiles(card.comparison))`, plus getters:
    - `points`: `pointsTiles`
    - `objectives`: `objectiveRows(card.current)`
    - `rings`: `ringRows(card.current)`
  - The card is `{ comparison: MarksComparison; current: MarksMetrics }`.
  - `readMarks` makes one un-bucketed `marks` read per span, so 2 reads, or 1 for All Time.
  - Layout:
    1. Completion grid.
    2. `x-data="marksSection()"` holding ErrorAlert and StatTileRow.
    3. Glass cards "OBJECTIVES" (headers `["Objective", "Marks"]`) and "RING MIX" (headers `["Ring", "Share"]`), each with a nested `x-data="{ get table() { return … } }"` over `AimTable`.
    4. A nested `x-data="{ get tiles() { return points } }"` StatTileRow with `x-show="points.length"`.
    5. `GameHeatmapSection`, then `GameSessionList`.

- [ ] **Step 1: Write failing tests.**
  - 30d makes 2 `marks` reads, both `bucket: "none"`, for game `CRICKET` when the ruleset is `CRICKET_V2`.
  - All Time makes 1 read.
  - A failed read sets `error`.
  - Registration lists `marksSection`.
  - `MARKS_LAYOUTS` holds exactly the five rulesets and is disjoint from every other layout set, and `HEATMAP_ONLY_LAYOUTS` loses them.
- [ ] **Step 2: Run** `cd app && npx vitest run tests/lib/stats tests/lib/client/alpine/register-route-data.test.ts`. Expect FAIL.
- [ ] **Step 3: Implement** the factory, the constants, the component and the page branch.
- [ ] **Step 4: Run** the same command plus `npx astro check`. Expect PASS and 0/0/0.
- [ ] **Step 5: Screenshot.** Run `cd app && node scripts/screenshot-page.mjs /statistics <scratchpad>/marks.png --click "501" --click "Cricket"`. Read the PNG and confirm the order and that no tile shows NaN.
- [ ] **Step 6: Commit** `feat(stats): marks statistics layout`

### Task 5: Docs, decision, gates

**Files:**
- Create: `decisions/api/pending-marks-statistics-page.md` from `decisions/TEMPLATE.md`, cited `[pending:marks-statistics-page]`. It records the `marks` section, the `v_game_replay` read in place of a migration, the definitions in the Global Constraints, and the layout.
- Modify: `docs/architecture/10-Statistics/01-Section-Catalog.md`. Bump the minor version, add a `marks` section row, add `marks` to the Cricket, Tactics and Mickey Mouse game rows, and add a layout paragraph.
- Modify: `docs/architecture/10-Statistics/00-Overview.md`, only where it lists server sections or what reads `v_game_replay`.
- Modify: `docs/game-rules/rulesets/cricket.md` and `tactics.md`. Mark the statistics rows shipped, noting that no view or migration was needed. These are non-canonical rule notes; this is a minimal row edit.
- Modify: File Inventory rows, the component inventory, and a context-map history entry.

- [ ] **Step 1:** Make the doc edits as targeted edits.
- [ ] **Step 2:** `cd app && npm run format && npm run format:check`. Expect clean.
- [ ] **Step 3:** Run the gates per `run-all-gates`: `npm test`, `npx astro check`, `check-test-coverage`, `check-type-barrels`, `check-dupes`, `check-doc-sync`, `check-context-budget`, `check-quality-benchmarks` (`--update` only when a benchmark improved), and `check-decision-ids`. Expect each to report OK or pass.
- [ ] **Step 4: Commit** `docs(stats): marks statistics page`
- [ ] **Step 5:** Run a fresh whole-branch review. Ask the owner about the design sync, then open the PR (`finishing-a-dart-branch`) and subscribe to it.
