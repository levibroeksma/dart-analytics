# Ace Statistics Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Ace a statistics page that shows whether target accuracy and drift improve against the preceding period, plus the Track targets table.

**Architecture:** An `ACE` walker in `derived-aims.module.ts` recovers each owner dart's aim (the round's drawn target), and `ACE_V1` gains the `intent-derived` tag, so the existing `target-accuracy`, `miss-direction` and `loose-darts` sections serve Ace. A pure comparison module sums those sections over the current and preceding window into three tiles. A new `AceStatsOverview.astro` composes the completion tile, the comparison tiles, the Track targets card (extracted from `TrackGamesStatsOverview.astro`), the heatmap and the session list.

**Tech Stack:** Astro, Alpine.js, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-17-ace-statistics-page-design.md`

## Global Constraints

- Owner darts only; no new section id, migration or endpoint.
- Aim keys: `NUMBER:n` (any ring of n hits) for a number target, `BULL:25` (outer or inner bull hits) for the bull.
- Round of the owner's dart i (zero-based, in `(turnSequence, dartNumber)` order) is `Math.floor(i / 3)`; its target is `aceTargetFor(drawSeed, round)`.
- Change shown only when both periods have at least `MIN_TARGET_SAMPLE` (30) in that tile's denominator; current value always shown; All Time shows no change.
- Drift sectors as D561: 5, 6, 7 left; 1, 2, 3 right; 0 high; 4 low. Near miss within `NEAR_MISS_MM` (20).
- Repo gates: test per changed runtime `.ts`, type-barrels (`@lib/types`), check-dupes, no inline comments, astro check 0/0/0, `npm run format`, context-budget, quality ratchet (`mi_average` ≥ 91.0).
- Decision id: D563.

## Review Focus

1. Two-seat Ace session: the opponent's turns must not shift the owner's round index — the view keeps owner darts only (`v_stats_dart_facts` `p.player_id = es.player_id`), so rank by owner dart order, never by raw `turnSequence` value (Task 1 test with gapped `turnSequence` 1, 3, 5).
2. An abandoned session with a partial last visit (e.g. 4 darts): rounds 0 and 1, no skip (Task 1).
3. A snapshot without `drawSeed` that fails `snapshotOf`: session skipped, not guessed (Task 1, existing skip path; assert `skippedSessions`).
4. Previous period with zero darts or All Time: tiles show the current value and a "no comparison" detail, no `NaN`/`Infinity` (Task 2).
5. Drift tie between directions: deterministic pick in the order Left, Right, High, Low (Task 2).

---

### Task 1: Derived intent for Ace

**Files:**
- Modify: `app/src/modules/stats/derived-aims.module.ts` (WALKERS, `DerivedGame`, `derivedGameOf`, `activeTargetFor`)
- Modify: `app/src/lib/game/rulesets/capabilities.ts` (`STATS_TAGS.ACE_V1`)
- Modify: `app/src/lib/stats/heatmap-targets.ts` (`HEATMAP_TARGET_GAMES`, `DERIVED_KEYS`)
- Test: `app/tests/modules/stats/derived-aims.module.test.ts`, the capabilities test, `app/tests/lib/stats/heatmap-targets.test.ts`

**Interfaces:**
- Produces: `aimedDarts` returns Ace aims; `trackRowKeys("ACE")` = 20 `NUMBER:n` + `BULL:25`; `heatmapTargetOptions("ACE")` has 22 options.

- [ ] **Step 1: Failing tests**
  - `sessionSteps` + `aimedDarts` on an `ACE_V1` session (`configuration` with a fixed `drawSeed`, `rounds`) of 7 owner darts with `turnSequence` 1,1,1,3,3,3,5: aims equal the key of `aceTargetFor(seed, 0)` ×3, `(seed, 1)` ×3, `(seed, 2)` ×1.
  - Hit: a seed whose round 0 is the bull; `OUTER_BULL` and `INNER_BULL` both `hit: true`, `SINGLE` 25-adjacent miss `false`. A number round: `TREBLE` of n hit, n+1 miss.
  - Configuration that `snapshotOf` rejects: `skippedSessions === 1`.
  - `STATS_TAGS.ACE_V1` equals `["board", "intent-derived"]`.
  - `trackRowKeys("ACE")` size 21, has `BULL:25`; `heatmapTargetOptions("ACE")[0].label === "All targets"`.
- [ ] **Step 2:** `cd app && npx vitest run tests/modules/stats/derived-aims.module.test.ts tests/lib/stats/heatmap-targets.test.ts` → new tests FAIL.
- [ ] **Step 3: Implement**
  - Walker `ACE(config, darts)`: `foldSeatSteps(darts, { darts: 0 }, (s) => ({ darts: s.darts + 1 }))`.
  - `DerivedGame` adds `"ACE"`; `derivedGameOf` maps `ACE_` prefix.
  - `activeTargetFor` for ACE: `aceTargetFor(config.drawSeed, Math.floor(before.darts / 3))` → `{ kind: "BULL" }` when it equals `BULL_TARGET_NUMBER`, else `{ kind: "NUMBER", number }`. `aimPairFor` needs no change.
  - Tag and key lists as above; update the `STATS_TAGS` doc comment only if it lists derived games.
- [ ] **Step 4:** Same command → PASS; then `npm test` green.
- [ ] **Step 5:** Server check: find the existing test that runs `target-accuracy` (or `miss-direction`) through the derived server path for Shanghai or Singles; add an Ace case asserting one aimed hit and one miss. If the section's game gate rejects Ace, fix the gate in this task.
- [ ] **Step 6: Commit** `feat(stats): derive Ace aims from the round draw`

### Task 2: Comparison logic and tile lines

**Files:**
- Create: `app/src/lib/stats/ace/types.ts` (raised via `lib/stats/types.ts`), `app/src/lib/stats/ace/ace-comparison.ts`, `app/src/lib/stats/ace/ace-comparison-lines.ts`
- Test: `app/tests/lib/stats/ace/ace-comparison.test.ts`, `app/tests/lib/stats/ace/ace-comparison-lines.test.ts`

**Interfaces:**
- Consumes: `tallyDoublesTraining(input, keys)` and `DoublesTrainingInput`, `DoublesTrainingRow`.
- Produces:
  - `type Ratio = { part: number; whole: number }`
  - `type AceComparison = { hit: { current: Ratio; previous: Ratio | null }; drift: { direction: "Left" | "Right" | "High" | "Low" | null; current: Ratio; previous: Ratio | null }; near: { current: Ratio; previous: Ratio | null } }`
  - `aceComparison(current: DoublesTrainingInput, previous: DoublesTrainingInput | null, keys: ReadonlySet<string>): AceComparison`
  - `aceComparisonTiles(comparison: AceComparison): TrackTile[]` — titles "Target hit rate", "Drift", "Near miss share".

- [ ] **Step 1: Failing tests** (`ace-comparison.test.ts`)
  - hit: rows summing 40 darts / 16 hits now, 50 / 15 before → `current {16,40}`, `previous {15,50}`.
  - drift: current left 12, right 5, high 2, low 1 → direction "Left", `current {12,20}`; previous left 9 of 30 directional → `previous {9,30}` (same direction's share, not previous's own largest).
  - drift tie left 5 / right 5 → "Left"; no directional misses → direction `null`.
  - near: nearMiss 18, loose 12 → `{18,30}`.
  - `previous === null` → every `previous` null.
- [ ] **Step 2: Failing tests** (`ace-comparison-lines.test.ts`)
  - Value as one-decimal percent ("40.0%"; drift "Left 60.0%"); whole 0 → value "—", detail "No darts yet".
  - Both wholes ≥ 30 → detail `"+3.2 pts vs previous period"` / `"−3.2 pts …"` (U+2212), `"No change vs previous period"` at 0.0.
  - Either whole < 30 or previous null → detail `"No comparison yet"`.
- [ ] **Step 3:** run both test files → FAIL.
- [ ] **Step 4: Implement.** Sum all rows; drift denominator `left + right + high + low`; reuse a percent formatter if `lib/stats` has one (grep before writing).
- [ ] **Step 5:** run → PASS; `npm test` green.
- [ ] **Step 6: Commit** `feat(stats): Ace period comparison tiles`

### Task 3: Fetch and section factory

**Files:**
- Modify: `app/src/lib/stats/doubles/doubles-training-fetch.ts` (span-taking loader)
- Create: `app/src/lib/stats/sections/ace-comparison.data.ts`; register in `register-route-data.ts`
- Test: `app/tests/lib/stats/doubles/doubles-training-fetch.test.ts`, `app/tests/lib/stats/sections/ace-comparison.data.test.ts`, `register-route-data.test.ts`

**Interfaces:**
- Produces: `loadTargetInputsOver(gameTypeKey, span: { from: string; to: string }): Promise<DoublesTrainingInput>`; `loadTargetInputs` delegates to it with `heatmapWindow`. `aceComparisonSection()` Alpine scope: `loading`, `error`, `tiles` (getter, empty-value tiles while loading), `init`, `load: latestCardLoad(fetchAceComparison)`.

- [ ] **Step 1: Failing tests**
  - Fetch: `loadTargetInputsOver` sends `bucket: "none"` and the given `from`/`to` to all three sections.
  - Data: with mocked `loadGameSection`, "30d" issues reads over `trendWindow`'s `boundary..to` and `from..boundary` (6 calls); "all" (boundary null) issues 3 calls and previous is null; a rejected read sets `error` and leaves zero tiles' values; a stale response is dropped (existing `latestCardLoad` pattern test).
  - Registry: `aceComparisonSection` registered.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement** — split exactly as `fetchOverviewSections` does (`trendWindow(rangeKey, now, localTz())`); keys from `trackRowKeys(gameTypeKey)`.
- [ ] **Step 4:** run → PASS; `npm test` green; `bash scripts/check-dupes.sh` passes (extract a shared span helper from `x01/overview-fetch.ts` if it flags the split).
- [ ] **Step 5: Commit** `feat(stats): load Ace comparison over two periods`

### Task 4: Layout and routing

**Files:**
- Create: `app/src/components/layout/games/statistics/StatTileRow.astro` (the tile `x-for` markup, prop `tilesExpr`), `TrackTargetsCard.astro` (Track tiles + sortable table + footer, its own `x-data="trackGamesCardSection()"`), `AceStatsOverview.astro`
- Modify: `TrackGamesStatsOverview.astro` (use both extracted parts; rendered output unchanged), `app/src/lib/stats/constants.ts` (`ACE_LAYOUTS = new Set(["ACE_V1"])`, remove from `HEATMAP_ONLY_LAYOUTS`), `app/src/pages/statistics/index.astro` (Ace branch; fallback excludes it)
- Test: `app/tests/lib/stats/constants.test.ts`

- [ ] **Step 1: Failing test:** `ACE_LAYOUTS` has `ACE_V1`; `HEATMAP_ONLY_LAYOUTS` does not; no ruleset sits in two layout sets.
- [ ] **Step 2:** run → FAIL. **Step 3:** implement constants, components, page branch. Order in `AceStatsOverview`: completion grid, `x-data="aceComparisonSection()"` with ErrorAlert + `StatTileRow`, `TrackTargetsCard`, `GameHeatmapSection`, `GameSessionList`.
- [ ] **Step 4:** `npm test`, `npx astro check` (0/0/0), `node scripts/screenshot-page.mjs /statistics …` for Ace and one Track game; Read both PNGs — Track unchanged, Ace shows tiles then the table.
- [ ] **Step 5: Commit** `feat(stats): Ace statistics layout`

### Task 5: Docs, gates, PR

- [ ] `01-Section-Catalog.md`: Ace row (target-accuracy, miss-direction, loose-darts, heatmap, completion) and layout paragraph; intent-derived game lists in `10-Statistics/00-Overview.md` §3 if named.
- [ ] `decisions/api.md`: append D563 (Ace derived aims; Ace layout; drift and near-share definitions; 30-dart change floor; Fives out).
- [ ] `00-File-Inventory.md` rows for new files and changed estimates; component inventory rows for `StatTileRow`, `TrackTargetsCard`, `AceStatsOverview`; context-map history bump.
- [ ] Run `run-all-gates` and `context-maintenance` skills; `cd app && npm run format && npm run format:check`.
- [ ] Fresh-subagent whole-branch review; fix findings RED→GREEN.
- [ ] Ask the owner the design-sync question (D524); push; open PR; `subscribe_pr_activity`.
