---
id: D0150
status: accepted
date: 2026-07-26
origin: contemporaneous
original-date:
tags: [game-engine, engine, Score Training]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# No engine hands out live internals

## Context and Problem Statement
Four engines returned derived copies and one returned live state, so the same caller write drove completion in one game and silently no-opped in the other four; the shared `STAGE` constant also landed inside an Alpine `$persist` proxy (D120)

## Decision Drivers
* `record*` returned `this.state` and `visitHistory()` returned the live array, guarded only by a JSDoc warning (review M3).
* Assigning engine-owned state into an Alpine store wraps it in a reactive proxy; D120 documents how costly Alpine aliasing surprises are here.

## Considered Options
* Return derived or detached copies from every engine (chosen).
* Keep returning live state behind a JSDoc warning (the state before this record).

## Decision Outcome
Chosen option: "No engine hands out live internals: `state()` returns a freshly derived object and `facts()` returns detached stage/turn records (the module-level `STAGE` constant is cloned). Score Training's MINUTES timer expiry moves from a write through the returned state to an explicit `ScoreTrainingEngine.expireTimer()`".

### Consequences
* Neutral, because `score-training-play.data.ts` changed in the same commit to call `expireTimer()` instead of writing through the returned state.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/game/engine-reference-isolation.test.ts` asserts `state()` returns a fresh object per call and `facts()` returns stage and turn records the caller cannot write through.

## Pros and Cons of the Options
### Derived and detached copies
* Good, because a caller cannot write into engine-owned state through a returned object; the commit adds a test that asserts it for every engine.

### Live state behind a JSDoc warning
* Bad, because an Alpine store wraps engine-owned state in a reactive proxy.

## Evidence / More Information
Decided: 2026-07-26

* `docs/superpowers/specs/2026-07-25-game-engine-review-design.md` (§ 3 M3): rebuilt Decision Drivers and Pros and Cons.
* Commit `51d99be8` (2026-07-26; "fix: close the game engine review's remaining findings"): adds the D150 row and `engine-reference-isolation.test.ts`. It rebuilt Considered Options, Consequences and Confirmation.
