---
id: D0569
status: accepted
date: 2026-11-25
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

# Elimination statistics page: an `elimination` section replayed from `v_game_replay`

## Context and Problem Statement
The owner wants improvement measured over time on the ELIMINATION family: Killer (`KILLER_V1`), Follow the Leader (`FOLLOW_THE_LEADER_V1`) and Prisoner (`PRISONER_V1`). All three seat exactly two, with a guest opponent and no DartBot, and showed only the heatmap. Every outcome (lives, Killer status, the standing target, prisoners) depends on both seats' darts in play order. The owner asked for the page to be designed like Marks (D0566), without a question round.

## Decision Drivers
* Improvement is read against the preceding period of equal length, per game.
* Anti-goal: a lives, lives-taken, darts-to-Killer, captured or imprisoned figure that differs from the game screen for the same session.
* Anti-goal: a second copy of any game's rules.
* Anti-goal: a change shown from too few.
* Only sessions the requesting player owns are read.

## Considered Options
* Leave the games on the heatmap layout.
* One section and layout per game.
* One server section `elimination` for the three games, replayed through each engine's own fold, with a per-game tile set (chosen).

## Decision Outcome
Chosen option: "A new server section `elimination` (`games: KILLER, FOLLOW_THE_LEADER, PRISONER`, `requires: board`, bucketable, completed sessions only) reads `v_game_replay` for the owner's sessions in scope and replays each through `foldKillerState`, `foldFollowTheLeaderState` or `foldPrisonerState`. Per bucket it emits, for the owner's one `PLAYER` seat: sessions, finished sessions, wins (a complete fold whose winning side is the owner's), darts, lives lost (starting lives less final lives; Prisoner 0); Killer games, summed darts to Killer and lives taken; Follow the Leader match visits (an owner turn, not a keep, at a standing target the owner did not set), matched visits (any dart in the target's bed by `bedOf`/`sameBed`, even if a spare dart then set a new target), darts to the first match, and both by bed (Single, Double, Treble, Bull joining outer and inner); Prisoner darts by `prisonerDartResults` (Advance, Advance and capture, Capture, Prison, Miss) and the highest number completed (target less one, 20 for a completed game). A session that does not decode, has no single `PLAYER` seat, has an unseated turn or whose fold throws is skipped and counted. The three rulesets render `EliminationStatsOverview.astro` (`ELIMINATION_LAYOUTS`, leaving `HEATMAP_ONLY_LAYOUTS`): the completion tile; Win rate plus three game tiles against the preceding period (Killer: Darts to Killer, Darts per life taken, Lives lost per game; Follow the Leader: Match rate, Darts per match, Lives lost per game; Prisoner: Advance rate, Prison rate, Numbers completed per game), a change from 30 in both periods' denominators and none for All Time; a MATCH RATE BY BED card (rate from 10 visits) for Follow the Leader or a DART RESULTS card (share of darts) for Prisoner, none for Killer; the heatmap and the session list.".

### Consequences
The Marks replay plumbing is game-neutral: `findMarksFoldRows` is `findReplayFoldRows` and `ReplayFoldRow`; `ownerSessions(rows, games)` (session grouping, snapshot decode as `config`, owner seat) and `foldOwnerSessions` live in `replay.module.ts`; `foldedBuckets` in `series.module.ts`; Marks uses all three. `comparisonSection`'s `toTiles` also receives the page game, so the Elimination tiles show their empty texts while loading. `10-Statistics/01-Section-Catalog.md` 1.16.0.

* Good, because no view or migration was needed, and every figure comes from the engines' own folds and helpers.
* Good, because one section serves three games through the plumbing Marks already used.
* Bad, because each session folds once per owner turn (quadratic in its turn count).
* Neutral, because own-double hits that cost Killer status are not counted, and Prisoner's win type is not shown.

### Confidence
High — every figure is read off the engines' own fold.

### Revisit When
A 3–4 seat or DartBot mode lands for any of the games, or a session's turn count makes the per-prefix fold slow.

### Confirmation
`app/tests/modules/stats/sections/elimination.module.test.ts` covers each game's fold, keep and setting turns, a spare-dart reset after a match, a re-earned Killer status, and skipped sessions. `app/tests/modules/stats/replay.module.test.ts` covers `ownerSessions` and `foldOwnerSessions`. `app/tests/lib/stats/elimination/` and `elimination-section.data.test.ts` cover the tiles, floors, card rows and Alpine scope; `constants.test.ts` asserts `ELIMINATION_LAYOUTS`.

## Pros and Cons of the Options
### Leave the games on the heatmap layout
* Bad, because improvement cannot be read.

### One section and layout per game
* Bad, because three sections would repeat the replay, grouping and bucketing for one shared result shape.

### One `elimination` section with per-game tiles
* Good, because the shared figures (result, darts, lives) are computed once.
* Bad, because the metrics carry every game's fields, zero for the other two.

## Evidence / More Information
Decided: 2026-11-24

* `docs/superpowers/specs/2026-11-24-elimination-statistics-page-design.md`: design (owner asked for it to follow Marks without questions, 2026-11-24).
* `docs/superpowers/plans/2026-11-24-elimination-statistics-page.md`: plan, executed natively.
