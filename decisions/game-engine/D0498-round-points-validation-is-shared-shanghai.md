---
id: D0498
status: accepted
date: 2026-10-26
origin: contemporaneous
original-date:
tags: [game-engine, engine, visit]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Round-points validation is shared; Shanghai checks its visit total the same way

## Context and Problem Statement
Shanghai persists the change in the seat's score, so the board-sum comparison refused any closed visit with an off-number dart or a halving, failing finish and Leave as Baseball did (D496). `byRound` keys stopped being rounds in D495.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`withRoundTotals` (`visual-board-round-total.validator.ts`) is the one home of the visual-board total check for engines whose `closedVisitTotal` persists round points: the shared three-dart check sees board sums, then a per-game rule judges the real `totalScore`. `baseballValidator` and the Shanghai validators use it. Shanghai accepts the points on the round's number (`range_start` plus the stored turn count plus batch position), 0 for a void visit, or a negative total when the visit scored nothing on the number (the Hard halving, whose running score the batch lacks). `gameStatsStore.shanghaiByRound` becomes `shanghaiByNumber` (`{ number, count }`) since its keys are the landed number.".

### Consequences
no migration. Keypad behaviour unchanged. Baseball and Shanghai are the only `closedVisitTotal` engines. A negative Shanghai total is not tied to HARD, so the check is looser than the engine there.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-26
