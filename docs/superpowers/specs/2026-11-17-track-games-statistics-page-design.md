# Track games statistics page — design

Status: draft for owner approval · Date: 2026-11-17

## Intent

Singles Training, Shanghai, Around the Clock and Bob's 27 walk a target path (the TRACK rule kernel) and render only the heatmap layout today (`HeatmapStatsOverview.astro`). The owner wants one shared page for them that answers: what is my hit rate per target, and which targets do I fail most. It reuses the Doubles Training page pattern (`DoublesTrainingStatsOverview.astro`, `lib/stats/doubles/`, shipped in #1343, D561) and the 20 mm near-miss rule (D560). Games in one kernel family share one page; the other families (MARKS, VISIT_POINTS, CHECKOUT, ELIMINATION) follow as separate projects.

## Goals

- One **layout** for `SINGLES_V1`, `SHANGHAI_V1`, `AROUND_THE_CLOCK_V1` and `BOBS27_V1`, over the page Period select: completion tile, summary tiles, the targets card, then the existing heatmap (with its target picker) and the session list.
- **Three summary tiles** above the table:
  - Best target: highest hit rate among targets with at least `MIN_TARGET_SAMPLE` (30) darts.
  - Most failed: lowest hit rate among the same qualifying targets.
  - Weakest three: the three lowest hit rates among the same targets, as a short list.
- **A targets table**, one row per target the game aims at, with the Doubles card columns: Hit, Left/Right, High/Low, In/Within/Out, Near/Loose. A **sort toggle** switches between target order and hit rate low to high.
- Rows per game: Singles and Around the Clock 1 to 20 plus the bull; Shanghai 1 to 20; Bob's 27 D1 to D20 plus the bull. Only targets with darts appear.
- Every number is derived at read time from the existing `target-accuracy`, `miss-direction` and `loose-darts` sections, joined by target key. No migration, endpoint or section id.

## Non-goals

- Baseball: it has no target picker and no per-target sections; it stays on the heatmap layout.
- The `training-result`, `confusion`, `grouping`, `volume` and game-specific cards (`bobs27-survival`, `shanghai-count`, `atc-darts-per-target`).
- Per-ring rows (single, double, treble of one number), per-session trends, comparison against a previous period.
- Other kernel families.

## Anti-goals

- A second copy of the sector, band or near-miss logic, or a second copy of the Doubles join: the table sums and joins what the three sections return.
- A rate shown from too few darts.
- A tie in sort order that reorders between renders.

## Data

Three un-bucketed requests over the page Period for the page's game, as the Doubles page does (`loadGameSection`, `heatmapWindow`, `bucket: "none"`, stale responses dropped): `target-accuracy` (attempts, hits per key), `miss-direction` (sector 0 to 7 and radial band per key), `loose-darts` (on target, near miss, loose per key). Metrics are keyed by `TargetKey`; the three games run on the `intent-derived` family (Singles, Shanghai, Around the Clock: keys `NUMBER:n` and `BULL:25`) or stored intent (Bob's 27: `DOUBLE:n` and `INNER_BULL:25`), as `heatmap-targets.ts` lists them.

## Card rules

- Hit rate: `hits / attempts`. A row under `MIN_ROW_SAMPLE` (10) darts shows its count only.
- Best, Most failed and Weakest three consider only rows with at least 30 darts. With no qualifying row each tile reads "Not enough darts yet". Weakest three lists fewer than three when fewer qualify.
- Ties on rate go to the row with more darts, then the lower number, for best and for weakest alike.
- Sort toggle: "Target" (path order: number order, bull last) and "Hit rate" (lowest first; rows under the 10-dart floor sort last). The table follows the toggle; the tiles do not.
- Left/Right, High/Low, In/Within/Out and Near/Loose use the same sector mapping and rules as the Doubles card (D561): sectors 5, 6, 7 left; 1, 2, 3 right; 0 high; 4 low; a miss without a landing point is in neither near nor loose.
- The footer states the dart count and the near-miss threshold.

## Constraints

- Layout switch: a new `TRACK_LAYOUTS` set in `constants.ts` holds the four ruleset versions; they leave `HEATMAP_ONLY_LAYOUTS`; `pages/statistics/index.astro` gets a branch and the fallback `x-if` excludes it.
- The Doubles derivation (`tallyDoublesTraining`, `doublesTrainingCard`) filters rows by a doubles-only key pattern. This is the second consumer, so generalise it behind a per-game key set rather than copy it (D513); the Doubles page behaviour and its tests stay unchanged.
- Reuse `AimCardSection`, `AimCard` and `AimTable` where they fit; the tiles are new markup.
- Repo gates: test per changed runtime `.ts`, type-barrels, check-dupes, no inline comments, astro check 0/0/0, format, context-budget and the quality ratchet (`mi_average` floor 91.0 after #1343; new `lib/stats/` files may trip it, so prefer extending the existing doubles modules over adding many).
- Docs in the same change: `01-Section-Catalog.md` (Singles, Shanghai, Around the Clock, Bob's 27 layout rows), `00-File-Inventory.md`, component inventory, context-map history, and a new decision in `decisions/` (next free id).
- The design sync (D524) question goes to the owner before the PR.

## Left to the builder

- File and factory names, and whether the Doubles modules move to a shared `lib/stats/` folder.
- Whether the tiles are one component or three, and the phone-width layout.
- Verifying the key shape each derived game returns before fixing the per-game key sets.

## Marked as the author's calls

- Baseball left out.
- "Most failed" is the lowest hit rate among rows with 30 or more darts, not the most missed darts.
- The 10 and 30 dart floors and the tie-break, taken from the Doubles page.
- The sort toggle applies to the table only, and the "Hit rate" sort puts rows under 10 darts last.
- The bull row for Singles and Around the Clock is `BULL:25`, labelled by `targetLabel`; Bob's 27 uses `INNER_BULL:25`, as on the Doubles page.
- One shared layout over four games, with the game's own target set, not per-game pages.
- Weakest three shows no row text beyond target and rate.
