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
<!-- backfill: pending -->

# Baseball validates a visual-board inning total as its runs

## Context and Problem Statement
the engine persists a closed inning's runs as `totalScore`, but the visual-board check demanded the board sum, so any batch with a closed inning holding an off-number scoring dart was refused. Leaving a game uploads the batch first, so Leave failed with "Could not abandon session"; finishing a game failed the same way.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "under ANALYTICS + VISUAL_BOARD, `baseballValidator` checks each turn's `totalScore` against the runs of its inning (the darts that landed on the inning's number, the inning being the seat's stored turn count plus the batch position) or 0 for a void visit. The shared three-dart check still re-derives every dart from its coordinate; it sees the board sum so it no longer refuses the runs total.".

### Consequences
no migration. Keypad (RECREATIONAL + DETAILED_DARTS) behaviour is unchanged. Other `closedVisitTotal` engines are not covered here.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-25
