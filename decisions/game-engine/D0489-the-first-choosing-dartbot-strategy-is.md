---
id: D0489
status: accepted
date: 2026-10-24
origin: contemporaneous
original-date:
tags: [game-engine, ruleset, scoring]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# The first choosing DartBot strategy is a marks ladder on `CRICKET_V2`

## Context and Problem Statement
Cricket V2 shipped guest-only because no strategy could aim at an objective. A strict ladder is explainable and testable as a table, and the view and strategy are game-agnostic, so Tactics V2 can reuse them.

## Decision Drivers
* Cricket V2 shipped guest-only because no strategy could aim at an objective.
* The policy is opponent-aware, as a strict ladder; `level` changes aim noise only.
* No new ruleset key: a bot seat does not change the rules.
* Scope is Cricket V2, with the strategy and view written generically for Tactics V2 to reuse.

## Considered Options
* Keep Cricket V2 guest-only.
* A strict opponent-aware marks ladder (chosen).

## Decision Outcome
Chosen option: "`marks.strategy.module.ts` is the first DartBot strategy that chooses its own target. Per dart it takes the first objective the opponent has closed and the bot has not (block), else the first the bot has closed and the opponent has not (score), else the first the bot has open (close), over the fixed order 20, 19, 18, 17, 16, 15, bull, aiming treble (inner bull for the bull). It reads a flat `MarksView` of per-objective own and opponent marks and no points. A DartBot is a seat on `CRICKET_V2`, not a new ruleset key: `RULESET_DARTBOT.CRICKET_V2` is true and the setup resolver picks `CRICKET_V2` for a guest or a bot.".

### Consequences
no decision-degrading by level in this version: `level` changes aim noise only. The bull is last in every tier, so a bot behind on points may be slow to score on it. A passive opponent who closes nothing lets the bot keep scoring on numbers it owns, so that game ends only when the opponent closes numbers; a human playing to win does. No migration and no schema change. Spec: `docs/superpowers/specs/2026-10-24-cricket-dartbot-design.md`. Rules: `docs/game-rules/rulesets/cricket.md`.
* Good, because the view and strategy seam stay, so a later version can add a rule or a decision axis without an interface change.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/dartbot/strategy/marks.strategy.module.test.ts` and `app/tests/modules/dartbot/harness/cricket-dartbot-seat.contract.test.ts` check the strategy and the bot seat.

## Pros and Cons of the Options
### Keep Cricket V2 guest-only
* Bad, because no DartBot can sit in a Cricket V2 seat.

### Strict marks ladder
* Good, because a strict ladder is explainable and testable as a table.
* Good, because the view and strategy are game-agnostic, so Tactics V2 can reuse them.
* Bad, because the bull is last in every tier, so a bot behind on points may never score on it.
* Bad, because the strict ladder can play visibly oddly, for example blocking while far ahead.

## Evidence / More Information
Decided: 2026-10-24
Referenced by D0490's `Supersedes:` line.

* `docs/superpowers/specs/2026-10-24-cricket-dartbot-design.md` (§ 1, § 3, § 4, § 5, § 8, § 10): rebuilt Decision Drivers, Considered Options, Pros and Cons, Consequences and Confirmation.
* Commit `1a0bf4dc` (PR #1081, 2026-10-24; adds the D489 row and the strategy tests): confirmed Confirmation.
