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
<!-- backfill: pending -->

# Baseball's visual-board runs are multiplier steps, not board score

## Context and Problem Statement
D496's check compared `totalScore` to the board score on the number, which equals the runs only in inning 1. From inning 2 on, any visual-board inning that hit its number was refused, so finishing a game failed with "Could not save your game" (#1112).

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`baseballValidator` derives an inning's runs as the board score of its darts on the inning's number divided by the inning (single 1, double 2, treble 3), matching the engine's runs. D496's rule otherwise stands.".

### Consequences
no migration. Keypad behaviour is unchanged. `scoreOnNumber` keeps returning board score for Shanghai.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-29
