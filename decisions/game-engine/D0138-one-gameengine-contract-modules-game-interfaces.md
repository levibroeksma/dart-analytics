---
id: D0138
status: accepted
date: 2026-07-26
origin: contemporaneous
original-date:
tags: [game-engine, engine, GameEngine, 501, undo, leg]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# One `GameEngine` contract (`modules/game/interfaces.ts`, Pattern 18) replaces five

## Context and Problem Statement
Five engines shipped five APIs, three fact models and no rehydrate path, so every shared consumer (play page, store, undo, leave/abandon, hard-gate) had to special-case each game; `wouldComplete` exists because deciding completion by record-then-rollback strands the `LEG` stage 501's `record()` opens (review C1, I1–I3, ST6, P2)

## Decision Drivers
* The engine-and-frontend module doc makes the engine the owner of `clientKey` assignment; no engine except Score Training minted keys (review I1).
* Local-first recovery (D67, D88, D90) needs an engine that can be rebuilt on reload; four engines could only be constructed empty (review I2).
* Every shared consumer had to special-case each game's API (review I3).
* A new game should not require redesigning existing games (Pattern 15).

## Considered Options
* One `GameEngine` contract that every engine implements (chosen).
* Make the four new engines copy Score Training's shape.
* Keep five bespoke engine APIs (the state before this record).

## Decision Outcome
Chosen option: "One `GameEngine` contract (`modules/game/interfaces.ts`, Pattern 18) replaces five bespoke engine APIs: a `GameEngineFactory` builds every engine from a validated config snapshot bound to a `rulesetVersionKey`; the engine mints `clientKey`/`sequence`/`completedAt`, rehydrates via `create(config, prior)`, answers `wouldComplete(input)` as a pure non-mutating predicate, and `undo()` is an exact inverse of `record()` over `facts()` including any stage the record opened; one generic `events.payload.module.ts` builds every batch".

### Consequences
* Neutral, because the plan retrofits all five engines to the contract (Tasks 5–9) and moves the shared store with the Score Training engine.
* Neutral, because the plan binds every engine task to two rules: `record(x)` then `undo()` returns `facts()` deep-equal to its prior value, and `wouldComplete` is tested not to mutate.
* Neutral, because page-level engine construction must refuse a `rulesetVersionKey` the page does not own.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`scripts/check-game-engines.sh` runs in the `quality.yml` workflow. It fails when an `*.engine.module.ts` exports no `*EngineFactory`, never calls `registerEngineFactory`, or names a key missing from the validator registry or `RULESET_CAPABILITIES`. `app/tests/modules/game/engine.registry.test.ts` covers the registry.

## Pros and Cons of the Options
### One `GameEngine` contract
* Good, because play page, store, undo, leave/abandon and hard-gate no longer special-case each game.
* Good, because `wouldComplete` avoids stranding the `LEG` stage that 501's `record()` opens.

### Copy Score Training's shape into the four engines
* Bad, because the review finds Score Training has a duplicate fact log (ST2) and a single-game store (ST1), so copying it keeps those defects.

### Five bespoke engine APIs
* Bad, because every shared consumer must special-case each game (review I3).

## Evidence / More Information
Decided: 2026-07-26

* `docs/superpowers/specs/2026-07-25-game-engine-review-design.md` (§ 2 I1–I3, § 5, § 6 verdict): rebuilt Decision Drivers, Considered Options and Pros and Cons.
* `docs/superpowers/plans/2026-07-25-game-engine-contract-hardening.md` (Goal, Architecture, Task 3, Phase 2 rules, Task 5): rebuilt Consequences.
* `scripts/check-game-engines.sh` and `.github/workflows/quality.yml`: rebuilt Confirmation. D141 records the script.
* Commit `8e46e453` (2026-07-26; "docs: record the game engine contract and persistence semantics"): adds the D138 row.
