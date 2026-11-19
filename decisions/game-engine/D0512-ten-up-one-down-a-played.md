---
id: D0512
status: accepted
date: 2026-10-30
origin: contemporaneous
original-date:
tags: [game-engine, Score Training, undo, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Ten Up One Down: a played solo ROUNDS session refuses input; undo keeps an open board turn's total at 0

## Context and Problem Statement
a solo ROUNDS session took attempts past its budget for any caller that skipped `isComplete()` (#1119); the 2026-09-02 solo exemption was needed only for MINUTES expiry. An open board turn's `totalScore` read 0 or the darts' sum depending on undo history (#1118).

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`tuodSpec` refuses a dart, a keypad total and `wouldComplete()` once `inputClosed` reads true: a decided 1v1 match, or a solo ROUNDS session whose attempts reach `durationValue`. A solo MINUTES session never reads closed there; its timer ends it through `isComplete()`. `DartGameSpec.refusal` now takes the config as a second argument. The game shell resets the trailing turn's `totalScore` to 0 after an `undo()` that leaves it open, for a `coordinateCapture` spec without `liveTotal`, so a reopened turn matches one never closed.".

### Consequences
no migration. TUOD's solo golden traces stop at the round budget. Score Training and 121 set `liveTotal` and are unchanged.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-30
