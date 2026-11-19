---
id: D0139
status: accepted
date: 2026-07-26
origin: contemporaneous
original-date:
tags: [game-engine, engine, fact log, turns]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Engines own the fact log and derive everything else

## Context and Problem Statement
Bob's 27 and Singles Training kept the derivation and discarded the fact, inverting "store what happened"; the Score-Training-shaped store had nowhere to put the other games' facts (review C2, ST1, ST2)

## Decision Drivers
* Bob's 27 and Singles Training discard the per-dart facts, so no `turns`/`darts` rows, per-target accuracy, replay or undo-safe reconstruction can be produced (review C2).
* The shared game store holds one game's config and visit totals, so other games' facts have nowhere to go (review ST1).
* The engine and the store keep the same facts twice and can diverge (review ST2).

## Considered Options
* Engines own the fact log and the store replaces its log from `engine.facts()` (chosen).
* Keep derivations in the engines and a Score-Training-shaped store that appends turns (the state before this record).

## Decision Outcome
Chosen option: "Engines own the fact log and derive everything else: running score, training points, hit ratios and averages are folded from `facts()` on read and never stored in a field or a fact; the game store is game-agnostic (`rulesetVersionKey` + config union + `stages`/`turns`, `_v` → 2) and replaces its whole log from `engine.facts()` instead of appending, so engine and store cannot diverge".

### Consequences
* Bad, because the store `_v` bump to 2 discards incompatible persisted state (D91).
* Neutral, because `GameConfigSnapshot` and `RecordedTurn` are deleted from `stores/types.ts`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/stores/game.store.test.ts` covers the store: `recordFacts` persists the engine's stages and turns, and "replaces the fact log wholesale so engine and store cannot diverge".

## Pros and Cons of the Options
### Engines own the fact log
* Good, because the store replaces its whole log from the engine, so the two cannot diverge (closes ST2).
* Bad, because the `_v` bump discards persisted in-progress state of the older shape.

### Derivation-keeping engines and an appending store
* Bad, because the facts needed for `turns`/`darts` rows, replay and undo-safe reconstruction are never kept (C2).
* Bad, because the engine's copy and the store's copy of the same facts can diverge (ST2).

## Evidence / More Information
Decided: 2026-07-26

* `docs/superpowers/specs/2026-07-25-game-engine-review-design.md` (§ 1 C2, § 6 ST1–ST2): rebuilt Decision Drivers, Considered Options and Pros and Cons.
* `docs/superpowers/plans/2026-07-25-game-engine-contract-hardening.md` (Task 5, Tasks 6–7): rebuilt Consequences and Confirmation.
* Commit `8e46e453` (2026-07-26; "docs: record the game engine contract and persistence semantics"): adds the D139 row.
