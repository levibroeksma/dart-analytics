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

# Baseball statistics page: derived inning intent on the Track games page

## Context and Problem Statement
Baseball Darts (`BASEBALL_V1`, TRACK kernel) was the last playable game on the heatmap-only layout; Bull 500 has no play route. The Track games page (D562) left Baseball out because it had no target picker and no per-target sections: its engine records no intent per dart. Yet each inning has a real target, inning n aiming at number n. The owner asked to start with the last kernel and to skip the questions.

## Decision Drivers
* Anti-goal: a second copy of Baseball's inning or hit rule.
* Anti-goal: a target row Baseball never aims at (10 to 20, the bull).
* Reuse the Track games page and the derived-intent sections, as Ace did (D563).

## Considered Options
* Leave Baseball on the heatmap layout.
* A dedicated Baseball page with runs tiles.
* Derived inning intent, Baseball on the Track games page (chosen).

## Decision Outcome
Chosen option: "Derived inning intent, Baseball on the Track games page", because the existing `target-accuracy`, `confusion`, `miss-direction`, `loose-darts` and target-filtered `heatmap` sections then run for Baseball with no new section, endpoint or migration. `BASEBALL_V1` gains `intent-derived` and `target-sequence`. A `BASEBALL` walker in `derived-aims.module.ts` folds the owner's darts through `applyBaseballDart` and aims each dart at the engine's `activeTargetOf` before it (`NUMBER:n`, n = 1 to 9; any ring hits, the bull is a miss). `heatmap-targets.ts` gives Baseball a picker and rows of `NUMBER:1..9`. `BASEBALL_V1` moves from `HEATMAP_ONLY_LAYOUTS` to `TRACK_LAYOUTS`, which keeps `BULL_500_V1` alone.

### Consequences
* Good, because Baseball reads hit rate and miss direction per inning number with no new section.
* Good, because the inning rule lives once, in the engine's `activeTargetOf`.
* Bad, because the page shows no runs card or period comparison; `session-result` already carries runs (`RESULT_DIRECTION.BASEBALL = "higher"`).
* Neutral, because a 1v1 session folds only the owner's darts, one visit an inning, as Ace does.

### Confidence
High: the walker replays the engine's own reducer and target.

### Revisit When
Baseball gains extra innings, a bull phase or more than nine innings, or the Track page gains a runs or comparison card.

### Confirmation
`app/tests/modules/stats/derived-aims.module.test.ts` (Baseball: inning aims, any-ring hits, the bull as a miss, a dart past inning 9 skipped), `baseball.engine.module.test.ts` (`activeTargetOf`), `heatmap-targets.test.ts`, `constants.test.ts`, `section-registry.test.ts` and `capabilities.test.ts`.

## Pros and Cons of the Options
### Leave Baseball on the heatmap layout
* Bad, because accuracy per inning number cannot be read.

### A dedicated Baseball page with runs tiles
* Bad, because a new section and layout for a beginner novelty game, when the per-target page already fits its aimed play.

### Derived inning intent on the Track games page
* Good, because it reuses every existing per-target section and the shared layout.

## Evidence / More Information
Decided: 2026-11-26

* `docs/superpowers/specs/2026-11-26-baseball-statistics-page-design.md`: design (owner: "start with the last kernel, skip the questions", 2026-11-26).
