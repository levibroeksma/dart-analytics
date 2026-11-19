---
id: D0143
status: accepted
date: 2026-07-26
origin: contemporaneous
original-date:
tags: [game-engine, ruleset, 501, leg, visit, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# 501 V1 rules bound to `501_V1`

## Context and Problem Statement
`dartsOnDouble >= 1` let a visit put one dart in a double, finish on a single and still win; an unvalidated `scoreAttempted` let −100 *raise* the remaining score (review I7/I8/I4)

## Decision Drivers
* The rule is that the dart reaching exactly 0 must be a double, but the check was `dartsOnDouble >= 1` (review I8).
* Score caps belong to the ruleset (D15, Database Agent Guide § 8), and the engine is their named owner, but PR #48 declined to validate (review I7).
* The seeded `501_V1` preset has `legs_to_win: 3` but the engine was single-leg; rulesets are immutable (D03), so the version pin must be decided now (review I4).

## Considered Options
* Bind 501 to `501_V1` with a finishing-dart double rule, a ruleset-owned visit cap and one `LEG` stage per leg (chosen).
* Keep PR #48's rules: `dartsOnDouble >= 1`, no `scoreAttempted` validation, single-leg engine (the state before this record).

## Decision Outcome
Chosen option: "501 V1 rules bound to `501_V1`: the win condition is that the **finishing** dart is a double (`finishedOnDouble`), darts-at-a-double are an analytics fact only; `max_visit_score` in the ruleset config makes the score cap ruleset-owned per D15; `legs_to_win` drives one `LEG` stage per leg, so the seeded multi-leg preset is playable", because `dartsOnDouble >= 1` let a visit put one dart in a double, finish on a single and still win; an unvalidated `scoreAttempted` let −100 *raise* the remaining score (review I7/I8/I4).

### Consequences
* Good, because `scoreAttempted` must be an integer in `0..maxVisitScore`, and anything else throws before any state change.
* Good, because the seeded `501 — Best of 5 Legs` preset becomes executable.
* Neutral, because `dartsAtDouble` stays as an analytics fact and is never a win condition.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/game/five-oh-one.engine.module.test.ts` covers the rules: a leg is won when the dart that reached zero was a double, and scores below 0 or above 180 throw. `app/tests/lib/game/five-oh-one-legs.test.ts` only tests the `clampFiveOhOneLegs` legs clamp helper, not multi-leg play.

## Pros and Cons of the Options
### Bound to `501_V1` with the new rules
* Good, because a visit that lands one dart in a double and finishes on a single no longer wins.
* Good, because a negative or oversized `scoreAttempted` can no longer corrupt the fact log.

### PR #48's original rules
* Good, because it trusts recreational input, which is the reason PR #48 gives for not validating `scoreAttempted`.
* Bad, because `recordVisit(-100)` raised the remaining score to 601 and `recordVisit(200)` was accepted (review probe).
* Bad, because a visit with one dart in a double and a single finish validated as a win.

## Evidence / More Information
Decided: 2026-07-26

* `docs/superpowers/specs/2026-07-25-game-engine-review-design.md` (§ 2 I4, I7, I8, § 6): rebuilt Decision Drivers, Considered Options and Pros and Cons.
* `docs/superpowers/plans/2026-07-25-game-engine-contract-hardening.md` (Task 2 `501_V1` schema, Task 9): rebuilt Consequences.
* Commit `8e46e453` (2026-07-26; "docs: record the game engine contract and persistence semantics"): adds the D143 row.
