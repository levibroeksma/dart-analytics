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
<!-- backfill: pending -->

# A completed visit's live dart count is its own dart rows, not `maxDartsPerTurn`

## Context and Problem Statement
Issue #287. Under VISUAL_BOARD a visit resolves the moment it checks out or busts, so a completed visit can hold one or two darts; charging it a full `maxDartsPerTurn` overstated the leg by up to two darts per early finish. The `darts.length > 0` fallback is what keeps QUICK_SCORE correct — a keypad visit carries `darts: []` by design (D217) and genuinely costs a full visit. That is the same rule `effectiveDartsForVisit` (`app/src/modules/stats/visit-stats.module.ts`) already applies to persisted visit facts and `legDartsFor` (`five-oh-one.engine.module.ts`) applies to a finished leg, so the live readout now agrees with both instead of being the one place that rounded up.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`dartsThrownCount` (`app/src/lib/game/play-visit-stats.ts`) sums each completed visit as `darts.length` when the visit carries dart rows and `maxDartsPerTurn` only when it carries none; the open visit keeps counting its own darts alone. Every live "darts thrown" readout — 501's `dartsThrownThisLeg`/`dartsThrownThisLegFor`, Score Training's pair, 121's `dartsThrownThisSession` — moves with it.".

### Consequences
a board leg's displayed dart count drops for any leg containing an early checkout or bust — the number is lower than before and correct, not a regression. `threeDartAverageDisplay` still divides by `completed.length * maxDartsPerTurn` and is deliberately untouched here: changing the average's denominator is a separate behavioural choice with its own expected numbers, captured as its own issue rather than folded into this fix.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-19
