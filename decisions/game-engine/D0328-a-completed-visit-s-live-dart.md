---
id: D0328
status: accepted
date: 2026-09-19
origin: contemporaneous
original-date:
tags: [game-engine, engine, checkout, 501, Score Training, leg, visit, bust, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# A completed visit's live dart count is its own dart rows, not `maxDartsPerTurn`

## Context and Problem Statement
Issue #287. Under VISUAL_BOARD a visit resolves the moment it checks out or busts, so a completed visit can hold one or two darts; charging it a full `maxDartsPerTurn` overstated the leg by up to two darts per early finish. The `darts.length > 0` fallback is what keeps QUICK_SCORE correct — a keypad visit carries `darts: []` by design (D217) and genuinely costs a full visit. That is the same rule `effectiveDartsForVisit` (`app/src/modules/stats/visit-stats.module.ts`) already applies to persisted visit facts and `legDartsFor` (`five-oh-one.engine.module.ts`) applies to a finished leg, so the live readout now agrees with both instead of being the one place that rounded up.

## Decision Drivers
* Charging every resolved visit a full `maxDartsPerTurn` overstated a `VISUAL_BOARD` leg by up to 2 darts per early checkout or bust (commit message, issue #287).
* The live readout should agree with `effectiveDartsForVisit` and `legDartsFor` (commit message).
* A quick-score visit carries no dart rows (D217) and still costs a full visit (commit message).

## Considered Options
* Count a completed visit's own dart rows, falling back to `maxDartsPerTurn` only when it has none (chosen).
* Charge every completed visit a full `maxDartsPerTurn` (the behaviour before this record).

## Decision Outcome
Chosen option: "`dartsThrownCount` (`app/src/lib/game/play-visit-stats.ts`) sums each completed visit as `darts.length` when the visit carries dart rows and `maxDartsPerTurn` only when it carries none; the open visit keeps counting its own darts alone. Every live "darts thrown" readout — 501's `dartsThrownThisLeg`/`dartsThrownThisLegFor`, Score Training's pair, 121's `dartsThrownThisSession` — moves with it.".

### Consequences
a board leg's displayed dart count drops for any leg containing an early checkout or bust — the number is lower than before and correct, not a regression. `threeDartAverageDisplay` still divides by `completed.length * maxDartsPerTurn` and is deliberately untouched here: changing the average's denominator is a separate behavioural choice with its own expected numbers, captured as its own issue rather than folded into this fix.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/lib/game/play-visit-stats.test.ts` holds the case "counts a completed visit's own darts when it resolved early".

## Pros and Cons of the Options
### Count the visit's own dart rows
* Good, because the live readout agrees with `effectiveDartsForVisit` and `legDartsFor`.
* Good, because quick-score visits, which carry no dart rows, still cost a full visit.

### Full `maxDartsPerTurn` per completed visit
* Bad, because a board leg's dart count is overstated by up to 2 darts per early checkout or bust.

## Evidence / More Information
Decided: 2026-09-19

* Commit `885aafa9` (2026-09-19, closes #287, adds the D328 row): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons from its message and the row. It also added the test named in Confirmation.
