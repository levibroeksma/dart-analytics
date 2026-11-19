---
id: D0154
status: accepted
date: 2026-07-26
origin: contemporaneous
original-date:
tags: [game-engine, ruleset, checkout]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Ten Up One Down's ladder floors at 2, the minimum double-out-finishable target

## Context and Problem Statement
A long run of failures could walk the target below any finishable double, stranding a session where only failures could ever be recorded again (product decision resolving the ruleset doc's open floor question)

## Decision Drivers
* Before this record the ruleset doc stated V1 had no ladder floor, so a target below 2 could not be finished and a stranded session could only record failures.
* The ruleset doc listed the floor as an open question and called it a product decision, not an engine one.

## Considered Options
* Floor the ladder at 2, the minimum double-out target (chosen).
* No floor in V1: the ladder keeps falling and the engine refuses a checkout claimed below 2 (the state before this record).
* Floor at the start score, 41 (kept as a separate V2+ variant).

## Decision Outcome
Chosen option: "Ten Up One Down's ladder floors at 2, the minimum double-out-finishable target: `applyTuodAttempt` clamps a failure there instead of letting it fall further, so live and rehydrated sessions fold to the same target; the now-unreachable below-2 checkout guard is removed. The separate V2+ "floor at the start score (41)" variant remains deferred".

### Consequences
* Neutral, because commit `3963ec21` removed the below-2 checkout guard and the tests that only covered it.
* Neutral, because the same commit updated the ruleset doc: the floor at 2 is V1, and the floor at 41 is a separate, higher variant.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/game/tuod.engine.module.test.ts` covers the floor: a miss at target 3 floors to 2, repeated misses stay at 2, and a rehydrated session derives the same floored target.

## Pros and Cons of the Options
### Floor at 2
* Good, because no session can be stranded at a target where only failures could be recorded.
* Good, because the floor lives in the `applyTuodAttempt` fold, so live and rehydrated sessions agree.

### No floor in V1
* Bad, because a long run of failures walks the target below any finishable double.

### Floor at 41
Rationale unknown — no source found. The ruleset doc defers it to V2+ as an optional variant.

## Evidence / More Information
Decided: 2026-07-26

* Commit `3963ec21` (2026-07-26; "feat: floor the TUOD ladder at 2", with its `ten-up-one-down.md` diff): rebuilt Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
* Applied in: `docs/superpowers/specs/2026-08-20-tuod-analytics-design.md`, `docs/superpowers/plans/2026-08-20-tuod-analytics-capture.md`.
