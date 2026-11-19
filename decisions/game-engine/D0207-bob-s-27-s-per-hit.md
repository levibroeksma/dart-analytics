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
<!-- backfill: pending -->

# Bob's 27's per-hit value is the double's board value, not its face value

## Context and Problem Statement
The engine shipped adding face value (`target.number`), matching only the non-canonical `docs/game-rules/rulesets/bobs-27.md`'s own worked examples — no `decisions/**` block ever recorded that formula as a considered decision. The owner clarified during the Phase 1 planning session (`docs/superpowers/specs/2026-08-12-bobs27-frontend-design.md`) that standard Bob's 27 scores the double's actual board value, matching how `darts.score` (D142) already recorded each dart.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`pointValueOf` in `bobs27.engine.module.ts` returns the target's **board value** — `boardScore(target.number, "DOUBLE")` (2× its number) for D1–D20, unchanged `config.bullHitValue` (50, already board-value) for the bull. A hit on D16 adds 32 to the running score, not 16; a full-miss visit at D18 subtracts `missPenaltyMultiplier × 36`, not 18.".

### Consequences
`bobs27.engine.module.test.ts`'s score-delta assertions and the ruleset doc's worked examples were rewritten to match (same PR). `darts.score`/`turns.total_score` were already correct under D142 and are unaffected — this decision only changes `Bobs27State.score`, a derived, never-persisted value. No config schema change.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-12
