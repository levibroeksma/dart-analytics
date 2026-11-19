---
id: D0376
status: accepted
date: 2026-09-30
origin: contemporaneous
original-date:
tags: [game-engine, visit, bust, turns, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# A resolved Shanghai visit persists its counted total; Hard halving is a negative visit total

## Context and Problem Statement
issue #624. The persisted visit total was the raw dart sum, so `session-result` and the Statistics "points per round" card showed a score the match never used. X01 already stores the counted total for a bust (0039), so a counted `total_score` is the existing convention, and halving cannot be derived from the column at read time without re-folding darts.

## Decision Drivers
* Issue #624: the persisted visit total was the raw dart sum, so `session-result` and the Statistics "points per round" card showed a score the match never used.
* X01 already stores the counted total for a bust, so a counted `total_score` is an existing convention.
* Halving cannot be derived from the column at read time without re-folding darts.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "when `ShanghaiEngine.record` resolves a visit it sets `turns.total_score` to the change that visit made to the seat's running total: round-restricted points on a normal visit, `round(running / 2) - running` (negative) on a Hard visit with no target hit. Dart rows keep the raw board score. A seat's turn totals therefore sum to its score, so every stats read that sums `turns.total_score` reports the counted score. `applyShanghaiDart` and the fold are unchanged and stay the source of match decisions.".

### Consequences
Shanghai visit totals can be negative; `turns.total_score` has no CHECK against it. Sessions recorded before this change keep raw totals. An open visit still shows the raw dart sum until its third dart. Supersedes the "Hard-mode halving … never stored" line in `docs/game-rules/rulesets/shanghai.md`, edited to match.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/game/shanghai.engine.module.test.ts` has a test named "persists the counted visit total, so the turn totals sum to the seat total after a Hard halving".

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-09-30

* Commit `330d141f` (PR #674, 2026-10-01; adds the D376 row, the engine change and the test): rebuilt Decision Drivers and Confirmation. No spec or plan cites D376.
