# Baseball statistics page — design

Status: author's design (owner: "start with the last kernel, skip the questions", 2026-11-26) · Date: 2026-11-26

## Intent

Baseball Darts (`BASEBALL_V1`, TRACK kernel) is the last playable game on the heatmap-only layout; Bull 500 has no play route. The Track games page left Baseball out because it had no target picker and no per-target sections (`2026-11-17-track-games-statistics-page-design.md` §Non-goals). Baseball has a real target per inning (inning n aims at number n), but the engine records no intent per dart (`NO_INTENT`). Deriving it, as Ace did (D563), lets Baseball join the Track games page with no new section, endpoint or migration.

## Goals

- **Derived intent.** A `BASEBALL` walker in `modules/stats/derived-aims.module.ts` folds the owner's darts through `applyBaseballDart`; each dart's aim is the seat's inning number before the dart, `NUMBER:n` (n = 1..9). `BASEBALL_V1` gains `intent-derived` and `target-sequence` (`capabilities.ts` `STATS_TAGS`), as Shanghai carries. `target-accuracy`, `confusion`, `miss-direction`, `loose-darts` and the target-filtered heatmap then run for Baseball.
- **Inning target exported once.** `activeTargetOf(seat: BaseballSeatState): BoardTarget` in `baseball.engine.module.ts`, the path target at the seat's `targetIndex`; the walker reads it, so the inning rule is not copied.
- **Picker and rows.** `heatmap-targets.ts`: `BASEBALL` joins `HEATMAP_TARGET_GAMES` with keys `NUMBER:1..9` (no bull; Baseball scores none there). `trackRowKeys("BASEBALL")` follows.
- **Layout.** `BASEBALL_V1` moves from `HEATMAP_ONLY_LAYOUTS` to `TRACK_LAYOUTS`: completion tile, Best target / Most failed / Weakest three, the sortable targets table, heatmap with picker, session list. `HEATMAP_ONLY_LAYOUTS` keeps `BULL_500_V1`.

## Rules

- Hit: any ring of the inning's number (`isAimHit` on `NUMBER:n`), as the engine's `anyRingEitherBull` counts it. A dart elsewhere, the bull included, is a miss on that inning's number.
- Multi-seat (1v1, V2): the walker sees only the owner's darts (`v_stats_dart_facts`), one visit per inning, so the owner's seat state alone fixes the inning, as for Ace.
- A session whose snapshot does not decode, whose dart count mismatches or whose fold throws (a dart after inning 9) is skipped, as for every walker.
- Floors, tie-breaks, sort toggle and miss columns: unchanged Track page rules (10 and 30 darts).

## Non-goals

- A runs card, runs-per-inning trend or period comparison. The Track page carries none; `session-result` already gives runs (`RESULT_DIRECTION.BASEBALL = "higher"`).
- Bull 500 (not playable). Nine Lives (`AROUND_THE_CLOCK_V3`) layout membership.

## Anti-goals

- A second copy of Baseball's inning or hit rule.
- A target row Baseball never aims at (10..20, bull).

## Constraints

- Docs: `01-Section-Catalog.md` (Baseball row and Track layout paragraph), `00-Overview.md` if it names the intent-derived games, `00-File-Inventory.md` where a row's description lists them, context-map history, a pending decision record.
- The design sync (D524) question goes to the owner before the PR; the owner said to skip questions, so it is skipped and stated in the PR.
