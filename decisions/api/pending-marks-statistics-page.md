---
id: pending
status: accepted
date: 2026-11-20
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

# Marks statistics page: a `marks` section replayed from `v_game_replay`

## Context and Problem Statement
The owner wants improvement measured over time on the MARKS family: Cricket (`CRICKET_V1` solo, `CRICKET_V2` 1v1), Tactics (`TACTICS_V1`, `TACTICS_V2`) and Mickey Mouse (`MICKEY_MOUSE_V1`), which show only the heatmap. A dart's marks follow from where it landed under each game's own rules, but in 1v1 its points, and the winner, also depend on the opponent's marks at that dart. The `v_stats_*` views hold the owner's darts only; the game-rules notes for Cricket and Tactics assumed a new view and migration.

## Decision Drivers
* Improvement is read as more marks per round, fewer darts to close out, fewer wasted darts and more wins, each against the preceding period of equal length.
* Anti-goal: a mark count that differs from the game screen's for the same session.
* Anti-goal: a second copy of any game's marks rules.
* Anti-goal: a change shown from too few.
* Only sessions the requesting player owns are read.

## Considered Options
* Leave the games on the heatmap layout.
* A new `v_cricket_*` / `v_tactics_*` view with a migration.
* A server section that replays every participant's darts from the existing `v_game_replay` through the engines' own `foldMarks` (chosen).

## Decision Outcome
Chosen option: "A new server section `marks` (`games: CRICKET, TACTICS, MICKEY_MOUSE`, `requires: board`, bucketable, completed sessions only) reads `v_game_replay` (every participant's darts) for the sessions `v_stats_session_facts` selects in scope, filtered by the requesting `player_id`. Each session is replayed through `foldMarks` with `CRICKET_RULES`, `TACTICS_RULES` or `MICKEY_MOUSE_RULES`, once per dart prefix, and the owner seat (the session's one `PLAYER` seat) yields: darts, effective marks (capped at 3 per objective, as `marksPerRound` on the game screen), wasted darts (no effective mark and no points), effective marks by the ring of the dart that added them (single, double, treble), marks and landed darts per objective in the game's order, close-outs with the closing dart, and for two-seat sessions finished games, wins and points. A session that does not decode, has no single `PLAYER` seat, or whose fold throws is skipped and counted in `skippedSessions`. The five rulesets render `MarksStatsOverview.astro` (`MARKS_LAYOUTS`, leaving `HEATMAP_ONLY_LAYOUTS`): the completion tile; Marks per round, Darts to close out, Wasted darts and Win rate against the preceding period (a change from 30 in both periods' denominators: darts, close-outs, darts, finished 1v1 games; none for All Time; Win rate shows 'Solo games only' without a 1v1 game, 'No darts yet' with no darts); OBJECTIVES and RING MIX cards (a ring's share of effective marks, from 10 marks); a 1v1-only Points per round tile; the heatmap and the session list.".

### Consequences
`modules/stats/sections/marks.module.ts` holds the fold; `findMarksFoldRows` shares its `v_game_replay` columns and row mapping with `findStepFoldRows`; `groupBySession` and `sessionFactsOf` moved from `step-result.module.ts` into `replay.module.ts` for both folds. `meanTile` joins `ratioTile` in `lib/stats/sections/comparison-tile.ts`. `MICKEY_MOUSE_RULES` is now exported. `10-Statistics/01-Section-Catalog.md` 1.15.0.

* Good, because no view or migration was needed, and marks come from the engines' own rules.
* Good, because 1v1 points and wins match the game: both seats fold in play order.
* Bad, because each session folds once per dart (quadratic in its dart count), and 1v1 reads twice the darts the `MAX_FOLD_DARTS` gate counts, which counts the owner's darts only.
* Bad, because the four-tile row wraps three and one above the phone width, as on the Checkout page.
* Neutral, because Mickey Mouse's double-dip counts as the game counts it: a D20 adds two marks on 20 and one on Doubles.

### Confidence
High — every figure is read off the engines' own fold.

### Revisit When
A session's dart count makes the per-prefix fold slow, a 2v2 seat layout lands, or the owner wants darts to close per objective.

### Confirmation
`app/tests/modules/stats/sections/marks.module.test.ts` covers the fold (solo, closed number, close-out, duel points in play order, opponent closing first, the double-dip, unseated turns) and the row grouping. `app/tests/repositories/statistics-sql-golden.test.ts` pins `findMarksFoldRows`' SQL. `app/tests/lib/stats/marks/` and `marks-section.data.test.ts` cover the tiles, cards and Alpine scope; `constants.test.ts` asserts `MARKS_LAYOUTS`.

## Pros and Cons of the Options
### Leave the games on the heatmap layout
* Bad, because improvement cannot be read.

### A new view and migration
* Bad, because a view would restate the engines' marks rules in SQL, and `v_game_replay` already carries the opponent's darts.

### Replay `v_game_replay` through `foldMarks`
* Good, because the engines stay the single definition of a mark.
* Bad, because the fold runs per request rather than in SQL.

## Evidence / More Information
Decided: 2026-11-20

* `docs/superpowers/specs/2026-11-20-marks-statistics-page-design.md`: owner-approved design (owner chose the game-screen definition and no migration, 2026-11-20).
* `docs/superpowers/plans/2026-11-20-marks-statistics-page.md`: plan, executed natively.
