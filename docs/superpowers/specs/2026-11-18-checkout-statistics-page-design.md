# Checkout statistics page — design

Status: draft for owner approval · Date: 2026-11-18

## Intent

The CHECKOUT family is next after VISIT_POINTS (D563). Its two games, 121 and Ten Up One Down (TUOD), have no dedicated statistics page today:
- `121_V1` and `TUOD_V1` show only the heatmap layout.
- `121_V2`, the current 121, falls through to "Statistics for this game are being rebuilt".

The goal, as for Ace, is to **measure improvement over time.** The page shows four rates compared with the previous period, and three cards that show where finishes are won or lost.

The five server sections the page needs already exist and are tagged for both games: `ladder-progress`, `bust-rate`, `double-performance`, `checkout-path` and `checkout-rate`. Their client derivations (`ladderSummary`, `doubleRows`, `checkoutPathRemainings`, `pathsFor`) also exist, but only inside `stores/game-stats.store.ts`, and no component renders them. This change needs no new section id, migration or endpoint.

## Goals

A **dedicated Checkout layout** for `121_V1`, `121_V2` and `TUOD_V1`, over the page Period select, in this order:

1. **Completion tile**, as on the other pages.
2. **Four comparison tiles.** Each shows the current period's value and its change against the preceding period of equal length:
   - **Finish rate:** goes finished ÷ goes.
     - A go is one `ladder-progress` attempt: one round (up to 9 darts) in 121, one visit in TUOD.
     - The change is shown in percentage points.
   - **Highest target reached:** `ladder-progress` `maxTarget`. The change is shown in points, e.g. "+12 vs previous period".
   - **Recovery rate:** `recovered ÷ afterMiss`, i.e. finishes on the go straight after a failed go. The change is shown in percentage points.
   - **Bust rate:** busts ÷ visits that started at 180 or less (`bust-rate`). The change is shown in percentage points.
3. **Finish rate by target range.** A table in bands of 20 targets, from the game's start score (121 or 41) up to 170. Columns:
   - range (e.g. "41–60")
   - goes
   - finished
   - finish rate
4. **Double hit rate.** One row per finishing double (`double-performance`, via `hitRateRows`). Columns:
   - double
   - darts at it
   - hit rate
5. **Common routes.**
   - A picker of the targets `checkout-path` holds data for, highest first.
   - For the chosen target, the routes thrown (e.g. "T20 S11 D20"), most used first. Columns:
     - route
     - visits
     - finished
     - finish rate
6. The heatmap and the session list.

## Non-goals

- Win rate in 1v1, average darts per finish (needs new server work), per-session trend charts.
- The `checkout-rate` section on this page (finish rate per visit within three-dart reach). The Finish rate tile counts per go instead, which matches how each game is scored.
- Opponent or bot darts: only the owner's darts count, as in every section today.

## Anti-goals

- A change shown from too few goes. A change shows only when both periods have at least `MIN_TARGET_SAMPLE` (30) in that tile's denominator:
  - Finish rate and Highest target: goes.
  - Recovery rate: goes after a miss.
  - Bust rate: visits counted.
  
  Below that, the tile shows the current value alone. All Time shows no change.
- A second copy of the ladder banding, hit-rate rows or route logic. Reuse the store's existing derivations; move them to a module if needed.
- Mixing the two games: each ruleset's page reads its own game type only.

## Data

- **Comparison tiles:** two un-bucketed reads each of `ladder-progress` and `bust-rate`:
  - the current window (`heatmapWindow`)
  - the preceding window (`precedingWindow`, D563)
  
  This is the Ace pattern. All Time makes the current read only.
- **Cards:**
  - Over the current window: one read each of `ladder-progress` (shared with the tiles), `double-performance` and `checkout-path`.
  - `checkout-path` is not bucketable, so it is read un-bucketed.
- **Bands:** the store's `bandLadderTargets` uses `LADDER_BAND_SIZE = 10` from 0. This page uses 20, aligned to the game's start score:
  - 121: 121–140, 141–160, 161–170.
  - TUOD: 41–60, …, 161–170.
  - TUOD targets below 41 (the ladder can fall to 2) form one band, "2–40", shown first.
  - A band with no goes is not shown.
  - A band's rate shows only from `MIN_ROW_SAMPLE` (10) goes; smaller bands show their counts only.

## Constraints

- Layout switch: a new `CHECKOUT_LAYOUTS` set (`121_V1`, `121_V2`, `TUOD_V1`). Two ruleset changes:
  - `121_V1` and `TUOD_V1` leave `HEATMAP_ONLY_LAYOUTS`.
  - `121_V2` leaves the "being rebuilt" fallback.
  
  Add a branch in `pages/statistics/index.astro`, and add the set to that page's fallback exclusion.
- The start score for banding comes from the game type: 121 for `ONE_TWENTY_ONE`, 41 for `TUOD`. The TUOD start is fixed at 41 by both seeded presets.
- Reuse:
  - `StatTileRow.astro`
  - `latestCardLoad`
  - `precedingWindow` and `loadTargetInputsOver`'s span pattern
  - `formatRate` and `formatPointDelta`
  - the Ace tile detail copy: "+x pp vs previous period", "No comparison yet", "No earlier period", and "No goes yet" for an empty period
- Repo gates:
  - a test per changed runtime `.ts`
  - type-barrels, check-dupes, no inline comments
  - astro check 0/0/0, format
  - context-budget
  - quality ratchet (`mi_average` floor 91.0)
- Docs in the same change:
  - `01-Section-Catalog.md` (Checkout layout paragraph)
  - `00-File-Inventory.md`, the component inventory, the context-map history
  - a new decision in `decisions/api.md` (next free id)
- Before the PR, ask the owner whether to run the design sync (D524).

## Left to the builder

- File and factory names.
- Whether the tiles are one section factory or several.
- Whether the three cards are one component or three.
- Whether the store derivations move to a shared module or the new sections import them from where they live, as long as nothing is copied.
- Highest target change copy: "+12 vs previous period", using a plain signed integer.

## Marked as the author's calls

- 121 V1 and V2 share the layout. V2 differs only in duration modes.
- Finish rate uses `ladder-progress` attempts, not `checkout-rate` chances.
- Bands of 20, aligned to the start score, with TUOD's below-start targets in one band.
- `MIN_ROW_SAMPLE` (10) for a band's rate; `MIN_TARGET_SAMPLE` (30) for a tile's change.
- Highest target compares per period, not all-time best.
