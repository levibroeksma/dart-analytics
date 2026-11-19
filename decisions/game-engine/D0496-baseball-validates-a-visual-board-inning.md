---
id: D0496
status: superseded
date: 2026-10-29
origin: contemporaneous
original-date:
tags: [game-engine, engine, scoring, visit, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by: D0507
---

# Baseball validates a visual-board inning total as its runs

## Context and Problem Statement
the engine persists a closed inning's runs as `totalScore`, but the visual-board check demanded the board sum, so any batch with a closed inning holding an off-number scoring dart was refused. Leaving a game uploads the batch first, so Leave failed with "Could not abandon session"; finishing a game failed the same way.

## Decision Drivers
* Leaving a game uploads the batch first, so a refused batch made Leave fail with "Could not abandon session"; finishing a game failed the same way.

## Considered Options
* Keep the shared visual-board check, which compares a turn's `totalScore` to the board sum.
* Check `totalScore` against the inning's runs in `baseballValidator` (chosen).

## Decision Outcome
Chosen option: "under ANALYTICS + VISUAL_BOARD, `baseballValidator` checks each turn's `totalScore` against the runs of its inning (the darts that landed on the inning's number, the inning being the seat's stored turn count plus the batch position) or 0 for a void visit. The shared three-dart check still re-derives every dart from its coordinate; it sees the board sum so it no longer refuses the runs total.".

### Consequences
no migration. Keypad (RECREATIONAL + DETAILED_DARTS) behaviour is unchanged. Other `closedVisitTotal` engines are not covered here.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/services/rulesets/baseball/baseball.validator.test.ts` and `app/tests/lib/game/baseball-play.data.test.ts` check the validator and play data. Commit `0ee44d65` added both test changes. The runs cases now assert D507's corrected derivation, not D496's.

## Pros and Cons of the Options
### Keep the shared board-sum check
* Bad, because Baseball persists the inning's runs, so any batch with a closed inning holding an off-number scoring dart was refused.

### Check `totalScore` against the inning's runs
* Good, because the check accepts the total the engine persists.

## Evidence / More Information
Decided: 2026-10-25

* Commit `0ee44d65` (2026-10-25; adds the D496 row): rebuilt Decision Drivers, Considered Options, Pros and Cons and Confirmation.
* Superseded by D507, which replaces the runs derivation; D496's rule otherwise stands.
