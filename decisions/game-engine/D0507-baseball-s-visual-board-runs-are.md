---
id: D0507
status: accepted
date: 2026-10-29
origin: contemporaneous
original-date:
tags: [game-engine, engine, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes: D0496
superseded-by:
---

# Baseball's visual-board runs are multiplier steps, not board score

## Context and Problem Statement
D496's check compared `totalScore` to the board score on the number, which equals the runs only in inning 1. From inning 2 on, any visual-board inning that hit its number was refused, so finishing a game failed with "Could not save your game" (#1112).

## Decision Drivers
* A visual-board game that hit its number from inning 2 on must save, instead of failing with "Could not save your game" (#1112).

## Considered Options
* Keep D496's check, which compares `totalScore` to the board score on the number.
* Derive runs as board score divided by the inning number (chosen).

## Decision Outcome
Chosen option: "`baseballValidator` derives an inning's runs as the board score of its darts on the inning's number divided by the inning (single 1, double 2, treble 3), matching the engine's runs. D496's rule otherwise stands.".

### Consequences
no migration. Keypad behaviour is unchanged. `scoreOnNumber` keeps returning board score for Shanghai.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/services/rulesets/baseball/baseball.validator.test.ts` checks that an inning whose total is its runs, not its board sum, is accepted.

## Pros and Cons of the Options
### Keep D496's check against the board score on the number
* Bad, because that score equals the runs only in inning 1, so every later inning that hit its number was refused.

### Derive runs as board score divided by the inning
* Good, because the derived value matches the engine's runs (single 1, double 2, treble 3).

## Evidence / More Information
Decided: 2026-10-29

* Commit `65bcc368` (2026-10-29, closes #1112; adds the D507 row and validator tests): rebuilt Decision Drivers, Considered Options, Pros and Cons and Confirmation.
* Supersedes D496.
