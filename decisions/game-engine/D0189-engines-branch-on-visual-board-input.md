---
id: D0189
status: superseded
date: 2026-08-09
origin: contemporaneous
original-date:
tags: [game-engine, engine, 501, Score Training, visit, bust, turns, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by: D0198
---
<!-- backfill: pending -->

# Engines branch on VISUAL_BOARD input mode; 501 bust visibility becomes mode-scoped

## Context and Problem Statement
The QUICK_SCORE 501 bust-vs-scoreless-visit ambiguity (`06-Spec/04-Runtime-Layer.md`'s known limitation) is a capture-depth problem, not a 501-specific one: full dart rows make the two cases distinguishable by construction — counted `0` against thrown non-zero darts — so the fix belongs to input mode, not to a schema change or a 501-only special case.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`EngineInputMode` distinguishes capture depth inside 501 and Score Training: under ANALYTICS + VISUAL_BOARD, each engine records dart-level visits (`classify(x, y)`'s hit target/zone/score/coordinates folded onto every dart, no game-specific point derived from it), while QUICK_SCORE keeps recording turn-total-only visits with no dart rows, unchanged. `isVisualBoardCapture(captureModeKey, inputModeKey)` (`app/src/services/rulesets/visual-board.validator.ts`) is the single predicate both the Worker validator and the engines key on. The Worker re-derives every submitted dart from its own coordinate via the shared `classify()` and refuses the batch on any disagreement with the client's claim — the client's zone/target/score are computed for immediate feedback but never trusted as authority.".

### Consequences
`06-Spec/04-Runtime-Layer.md`'s known-limitation section is retitled to scope it to QUICK_SCORE and gains a "Retired for VISUAL_BOARD sessions" note. `DartZoneKey`'s `INNER_SINGLE`/`OUTER_SINGLE` split (D191) is a precondition — without banded singles, a visual dart landing in either band would score correctly but classify to an unbanded zone the intended-vs-hit accuracy analysis could not distinguish by ring side. A VISUAL_BOARD session's busted visit persists `turns.total_score = 0` alongside dart rows carrying their real non-zero board scores (the `total_score` bust carve-out, `06-Spec/04-Runtime-Layer.md`) — that divergence is the fact the mode-scoped fix depends on. QUICK_SCORE sessions remain unfixable: completed gameplay is immutable and no coordinate exists to recover.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-05
