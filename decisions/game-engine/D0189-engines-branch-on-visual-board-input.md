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

# Engines branch on VISUAL_BOARD input mode; 501 bust visibility becomes mode-scoped

## Context and Problem Statement
The QUICK_SCORE 501 bust-vs-scoreless-visit ambiguity (`06-Spec/04-Runtime-Layer.md`'s known limitation) is a capture-depth problem, not a 501-specific one: full dart rows make the two cases distinguishable by construction — counted `0` against thrown non-zero darts — so the fix belongs to input mode, not to a schema change or a 501-only special case.

## Decision Drivers
* A busted visit persists as `total_score = 0` with dart rows whose own scores are non-zero. The spec says that asymmetry is what makes bust rate and true checkout percentage computable (spec, The bust becomes visible).
* Without Worker re-classification, the client is the sole authority on the analytical fact, so a stale or tampered client writes permanent garbage into the dataset (spec, API).

## Considered Options
* Branch on `EngineInputMode` inside each engine, so one fact log holds the visit and its darts (chosen).
* Put an adapter above unchanged engines that sums taps into a visit total while it emits dart facts separately (rejected).
* Add new ruleset versions such as `FIVE_OH_ONE_V2` (rejected).

## Decision Outcome
Chosen option: "`EngineInputMode` distinguishes capture depth inside 501 and Score Training: under ANALYTICS + VISUAL_BOARD, each engine records dart-level visits (`classify(x, y)`'s hit target/zone/score/coordinates folded onto every dart, no game-specific point derived from it), while QUICK_SCORE keeps recording turn-total-only visits with no dart rows, unchanged. `isVisualBoardCapture(captureModeKey, inputModeKey)` (`app/src/services/rulesets/visual-board.validator.ts`) is the single predicate both the Worker validator and the engines key on. The Worker re-derives every submitted dart from its own coordinate via the shared `classify()` and refuses the batch on any disagreement with the client's claim — the client's zone/target/score are computed for immediate feedback but never trusted as authority.".

### Consequences
`06-Spec/04-Runtime-Layer.md`'s known-limitation section is retitled to scope it to QUICK_SCORE and gains a "Retired for VISUAL_BOARD sessions" note. `DartZoneKey`'s `INNER_SINGLE`/`OUTER_SINGLE` split (D191) is a precondition — without banded singles, a visual dart landing in either band would score correctly but classify to an unbanded zone the intended-vs-hit accuracy analysis could not distinguish by ring side. A VISUAL_BOARD session's busted visit persists `turns.total_score = 0` alongside dart rows carrying their real non-zero board scores (the `total_score` bust carve-out, `06-Spec/04-Runtime-Layer.md`) — that divergence is the fact the mode-scoped fix depends on. QUICK_SCORE sessions remain unfixable: completed gameplay is immutable and no coordinate exists to recover.

* Good, because bust rate and true checkout percentage become computable for VISUAL_BOARD sessions.
* Neutral, because the spec defers retrofitting Bob's 27, Singles Training, Doubles Training and TUOD to later specs.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
History: the spec's Testing and Gates sections list Worker rejection of a coordinate/zone disagreement and per-dart `undo()` as an exact inverse of `record()`. They also propose extending `scripts/check-game-engines.sh` to assert that every registered engine declares its input modes. This record is superseded by D198: `EngineInputMode` no longer exists in `app/src`, and the spec's extension of `scripts/check-game-engines.sh` was a proposal. The named files do not check this decision. Rationale unknown — no source found for a standing check.

## Pros and Cons of the Options
### Branch on `EngineInputMode` inside each engine
* Good, because the fact log keeps a single owner for the visit and its darts (spec, Rejected alternatives).
* Good, because no ruleset forks into two maintained copies (spec, Rejected alternatives).

### Adapter above unchanged engines
* Bad, because the visit total and the dart rows become two independent truths for one visit, against Pattern 18's single-owner fact log (spec, Rejected alternatives).

### New ruleset versions
* Bad, because each game's rules fork into two maintained copies, and every future game repeats the fork (spec, Rejected alternatives).

## Evidence / More Information
Decided: 2026-08-05

* `docs/superpowers/specs/2026-08-05-visual-board-input-design.md` (Non-goals, Rejected alternatives, The bust becomes visible, API, Testing, Gates): rebuilt Decision Drivers, Considered Options, Pros and Cons, Consequences and Confirmation.
* Commit `ba175815` (PR #73, 2026-08-08; adds the D189 row): no section rebuilt.
