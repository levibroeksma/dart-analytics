# Ace statistics page — design

Status: draft for owner approval · Date: 2026-11-17

## Intent

The VISIT_POINTS family is next after TRACK (D562). Of its games, Score Training already has its own page, Bull 500 is not playable yet, and Fives has no aimed target. That leaves Ace, which renders only the heatmap layout today. The owner wants the page to measure improvement over time: **less drifting and a higher target percentage, each compared with the period before.** Ace has a real target per round (drawn by the app from the session's `drawSeed`), but it is not stored per dart (`ace.engine.module.ts` `intent: () => NO_INTENT`), so today no per-target section can run for it.

## Goals

- **Derived intent for Ace.** Add an `ACE` walker to `modules/stats/derived-aims.module.ts` so every owner dart gets the round's target as its aim, and give `ACE_V1` the `intent-derived` stats tag (`capabilities.ts` `STATS_TAGS`). `target-accuracy`, `miss-direction` and `loose-darts` then run for Ace with no new section id, migration or endpoint.
- **A dedicated Ace layout** over the page Period select, in this order:
  1. Completion tile (as on the other pages).
  2. **Three comparison tiles**, each showing the current period's value and its change against the preceding period of equal length:
     - **Target hit rate:** darts on the round's target ÷ all darts.
     - **Drift:** misses with a landing point split into Left, Right, High and Low shares (D561's sector mapping). The tile headline is the largest of the four shares and its direction, e.g. "Left 38%", with the change in that same direction's share.
     - **Near miss share:** near misses ÷ (near misses + loose darts), within `NEAR_MISS_MM` (20 mm, D560).
  3. **The targets card** from the Track page (`trackGamesCardSection`, tiles and sortable table) with Ace's key set: 1 to 20 plus the bull.
  4. The heatmap and the session list.

## Non-goals

- Fives (no aimed target; any guessed aim would measure the guess). It stays heatmap-only.
- Bull 500 (not shipped). Score Training (has its own page).
- Win rate, points per visit, ring mix, per-session trend charts.
- Opponent or bot darts: only the owner's darts count, as every section today.

## Anti-goals

- A change arrow from too few darts: a change shows only when both periods have at least `MIN_TARGET_SAMPLE` (30) darts in that tile's denominator; otherwise the tile shows the current value alone.
- A second copy of the sector, band, near-miss or Track card logic.
- A target that differs from the one the game drew: the walker must reproduce `aceTargetFor(drawSeed, round)` exactly.

## Data

- **Walker:** Ace seats throw one visit per round, so the owner's Nth visit in a session is round N (zero-based as `aceTargetFor` takes it). The aim key is `NUMBER:n` for a number target (any ring hits) and `BULL:25` for the bull (outer or inner hits), matching `aimPairFor`'s existing keys. A session whose snapshot lacks `drawSeed` or whose dart count mismatches is skipped, as the other walkers do.
- **Comparison:** each tile needs the current window and the preceding equal window. `miss-direction` is not bucketable, so use two un-bucketed reads per section (current and preceding), the 501 pattern (D558). All Time shows no change.
- **Table:** the Track card's three un-bucketed reads over the current window, unchanged.

## Constraints

- Layout switch: `ACE_V1` leaves `HEATMAP_ONLY_LAYOUTS` for a new layout set (or joins `TRACK_LAYOUTS` with an Ace-only tile row; builder's call), with a branch in `pages/statistics/index.astro`.
- Ace is multi-seat: the walker's fold must only see the owner's darts and their visit order, not the opponent's turns. Verify how `turnSequence` counts in `v_stats_dart_facts` for a two-seat session before fixing the round index.
- `trackRowKeys("ACE")` returns 1 to 20 plus the bull; `heatmap-targets.ts` gains Ace's picker list if the heatmap can then filter by target.
- Repo gates: test per changed runtime `.ts`, type-barrels, check-dupes, no inline comments, astro check 0/0/0, format, context-budget, quality ratchet (`mi_average` floor 91.0).
- Docs in the same change: `01-Section-Catalog.md` (Ace row and layout paragraph), `00-Overview.md` §3 if the intent-derived game list is named there, `00-File-Inventory.md`, component inventory, context-map history, a new decision in `decisions/` (next free id).
- The design sync (D524) question goes to the owner before the PR.

## Left to the builder

- File and factory names; whether the comparison tiles live in one section factory or three.
- Whether Ace reuses `TrackGamesStatsOverview.astro` with a slot or gets its own layout file.
- How the walker reaches the round index (a minimal fold over the Ace reducer vs a direct visit counter), as long as it reuses `aceTargetFor`.

## Marked as the author's calls

- Fives left out; Bull 500 deferred until it ships.
- "Less drifting" is measured as the largest directional miss share falling; the tile names the direction.
- Near miss share as the third tile (tighter misses are the other half of less drift).
- The 30-dart floor applies to the change, not to the current value.
- The bull is one row, `BULL:25`, since Ace scores both bull rings.
- The Track targets card is reused as is, below the comparison tiles.
