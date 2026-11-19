---
id: D0488
status: superseded
date: 2026-10-29
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by: D0506
---

# A marks engine's class and factory are typed by the same ruleset key

## Context and Problem Statement
the D487 factory took the key and the built engine independently, so the two could disagree and only the wiring gate's grep caught a missing literal, not a mismatched one.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`CricketEngine` and `TacticsEngine` are generic in their ruleset key (`TKey`), `MarksEngine.fork()` returns the engine type, and `marksEngineFactory` requires `build` to return an engine whose key is the factory's own (`NoInfer`). A factory keyed `CRICKET_V2` that builds a V1-keyed engine fails to type-check.", because the D487 factory took the key and the built engine independently, so the two could disagree and only the wiring gate's grep caught a missing literal, not a mismatched one.

### Consequences
type-level only, no behaviour change. `new CricketEngine(config)` still defaults to V1. Regression guards are `@ts-expect-error` tests in `marks-engine.module.test.ts` and `tactics.engine.module.test.ts`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Commit `b4e5ece5` (PR #1078) added `@ts-expect-error` regression tests in `app/tests/modules/game/marks-engine.module.test.ts`. Commit `d88a61dc` (PR #1145) deleted `marks-engine.module.ts` and that test file. No check for this rule exists today.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-24

* Commit `b4e5ece5` (PR #1078, 2026-10-24, "close Cricket V2 review minors"): adds the original ledger block and the type guard. Rebuilt Confirmation.
* `docs/superpowers/specs/2026-10-28-marks-kernel-design.md` (M2, M3): the Marks kernel deletes `MarksEngine` and replaces D488's compile-time key guard with the shell's runtime served-key check.
* Superseded by D506 (the Marks kernel binds Cricket and Tactics to the game shell).
