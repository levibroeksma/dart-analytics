---
id: pending
status: accepted
date: 2026-11-26
origin: contemporaneous
original-date:
tags: [api, session]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Fives statistics page: a `fives` section replayed from `v_game_replay`

## Context and Problem Statement
Two VISIT_POINTS games still showed only the heatmap: Fives (`FIVES_V1`) and Bull 500 (`BULL_500_V1`). Bull 500 has an engine but no play route, so it records no sessions. Fives is a control game: a visit scores only when its total divides by 5, a dart off the board voids it, passing 51 busts it, and the first seat on exactly 51 wins at once, so the result depends on every seat's darts in play order. The owner asked to start with the visit points family and left the design to the author.

## Decision Drivers
* Improvement is read against the preceding period of equal length.
* Anti-goal: a visit, void, bust or points figure that differs from the game screen for the same session.
* Anti-goal: a second copy of Fives' rules.
* Anti-goal: a change shown from too few.
* Only sessions the requesting player owns are read.

## Considered Options
* Leave Fives on the heatmap layout.
* Fold Fives into the `elimination` section.
* A dedicated server section `fives` replayed through `foldFivesState` (chosen).

## Decision Outcome
Chosen option: "A new server section `fives` (`games: FIVES`, `requires: board`, bucketable, completed sessions only) reads `v_game_replay` for the owner's sessions in scope and replays each once through `foldFivesState`. Per bucket it emits, for the owner's one `PLAYER` seat: sessions, finished sessions, wins (a complete fold whose winning side is the owner's), and, copied from the owner seat, closed visits, scoring visits, voids, busts and fives points, plus visits in won sessions. "No five" is derived as visits less scoring visits, voids and busts. A session that does not decode, has no single `PLAYER` seat, has an unseated turn or whose fold throws is skipped and counted. Fives renders `FivesStatsOverview.astro` (`FIVES_LAYOUTS`, leaving `HEATMAP_ONLY_LAYOUTS`): the completion tile; Win rate (over finished games), Scoring visit rate (over visits), Points per visit and Visits per win (over wins) against the preceding period, a change from 30 in both periods' denominators and none for All Time; a VISIT OUTCOMES card (Scored, No five, Void, Bust: visits and share of visits); the heatmap and the session list. Bull 500 stays heatmap-only until it is playable.".

### Consequences
Shared helpers replace copies: `addCounts` (field-wise metrics sum) in `series.module.ts`, `ownerIn` in `replay.module.ts`, `compareMeasures` in `comparison-tile.ts`, and a generic `replayLoad(games, fold)` in `statistics.service.ts` now serve `marks`, `elimination` and `fives`. `10-Statistics/01-Section-Catalog.md` 1.17.0.

* Good, because no view or migration was needed, and every figure is the engine's own owner-seat field.
* Good, because one fold per session suffices (no per-prefix replay).
* Bad, because Visits per win reads as a plain change: `meanTile` has no lower-is-better direction, so a fall is not marked as an improvement.
* Neutral, because a visit both void and over 51 counts as a void (the kernel tests the void first), and the open visit of an unfinished session is not counted.

### Confidence
High — every visit figure is read off `foldFivesState`'s owner seat.

### Revisit When
Bull 500 gets a play route, Fives gains a DartBot, or tiles gain a lower-is-better direction.

### Confirmation
`app/tests/modules/stats/sections/fives.module.test.ts` covers scoring and no-five visits, a win with its closing visit, a bust, a void, a void past 51, a loss, an open visit and skipped sessions. `app/tests/lib/stats/fives/` and `fives-section.data.test.ts` cover the tiles, floors, outcome rows and Alpine scope; `constants.test.ts` asserts `FIVES_LAYOUTS`.

## Pros and Cons of the Options
### Leave Fives on the heatmap layout
* Bad, because improvement cannot be read.

### Fold Fives into `elimination`
* Bad, because Fives is not an elimination game; its metrics would widen every elimination bucket with fields zero for the other games.

### A dedicated `fives` section
* Good, because the metrics are flat and exactly Fives' own seat fields.
* Bad, because one more section and layout to maintain.

## Evidence / More Information
Decided: 2026-11-26

* `docs/superpowers/specs/2026-11-26-fives-statistics-page-design.md`: design (owner: "start with visit points", then "continue on your own judgement", 2026-11-26).
* `docs/superpowers/plans/2026-11-26-fives-statistics-page.md`: plan, executed natively.
