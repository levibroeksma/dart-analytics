---
id: D0491
status: accepted
date: 2026-10-24
origin: contemporaneous
original-date:
tags: [game-engine, engine, visit, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Cricket and Tactics share one validator factory and one set of play-data helpers

## Context and Problem Statement
#916 cluster 6 and the Cricket/Tactics play-data clones were left open by #1039 (#1044); each copy had to be edited twice for any rule change.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`createMarksCloseValidator(label, configSchema)` in `services/rulesets/marks-close.validator.ts` builds both marks-close validators (no intent, at most 3 darts per visit, on top of the shared three-dart rules); `cricket.validator.ts` and `tactics.validator.ts` only name the game and its config. `lib/game/marks-play.data.ts` gains the ring tap, miss, ring toggle, visit preview and engine-resume helpers both play pages used to copy. `MarksRing` is the one ring type.", because #916 cluster 6 and the Cricket/Tactics play-data clones were left open by #1039 (#1044); each copy had to be edited twice for any rule change.

### Consequences
no behaviour change, no migration. A third marks game adds a one-line validator. The play-data boilerplate every game shares (`init`, `retryReconciliation`, `back`, `abandonAndExit`) stays in each game's file.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/services/rulesets/marks-close.validator.test.ts` covers the shared validator factory and `app/tests/lib/game/marks-play.data.test.ts` covers the shared play-data helpers.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-24

* Commit `7ccf9e56` (PR #1044, 2026-10-24, "share Cricket/Tactics validator and play-data helpers"): adds the original ledger block and the shared modules; its message adds no rationale. Rebuilt Confirmation.
