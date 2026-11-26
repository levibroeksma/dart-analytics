# Fives statistics page — design

Status: draft for owner approval · Date: 2026-11-26

## Intent

Elimination (D0569) completed the last kernel family's page. Two VISIT_POINTS games still show only the heatmap: Fives (`FIVES_V1`) and Bull 500 (`BULL_500_V1`). Bull 500 has an engine but no play route (`pages/games/` has no `bull-500`), so it records no sessions. This page is for **Fives** alone.

As on Ace, Checkout, Marks and Elimination, the page **measures improvement over time**: each figure is compared with the previous period. The owner said "start with visit points" and asked the author to decide the rest (2026-11-26). This document's calls are therefore the author's, listed at the end.

Fives is a control game. A visit scores only when its three-dart total divides by 5, scores nothing if a dart leaves the board (a void), and busts if it would pass 51. Winning depends on the opponent too: the first seat on exactly 51 wins at once, and later seats do not throw. So the section replays the whole session from `v_game_replay` through `foldFivesState`, as Elimination does. No migration is needed.

## Goals

- **A new server section, `fives`**, replaying each owner session through `foldFivesState` and reading the owner's seat off the final state. Per bucket it emits the owner's figures. **Units are stated per field.**
  - `games`: sessions.
  - `finished`: sessions whose fold is `COMPLETE`.
  - `wins`: finished sessions the owner's side won.
  - `visits`: the owner seat's closed visits (`seat.visits`). The open visit of an unfinished session is not counted.
  - `scoringVisits`: visits that booked fives points (`seat.scoringVisits`).
  - `voids`: visits voided by an off-board dart (`seat.voids`).
  - `busts`: visits that would have passed 51 (`seat.busts`).
  - `points`: fives points the owner booked (`seat.total`), summed over sessions.
  - `winVisits`: the owner's visits in sessions the owner won, summed.

  Every closed visit is exactly one of four outcomes: **scored** (`scoringVisits`), **void** (`voids`), **bust** (`busts`), or **no five**: a total that does not divide by 5, which is `visits − scoringVisits − voids − busts`. No field stores the fourth outcome; it is derived.
- **A dedicated Fives layout** over the page Period select, in this order:
  1. The completion tile.
  2. **Four comparison tiles.** Each shows the current period's value and its change against the preceding period of equal length:
     - **Win rate:** wins ÷ finished.
     - **Scoring visit rate:** scoringVisits ÷ visits.
     - **Points per visit:** points ÷ visits, in fives points.
     - **Visits per win:** winVisits ÷ wins, in visits. Lower is better. With no wins the tile shows "No wins".
  3. **A visit outcomes card** over the current period: one row each for Scored, No five, Void and Bust, in that order. Each row shows its visit count and its share of visits.
  4. The heatmap and the session list.

## Non-goals

- Bull 500. It stays in `HEATMAP_ONLY_LAYOUTS` until it has a play route; its page is a later task.
- Aim or per-target accuracy: Fives stores no intent, and any guessed aim would measure the guess (the Ace spec's reasoning, unchanged).
- Guest statistics. Opponent darts feed the fold only.
- Per-session trend charts, the finishing visit's darts, and the remainder of a no-five total (off by 1–4).
- DartBot: Fives offers none.

## Anti-goals

- A figure that differs from the game screen or results modal for the same session. Visits, voids, busts, scoring visits and the total must equal `foldFivesState`'s own owner-seat fields.
- A second copy of Fives' rules. The section calls `foldFivesState` and never re-derives `fivesPoints`, a void or a bust.
- A change shown from too few: a change shows only when both periods have at least `MIN_TARGET_SAMPLE` (30) in that tile's denominator. Below that the tile shows its current value alone. All Time shows no change.
- Reading another player's history: only sessions the owner played are read.

## Data

- **No migration.** The section reads `v_game_replay` for the sessions `v_stats_session_facts` selects in the request's scope, through the shared replay plumbing Elimination uses: `findReplayFoldRows`, `ownerSessions`, `foldOwnerSessions` and `foldedBuckets`. None of it is copied.
- **Owner seat:** the session's one `PLAYER` seat, as for Marks and Elimination. A session with no such seat, a snapshot that does not decode, or a turn whose participant holds no seat is skipped and counted in `skippedSessions`, never guessed.
- **One fold per session:** every field comes from the final folded state. No per-visit replay is needed, unlike Elimination.
- **Reads:** `fives` is bucketable, but the page makes two un-bucketed reads (the current and preceding windows) through `comparisonSection` and `periodComparison`. The card reads the current window.

## Constraints

- **Layout switch:** a new `FIVES_LAYOUTS` set holds `FIVES_V1`, which leaves `HEATMAP_ONLY_LAYOUTS`. `pages/statistics/index.astro` gets a branch, and its fall-through condition is extended.
- **Section registration:** `fives` in `section-registry.ts` with `games: ["FIVES"]`, `computeSite: "server"`, `bucketable: true`, `requires: ["board"]`, `includesAbandoned: false`, `configSensitive: []` and `params: []`.
- **Reuse:**
  - `StatTileRow.astro` and `AimTable.astro` (or the table component the Prisoner dart-results card uses).
  - `ratioTile`, `meanTile`, `comparisonSection`, `periodComparison`, `formatRate` and `formatPointDelta`.
  - The Elimination tile and card copy patterns.
  - A metrics sum that duplicates `addEliminationMetrics`'s field-wise `addDeep` is extracted to one shared helper, not cloned (check-dupes, D513).
- **Repo gates:**
  - A test per changed runtime `.ts`.
  - type-barrels, check-dupes, no inline comments.
  - astro check 0/0/0, format, context-budget.
  - The quality ratchet and the golden SQL snapshots.
- **Docs in the same change:**
  - `10-Statistics/01-Section-Catalog.md`: the section row, a Fives layout paragraph, and the game row.
  - `10-Statistics/00-Overview.md`, if it names the section list.
  - The File Inventory, the component inventory and the context-map history.
  - `docs/game-rules/rulesets/fives.md`, if it names statistics.
  - A pending decision record in `decisions/api/`.
- Ask the owner about the design sync (D524) before the PR.

## Left to the builder

- File and factory names.
- Whether the Fives layout is its own `.astro` file or shares the Elimination one through a slot.
- Whether "No five" is derived in the card's data function or added as a metrics field, provided the four outcomes always sum to `visits`.

## Marked as the author's calls

- **Scope:** Fives only; Bull 500 waits until it is playable.
- **Win rate** counts finished sessions only. Abandoned sessions are excluded section-wide.
- **Visits per win** sums visits from won sessions only, so a loss never inflates it.
- **Points per visit** uses booked points, so a bust or void counts as a visit that scored 0.
- **The four outcomes** split closed visits only. The open visit of an unfinished session is not counted.
- **The four tiles:** void and bust rates go on the outcomes card, not in tiles, because scoring rate and points per visit already fall when either rises.
