---
id: D0207
status: accepted
date: 2026-08-12
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset, visit, turns, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Bob's 27's per-hit value is the double's board value, not its face value

## Context and Problem Statement
The engine shipped adding face value (`target.number`), matching only the non-canonical `docs/game-rules/rulesets/bobs-27.md`'s own worked examples — no `decisions/**` block ever recorded that formula as a considered decision. The owner clarified during the Phase 1 planning session (`docs/superpowers/specs/2026-08-12-bobs27-frontend-design.md`) that standard Bob's 27 scores the double's actual board value, matching how `darts.score` (D142) already recorded each dart.

## Decision Drivers
* The owner confirmed that standard Bob's 27 scores the double's board value: a D16 hit adds 32 (spec, Bug).
* `darts.score` already recorded each dart at its board value, so only the derived running total `Bobs27State.score` disagreed (plan, Architecture).

## Considered Options
* Add the double's board value per hit, via `boardScore(target.number, "DOUBLE")` (chosen).
* Keep adding the double's face value, as the shipped engine did.

## Decision Outcome
Chosen option: "`pointValueOf` in `bobs27.engine.module.ts` returns the target's **board value** — `boardScore(target.number, "DOUBLE")` (2× its number) for D1–D20, unchanged `config.bullHitValue` (50, already board-value) for the bull. A hit on D16 adds 32 to the running score, not 16; a full-miss visit at D18 subtracts `missPenaltyMultiplier × 36`, not 18.".

### Consequences
`bobs27.engine.module.test.ts`'s score-delta assertions and the ruleset doc's worked examples were rewritten to match (same PR). `darts.score`/`turns.total_score` were already correct under D142 and are unaffected — this decision only changes `Bobs27State.score`, a derived, never-persisted value. No config schema change.

* Neutral, because the plan changes no persistence and no validator, only a derived value.
* Neutral, because the full-miss test needs `startScore: 2` instead of 1, so a D1 miss penalty of 2 lands exactly on 0 (plan, Task 1).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/game/bobs27.engine.module.test.ts` holds the score-delta assertions that the plan rewrote to board values.

## Pros and Cons of the Options
### Board value per hit
* Good, because the running total matches how `darts.score` already recorded each dart (plan, Architecture).
* Good, because the fix reuses the already-imported `boardScore()` helper instead of a hand-written `× 2` (plan, Architecture).

### Face value per hit
* Bad, because it contradicted the owner's statement of standard Bob's 27 (spec, Bug).

## Evidence / More Information
Decided: 2026-08-12

* `docs/superpowers/specs/2026-08-12-bobs27-frontend-design.md` (Bug): rebuilt Decision Drivers, Considered Options and Pros and Cons.
* `docs/superpowers/plans/2026-08-12-bobs27-phase1-scoring-fix.md` (Architecture, Task 1): rebuilt Decision Drivers, Considered Options, Pros and Cons, Consequences and Confirmation.
* Commit `77938f75` (2026-08-12; adds the D207 row): no section rebuilt.
